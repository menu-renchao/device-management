package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openLinuxPermissionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.ScanResult{}, &models.DeviceOccupancy{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func TestLinuxStatusRequiresAssetPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openLinuxPermissionTestDB(t)
	userRepo := repository.NewUserRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	mobileRepo := repository.NewMobileRepository(db)
	accessService := services.NewAssetAccessService(userRepo, deviceRepo, mobileRepo)

	ownerName := "Owner"
	ownerEmail := "owner@example.com"
	owner := &models.User{
		Username:     "owner",
		PasswordHash: "x",
		Name:         &ownerName,
		Email:        &ownerEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	otherName := "Other"
	otherEmail := "other@example.com"
	other := &models.User{
		Username:     "other",
		PasswordHash: "x",
		Name:         &otherName,
		Email:        &otherEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(other).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	merchantID := "M500"
	name := "POS-500"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.5.0",
		MerchantID:     &merchantID,
		Name:           &name,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
		OwnerID:        &owner.ID,
	}
	if err := db.Create(scanResult).Error; err != nil {
		t.Fatalf("create scan result: %v", err)
	}

	handler := NewLinuxHandler(nil, nil, deviceRepo, userRepo, accessService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", other.ID)
		c.Next()
	})
	router.GET("/api/linux/status", handler.GetStatus)

	req := httptest.NewRequest(http.MethodGet, "/api/linux/status?merchant_id="+merchantID, nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("status code = %d, want %d", resp.Code, http.StatusForbidden)
	}
}
