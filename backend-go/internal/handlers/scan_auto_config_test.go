package handlers

import (
	"bytes"
	"context"
	"encoding/json"
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

func openScanHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.ScanResult{}, &models.ScanSession{}, &models.AutoScanConfig{}, &models.ScanJobLog{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func newScanHandlerForTest(t *testing.T) *ScanHandler {
	t.Helper()

	db := openScanHandlerTestDB(t)
	deviceRepo := repository.NewDeviceRepository(db)
	configRepo := repository.NewAutoScanConfigRepository(db)
	jobRepo := repository.NewScanJobLogRepository(db)
	scanService := services.NewScanService()
	scheduler := services.NewAutoScanScheduler(scanService, configRepo, jobRepo, deviceRepo, time.Minute)

	return NewScanHandler(scanService, deviceRepo, configRepo, jobRepo, scheduler)
}

func TestGetAutoScanConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := newScanHandlerForTest(t)
	router := gin.New()
	router.GET("/scan/auto-config", handler.GetAutoScanConfig)

	req := httptest.NewRequest(http.MethodGet, "/scan/auto-config", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"interval_minutes":60`)) {
		t.Fatalf("expected default interval in response: %s", rec.Body.String())
	}
}

func TestUpdateAutoScanConfigRejectsInvalidCIDR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := newScanHandlerForTest(t)
	router := gin.New()
	router.PUT("/scan/auto-config", handler.UpdateAutoScanConfig)

	body, err := json.Marshal(map[string]interface{}{
		"enabled":          true,
		"interval_minutes": 60,
		"cidr_blocks":      []string{"bad-cidr"},
	})
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/scan/auto-config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestRunAutoScanNowStartsScan(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := openScanHandlerTestDB(t)
	deviceRepo := repository.NewDeviceRepository(db)
	configRepo := repository.NewAutoScanConfigRepository(db)
	jobRepo := repository.NewScanJobLogRepository(db)
	scanService := services.NewScanService()

	config, err := configRepo.GetOrCreateDefault()
	if err != nil {
		t.Fatalf("GetOrCreateDefault returned error: %v", err)
	}
	config.Enabled = true
	if err := config.SetCIDRBlocks([]string{"192.168.1.0/24"}); err != nil {
		t.Fatalf("SetCIDRBlocks returned error: %v", err)
	}
	if err := configRepo.Update(config); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	started := make(chan struct{}, 1)
	release := make(chan struct{})
	scanService.SetPerformScanFunc(func(_ context.Context, _ services.ScanRunConfig, _ func(map[string]interface{})) {
		started <- struct{}{}
		<-release
		scanService.StopScan()
	})

	scheduler := services.NewAutoScanScheduler(scanService, configRepo, jobRepo, deviceRepo, time.Minute)
	handler := NewScanHandler(scanService, deviceRepo, configRepo, jobRepo, scheduler)
	router := gin.New()
	router.POST("/scan/auto-run", handler.RunAutoScanNow)

	req := httptest.NewRequest(http.MethodPost, "/scan/auto-run", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for auto run")
	}

	close(release)
}
