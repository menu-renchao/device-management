package services

import (
	"context"
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openSchedulerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.AutoScanConfig{}, &models.ScanJobLog{}, &models.ScanResult{}, &models.ScanSession{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func TestShouldRunAutoScan(t *testing.T) {
	now := time.Now()

	if shouldRunAutoScan(nil, now) {
		t.Fatalf("nil config should not run")
	}

	config := &models.AutoScanConfig{Enabled: false, IntervalMinutes: 60}
	if shouldRunAutoScan(config, now) {
		t.Fatalf("disabled config should not run")
	}

	config.Enabled = true
	if !shouldRunAutoScan(config, now) {
		t.Fatalf("enabled config without previous run should run")
	}

	startedAt := now.Add(-30 * time.Minute)
	config.LastAutoScanStartedAt = &startedAt
	if shouldRunAutoScan(config, now) {
		t.Fatalf("config should not run before interval elapsed")
	}

	oldStartedAt := now.Add(-2 * time.Hour)
	config.LastAutoScanStartedAt = &oldStartedAt
	if !shouldRunAutoScan(config, now) {
		t.Fatalf("config should run after interval elapsed")
	}
}

func TestAutoScanSchedulerRunOnceCreatesJobAndUpdatesConfig(t *testing.T) {
	db := openSchedulerTestDB(t)
	configRepo := repository.NewAutoScanConfigRepository(db)
	jobRepo := repository.NewScanJobLogRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	scanService := NewScanService()

	config, err := configRepo.GetOrCreateDefault()
	if err != nil {
		t.Fatalf("GetOrCreateDefault returned error: %v", err)
	}
	config.Enabled = true
	config.IntervalMinutes = 60
	if err := config.SetCIDRBlocks([]string{"192.168.1.0/24"}); err != nil {
		t.Fatalf("SetCIDRBlocks returned error: %v", err)
	}
	if err := configRepo.Update(config); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	started := make(chan ScanRunConfig, 1)
	release := make(chan struct{})
	scanService.performScanFunc = func(_ context.Context, cfg ScanRunConfig, _ func(map[string]interface{})) {
		started <- cfg
		<-release
		scanService.status.mu.Lock()
		scanService.status.IsScanning = false
		scanService.status.Progress = 100
		scanService.status.mu.Unlock()
	}

	scheduler := NewAutoScanScheduler(scanService, configRepo, jobRepo, deviceRepo, time.Minute)

	if err := scheduler.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce returned error: %v", err)
	}

	select {
	case cfg := <-started:
		if len(cfg.CIDRBlocks) != 1 || cfg.CIDRBlocks[0] != "192.168.1.0/24" {
			t.Fatalf("unexpected scan config: %+v", cfg)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for scheduler to start scan")
	}

	close(release)
	var jobs []models.ScanJobLog
	var total int64
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		jobs, total, err = jobRepo.List(1, 10)
		if err != nil {
			t.Fatalf("List returned error: %v", err)
		}
		if total == 1 && len(jobs) == 1 && jobs[0].Status == "success" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(jobs) != 1 || jobs[0].Status != "success" {
		t.Fatalf("job status = %v, want success", jobs)
	}

	updatedConfig, err := configRepo.GetOrCreateDefault()
	if err != nil {
		t.Fatalf("GetOrCreateDefault returned error: %v", err)
	}
	if updatedConfig.LastAutoScanStartedAt == nil {
		t.Fatalf("expected LastAutoScanStartedAt to be set")
	}
	if updatedConfig.LastAutoScanFinishedAt == nil {
		t.Fatalf("expected LastAutoScanFinishedAt to be set")
	}
}
