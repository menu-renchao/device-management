package repository

import (
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openDeviceRepoTestDB(t *testing.T) *gorm.DB {
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

func seedScanResult(t *testing.T, db *gorm.DB, merchantID string) {
	t.Helper()

	deviceType := "PC"
	name := "POS Device"
	version := "1.0.0"
	now := time.Now()
	result := &models.ScanResult{
		IP:             "127.0.0.1",
		MerchantID:     &merchantID,
		Name:           &name,
		Version:        &version,
		Type:           &deviceType,
		ScannedAt:      now,
		IsOnline:       true,
		LastOnlineTime: now,
	}

	if err := db.Create(result).Error; err != nil {
		t.Fatalf("failed to seed scan result %s: %v", merchantID, err)
	}
}

func seedDeviceProperty(t *testing.T, db *gorm.DB, merchantID, property string) {
	t.Helper()

	record := &models.DeviceProperty{
		MerchantID: merchantID,
		Property:   property,
	}

	if err := db.Create(record).Error; err != nil {
		t.Fatalf("failed to seed device property %s: %v", merchantID, err)
	}
}

func TestDeviceRepositoryListScanResultsTreatsMissingPropertyAsPC(t *testing.T) {
	db := openDeviceRepoTestDB(t)
	repo := NewDeviceRepository(db)

	seedScanResult(t, db, "pc-default")
	seedScanResult(t, db, "cashier-device")
	seedDeviceProperty(t, db, "cashier-device", "收银")

	results, total, _, err := repo.ListScanResults(1, 20, "", nil, []string{"PC"}, false, 0)
	if err != nil {
		t.Fatalf("ListScanResults returned error: %v", err)
	}

	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}
	if results[0].MerchantID == nil || *results[0].MerchantID != "pc-default" {
		t.Fatalf("expected pc-default in PC filter, got %#v", results[0].MerchantID)
	}
}

func TestDeviceRepositoryGetDistinctPropertiesIncludesPCForMissingRows(t *testing.T) {
	db := openDeviceRepoTestDB(t)
	repo := NewDeviceRepository(db)

	seedScanResult(t, db, "pc-default")
	seedScanResult(t, db, "cashier-device")
	seedDeviceProperty(t, db, "cashier-device", "收银")

	properties, err := repo.GetDistinctProperties()
	if err != nil {
		t.Fatalf("GetDistinctProperties returned error: %v", err)
	}

	propertySet := make(map[string]struct{}, len(properties))
	for _, property := range properties {
		propertySet[property] = struct{}{}
	}

	if _, ok := propertySet["PC"]; !ok {
		t.Fatalf("expected distinct properties to include PC, got %v", properties)
	}
	if _, ok := propertySet["收银"]; !ok {
		t.Fatalf("expected distinct properties to include 收银, got %v", properties)
	}
}

func TestDeviceRepositoryCreateScanResultCreatesDefaultPropertyRecord(t *testing.T) {
	db := openDeviceRepoTestDB(t)
	repo := NewDeviceRepository(db)

	merchantID := "new-device"
	deviceType := "PC"
	now := time.Now()
	result := &models.ScanResult{
		IP:             "127.0.0.2",
		MerchantID:     &merchantID,
		Type:           &deviceType,
		ScannedAt:      now,
		IsOnline:       true,
		LastOnlineTime: now,
	}

	if err := repo.CreateScanResult(result); err != nil {
		t.Fatalf("CreateScanResult returned error: %v", err)
	}

	property, err := repo.GetPropertyByMerchantID(merchantID)
	if err != nil {
		t.Fatalf("GetPropertyByMerchantID returned error: %v", err)
	}
	if property.Property != "PC" {
		t.Fatalf("property.Property = %q, want PC", property.Property)
	}
}
