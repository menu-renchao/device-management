package handlers

import (
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openServiceExceptionScanDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.ScanResult{}, &models.DeviceProperty{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func newScanHandlerWithRepo(deviceRepo *repository.DeviceRepository) *ScanHandler {
	return &ScanHandler{deviceRepo: deviceRepo}
}

func TestSaveScanResultSkipsBlankMerchantID(t *testing.T) {
	db := openServiceExceptionScanDB(t)
	repo := repository.NewDeviceRepository(db)
	handler := newScanHandlerWithRepo(repo)

	handler.saveScanResult(map[string]interface{}{
		"ip":         "10.0.0.8",
		"merchantId": "   ",
		"name":       "Broken POS",
		"version":    "1.0.0",
	})

	var count int64
	if err := db.Model(&models.ScanResult{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count scan results: %v", err)
	}

	if count != 0 {
		t.Fatalf("scan result count = %d, want 0", count)
	}
}

func TestSaveScanResultDoesNotTouchExistingValidRowsWhenMerchantIDBlank(t *testing.T) {
	db := openServiceExceptionScanDB(t)
	repo := repository.NewDeviceRepository(db)
	handler := newScanHandlerWithRepo(repo)

	merchantID := "M123"
	name := "Valid POS"
	version := "1.0.0"
	deviceType := "Linux"
	now := time.Now()
	existing := &models.ScanResult{
		IP:             "10.0.0.9",
		MerchantID:     &merchantID,
		Name:           &name,
		Version:        &version,
		Type:           &deviceType,
		ScannedAt:      now,
		IsOnline:       true,
		LastOnlineTime: now,
	}

	if err := repo.CreateScanResult(existing); err != nil {
		t.Fatalf("failed to seed valid scan result: %v", err)
	}

	handler.saveScanResult(map[string]interface{}{
		"ip":         "10.0.0.9",
		"merchantId": "",
		"name":       "Broken POS",
		"version":    "9.9.9",
	})

	var results []models.ScanResult
	if err := db.Order("id ASC").Find(&results).Error; err != nil {
		t.Fatalf("failed to query scan results: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}
	if results[0].MerchantID == nil || *results[0].MerchantID != merchantID {
		t.Fatalf("merchantID = %#v, want %q", results[0].MerchantID, merchantID)
	}
	if results[0].Version == nil || *results[0].Version != version {
		t.Fatalf("version = %#v, want %q", results[0].Version, version)
	}
}
