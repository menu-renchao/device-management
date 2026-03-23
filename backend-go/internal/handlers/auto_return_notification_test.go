package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openAutoReturnNotificationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.ScanResult{},
		&models.DeviceOccupancy{},
		&models.DeviceProperty{},
		&models.ScanSession{},
		&models.MobileDevice{},
		&models.SystemNotification{},
	); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedApprovedUser(t *testing.T, db *gorm.DB, username string) *models.User {
	t.Helper()

	name := username
	email := username + "@example.com"
	user := &models.User{
		Username:     username,
		PasswordHash: "x",
		Name:         &name,
		Email:        &email,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create user %s: %v", username, err)
	}
	return user
}

func withTestUser(userID uint) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	}
}

func TestDeviceGetDevicesAutoReturnCreatesNotification(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openAutoReturnNotificationTestDB(t)
	borrower := seedApprovedUser(t, db, "borrower-pos")

	merchantID := "M-AUTO-001"
	deviceName := "POS Auto Return"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.0.8",
		MerchantID:     &merchantID,
		Name:           &deviceName,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
	}
	if err := db.Create(scanResult).Error; err != nil {
		t.Fatalf("failed to create scan result: %v", err)
	}

	expiredPurpose := "expired-pos-borrow"
	expiredOccupancy := &models.DeviceOccupancy{
		MerchantID: merchantID,
		UserID:     borrower.ID,
		Purpose:    &expiredPurpose,
		StartTime:  time.Now().Add(-4 * time.Hour),
		EndTime:    time.Now().Add(-30 * time.Minute),
	}
	if err := db.Create(expiredOccupancy).Error; err != nil {
		t.Fatalf("failed to create expired occupancy: %v", err)
	}

	handler := NewDeviceHandler(
		repository.NewDeviceRepository(db),
		repository.NewUserRepository(db),
		services.NewNotificationService(repository.NewNotificationRepository(db)),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)

	router := gin.New()
	router.Use(withTestUser(borrower.ID))
	router.GET("/devices", handler.GetDevices)

	req := httptest.NewRequest(http.MethodGet, "/devices", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	if _, err := repository.NewDeviceRepository(db).GetOccupancyByMerchantID(merchantID); err == nil {
		t.Fatalf("expected expired occupancy to be removed")
	}

	notifications, err := repository.NewNotificationRepository(db).GetByUserID(borrower.ID, 10)
	if err != nil {
		t.Fatalf("failed to load notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("notification count = %d, want 1", len(notifications))
	}
	if notifications[0].Type != models.NotificationTypeBorrowExpired {
		t.Fatalf("notification type = %q, want %q", notifications[0].Type, models.NotificationTypeBorrowExpired)
	}
	if !strings.Contains(notifications[0].Content, deviceName) {
		t.Fatalf("notification content = %q, want to contain %q", notifications[0].Content, deviceName)
	}
}

func TestMobileGetDevicesAutoReturnCreatesNotification(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openAutoReturnNotificationTestDB(t)
	borrower := seedApprovedUser(t, db, "borrower-mobile")

	purpose := "expired-mobile-borrow"
	startTime := time.Now().Add(-6 * time.Hour)
	endTime := time.Now().Add(-45 * time.Minute)
	device := &models.MobileDevice{
		Name:       "iPhone Auto Return",
		OccupierID: &borrower.ID,
		Purpose:    &purpose,
		StartTime:  &startTime,
		EndTime:    &endTime,
	}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("failed to create mobile device: %v", err)
	}

	handler := NewMobileHandler(
		repository.NewMobileRepository(db),
		repository.NewUserRepository(db),
		services.NewNotificationService(repository.NewNotificationRepository(db)),
		nil,
	)

	router := gin.New()
	router.Use(withTestUser(borrower.ID))
	router.GET("/mobile-devices", handler.GetDevices)

	req := httptest.NewRequest(http.MethodGet, "/mobile-devices", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	updatedDevice, err := repository.NewMobileRepository(db).GetByID(device.ID)
	if err != nil {
		t.Fatalf("failed to reload mobile device: %v", err)
	}
	if updatedDevice.OccupierID != nil || updatedDevice.EndTime != nil {
		t.Fatalf("expected expired mobile occupancy to be cleared")
	}

	notifications, err := repository.NewNotificationRepository(db).GetByUserID(borrower.ID, 10)
	if err != nil {
		t.Fatalf("failed to load notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("notification count = %d, want 1", len(notifications))
	}
	if notifications[0].Type != models.NotificationTypeBorrowExpired {
		t.Fatalf("notification type = %q, want %q", notifications[0].Type, models.NotificationTypeBorrowExpired)
	}
	if !strings.Contains(notifications[0].Content, device.Name) {
		t.Fatalf("notification content = %q, want to contain %q", notifications[0].Content, device.Name)
	}
}
