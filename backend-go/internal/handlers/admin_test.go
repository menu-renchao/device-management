package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openAdminHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.DeviceProperty{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func TestDeleteDevicePropertyResetsToDefaultPC(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openAdminHandlerTestDB(t)
	userRepo := repository.NewUserRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	handler := NewAdminHandler(userRepo, deviceRepo)

	if err := db.Create(&models.DeviceProperty{
		MerchantID: "M100",
		Property:   "收银",
	}).Error; err != nil {
		t.Fatalf("seed device property: %v", err)
	}

	router := gin.New()
	router.DELETE("/admin/device-properties/:merchant_id", handler.DeleteDeviceProperty)

	req := httptest.NewRequest(http.MethodDelete, "/admin/device-properties/M100", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	property, err := deviceRepo.GetPropertyByMerchantID("M100")
	if err != nil {
		t.Fatalf("GetPropertyByMerchantID returned error: %v", err)
	}
	if property.Property != repository.DefaultDeviceProperty {
		t.Fatalf("property.Property = %q, want %q", property.Property, repository.DefaultDeviceProperty)
	}
}
