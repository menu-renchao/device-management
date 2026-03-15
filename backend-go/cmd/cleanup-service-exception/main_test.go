package main

import (
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openCleanupServiceExceptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.ScanResult{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedCleanupScanResult(t *testing.T, db *gorm.DB, ip string, merchantID *string) {
	t.Helper()

	name := "POS Device"
	version := "1.0.0"
	deviceType := "Linux"
	now := time.Now()
	result := &models.ScanResult{
		IP:             ip,
		MerchantID:     merchantID,
		Name:           &name,
		Version:        &version,
		Type:           &deviceType,
		ScannedAt:      now,
		IsOnline:       true,
		LastOnlineTime: now,
	}

	if err := db.Create(result).Error; err != nil {
		t.Fatalf("failed to seed scan result for %s: %v", ip, err)
	}
}

func TestCleanupServiceExceptionRowsDeletesOnlyInvalidMerchantRows(t *testing.T) {
	db := openCleanupServiceExceptionTestDB(t)

	validMerchantID := "M123"
	blankMerchantID := ""
	whitespaceMerchantID := "   "

	seedCleanupScanResult(t, db, "10.0.0.1", &validMerchantID)
	seedCleanupScanResult(t, db, "10.0.0.2", &blankMerchantID)
	seedCleanupScanResult(t, db, "10.0.0.3", &whitespaceMerchantID)

	matched, deleted, err := cleanupServiceExceptionRows(db)
	if err != nil {
		t.Fatalf("cleanupServiceExceptionRows returned error: %v", err)
	}

	if matched != 2 {
		t.Fatalf("matched = %d, want 2", matched)
	}
	if deleted != 2 {
		t.Fatalf("deleted = %d, want 2", deleted)
	}

	var remaining []models.ScanResult
	if err := db.Order("ip ASC").Find(&remaining).Error; err != nil {
		t.Fatalf("failed to query remaining rows: %v", err)
	}

	if len(remaining) != 1 {
		t.Fatalf("len(remaining) = %d, want 1", len(remaining))
	}
	if remaining[0].MerchantID == nil || *remaining[0].MerchantID != validMerchantID {
		t.Fatalf("merchantID = %#v, want %q", remaining[0].MerchantID, validMerchantID)
	}

	var invalidCount int64
	if err := db.Unscoped().
		Model(&models.ScanResult{}).
		Where("merchant_id IS NULL OR TRIM(merchant_id) = ''").
		Count(&invalidCount).Error; err != nil {
		t.Fatalf("failed to count unscoped invalid rows: %v", err)
	}
	if invalidCount != 0 {
		t.Fatalf("unscoped invalid row count = %d, want 0", invalidCount)
	}
}
