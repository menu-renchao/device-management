package repository

import (
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openAutoScanTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.AutoScanConfig{}, &models.ScanJobLog{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func TestAutoScanConfigRepositoryGetOrCreateDefault(t *testing.T) {
	db := openAutoScanTestDB(t)
	repo := NewAutoScanConfigRepository(db)

	config, err := repo.GetOrCreateDefault()
	if err != nil {
		t.Fatalf("GetOrCreateDefault returned error: %v", err)
	}

	if config.Enabled {
		t.Fatalf("expected default auto scan to be disabled")
	}
	if config.IntervalMinutes != 60 {
		t.Fatalf("IntervalMinutes = %d, want 60", config.IntervalMinutes)
	}

	blocks, err := config.GetCIDRBlocks()
	if err != nil {
		t.Fatalf("GetCIDRBlocks returned error: %v", err)
	}
	if len(blocks) != 0 {
		t.Fatalf("expected empty default cidr blocks, got %v", blocks)
	}
}

func TestScanJobLogRepositoryListReturnsNewestFirst(t *testing.T) {
	db := openAutoScanTestDB(t)
	repo := NewScanJobLogRepository(db)

	first := &models.ScanJobLog{
		TriggerType: "auto",
		Status:      "success",
		StartedAt:   time.Now().Add(-time.Hour),
		TriggeredBy: "system",
		Port:        22080,
	}
	if err := first.SetCIDRBlocks([]string{"192.168.1.0/24"}); err != nil {
		t.Fatalf("failed to set first cidr blocks: %v", err)
	}
	if err := repo.Create(first); err != nil {
		t.Fatalf("failed to create first job log: %v", err)
	}

	second := &models.ScanJobLog{
		TriggerType: "auto",
		Status:      "failed",
		StartedAt:   time.Now(),
		TriggeredBy: "system",
		Port:        22080,
	}
	if err := second.SetCIDRBlocks([]string{"10.0.0.0/24"}); err != nil {
		t.Fatalf("failed to set second cidr blocks: %v", err)
	}
	if err := repo.Create(second); err != nil {
		t.Fatalf("failed to create second job log: %v", err)
	}

	jobs, total, err := repo.List(1, 10)
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	if len(jobs) != 2 {
		t.Fatalf("len(jobs) = %d, want 2", len(jobs))
	}
	if jobs[0].ID != second.ID {
		t.Fatalf("expected newest job first, got job ID %d", jobs[0].ID)
	}
}

func TestScanJobLogRepositoryPruneAutoRunsKeepsNewestRecords(t *testing.T) {
	db := openAutoScanTestDB(t)
	repo := NewScanJobLogRepository(db)

	var keptAutoID uint
	for i := 0; i < 4; i++ {
		job := &models.ScanJobLog{
			TriggerType: "auto",
			Status:      "success",
			StartedAt:   time.Now().Add(time.Duration(i) * time.Minute),
			TriggeredBy: "system",
			Port:        22080,
		}
		if err := job.SetCIDRBlocks([]string{"192.168.1.0/24"}); err != nil {
			t.Fatalf("failed to set auto cidr blocks: %v", err)
		}
		if err := repo.Create(job); err != nil {
			t.Fatalf("failed to create auto job log: %v", err)
		}
		if i == 3 {
			keptAutoID = job.ID
		}
	}

	manual := &models.ScanJobLog{
		TriggerType: "manual",
		Status:      "success",
		StartedAt:   time.Now().Add(10 * time.Minute),
		TriggeredBy: "tester",
		Port:        22080,
	}
	if err := manual.SetCIDRBlocks([]string{"10.0.0.0/24"}); err != nil {
		t.Fatalf("failed to set manual cidr blocks: %v", err)
	}
	if err := repo.Create(manual); err != nil {
		t.Fatalf("failed to create manual job log: %v", err)
	}

	if err := repo.PruneAutoRuns(2); err != nil {
		t.Fatalf("PruneAutoRuns returned error: %v", err)
	}

	var autoJobs []models.ScanJobLog
	if err := db.Where("trigger_type = ?", "auto").Order("started_at DESC, id DESC").Find(&autoJobs).Error; err != nil {
		t.Fatalf("failed to query auto jobs: %v", err)
	}
	if len(autoJobs) != 2 {
		t.Fatalf("len(autoJobs) = %d, want 2", len(autoJobs))
	}
	if autoJobs[0].ID != keptAutoID {
		t.Fatalf("expected newest auto job to remain, got %d", autoJobs[0].ID)
	}

	var manualCount int64
	if err := db.Model(&models.ScanJobLog{}).Where("trigger_type = ?", "manual").Count(&manualCount).Error; err != nil {
		t.Fatalf("failed to count manual jobs: %v", err)
	}
	if manualCount != 1 {
		t.Fatalf("manualCount = %d, want 1", manualCount)
	}
}
