package repository

import (
	"testing"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openDeviceWebAccessLogRepoTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.DeviceWebAccessLog{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func TestCreateDeviceWebAccessLog(t *testing.T) {
	db := openDeviceWebAccessLogRepoTestDB(t)
	repo := NewDeviceWebAccessLogRepository(db)

	err := repo.Create(&models.DeviceWebAccessLog{
		MerchantID: "M123",
		TargetIP:   "192.168.1.50",
		TargetPort: 22080,
		Method:     "GET",
		Path:       "/",
		StatusCode: 200,
		UserID:     1,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
}
