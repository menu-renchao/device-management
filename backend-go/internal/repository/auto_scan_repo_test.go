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
