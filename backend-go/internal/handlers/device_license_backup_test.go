package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type fakeLicenseService struct {
	backupFunc              func(host string) (*services.LicenseBackupResult, error)
	createBackupFunc        func(host, merchantID string) (*services.LicenseBackupFileInfo, error)
	listBackupsFunc         func(merchantID string) ([]services.LicenseBackupFileInfo, error)
	openBackupFileFunc      func(merchantID, fileName string) (*os.File, int64, error)
	deleteBackupFunc        func(merchantID, fileName string) error
	restoreFromServerFunc   func(host, merchantID, fileName string) error
	importFunc              func(host, sqlContent string) (*services.LicenseImportResult, error)
}

func (f *fakeLicenseService) Backup(host string) (*services.LicenseBackupResult, error) {
	if f.backupFunc == nil {
		return &services.LicenseBackupResult{}, nil
	}
	return f.backupFunc(host)
}

func (f *fakeLicenseService) CreateBackup(host, merchantID string) (*services.LicenseBackupFileInfo, error) {
	return f.createBackupFunc(host, merchantID)
}

func (f *fakeLicenseService) ListBackups(merchantID string) ([]services.LicenseBackupFileInfo, error) {
	return f.listBackupsFunc(merchantID)
}

func (f *fakeLicenseService) OpenBackupFile(merchantID, fileName string) (*os.File, int64, error) {
	return f.openBackupFileFunc(merchantID, fileName)
}

func (f *fakeLicenseService) DeleteBackup(merchantID, fileName string) error {
	return f.deleteBackupFunc(merchantID, fileName)
}

func (f *fakeLicenseService) RestoreFromServerFile(host, merchantID, fileName string) error {
	return f.restoreFromServerFunc(host, merchantID, fileName)
}

func (f *fakeLicenseService) Import(host, sqlContent string) (*services.LicenseImportResult, error) {
	return f.importFunc(host, sqlContent)
}

func openDeviceLicenseHandlerTestDB(t *testing.T) *gorm.DB {
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

func seedDeviceLicenseHandlerData(t *testing.T, db *gorm.DB) {
	t.Helper()

	admin := &models.User{ID: 1, Username: "admin", PasswordHash: "x", Role: "admin", Status: "approved"}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("failed to create admin: %v", err)
	}

	merchantID := "M123"
	name := "Demo Device"
	version := "1.0.0"
	deviceType := "windows"
	device := &models.ScanResult{
		IP:         "10.0.0.8",
		MerchantID: &merchantID,
		Name:       &name,
		Version:    &version,
		Type:       &deviceType,
		IsOnline:   true,
		ScannedAt:  time.Now(),
	}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("failed to create device: %v", err)
	}
}

func newDeviceHandlerWithFakeLicenseService(t *testing.T, fake *fakeLicenseService) *DeviceHandler {
	t.Helper()

	db := openDeviceLicenseHandlerTestDB(t)
	seedDeviceLicenseHandlerData(t, db)

	return &DeviceHandler{
		deviceRepo:      repository.NewDeviceRepository(db),
		userRepo:        repository.NewUserRepository(db),
		licenseService:  fake,
		dbBackupService: nil,
		linuxService:    nil,
	}
}

func withAuthenticatedUser(handler gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user_id", uint(1))
		handler(c)
	}
}

func TestListLicenseBackupsReturnsItems(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeLicenseService(t, &fakeLicenseService{
		listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
			return []services.LicenseBackupFileInfo{
				{Name: "LicenseM123_20260311_120000.sql", Size: 12, ModTime: time.Unix(1700000000, 0)},
			}, nil
		},
	})

	router := gin.New()
	router.GET("/device/license/backups", withAuthenticatedUser(handler.ListLicenseBackups))

	req := httptest.NewRequest(http.MethodGet, "/device/license/backups?merchant_id=M123", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"LicenseM123_20260311_120000.sql"`)) {
		t.Fatalf("expected response to include backup file name: %s", rec.Body.String())
	}
}

func TestBackupLicenseCreatesServerManagedFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeLicenseService(t, &fakeLicenseService{
		createBackupFunc: func(host, merchantID string) (*services.LicenseBackupFileInfo, error) {
			return &services.LicenseBackupFileInfo{
				Name:    "LicenseM123_20260311_120000.sql",
				Size:    32,
				ModTime: time.Unix(1700000000, 0),
			}, nil
		},
	})

	router := gin.New()
	router.POST("/device/license/backup", withAuthenticatedUser(handler.CreateLicenseBackup))

	body, _ := json.Marshal(map[string]string{"merchant_id": "M123"})
	req := httptest.NewRequest(http.MethodPost, "/device/license/backup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("Content-Disposition")) {
		t.Fatalf("expected JSON response instead of direct file download")
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"LicenseM123_20260311_120000.sql"`)) {
		t.Fatalf("expected response to include created backup metadata: %s", rec.Body.String())
	}
}

func TestDownloadLicenseBackupStreamsFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "LicenseM123_20260311_120000.sql")
	if err := os.WriteFile(filePath, []byte("SELECT 1;"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	handler := newDeviceHandlerWithFakeLicenseService(t, &fakeLicenseService{
		openBackupFileFunc: func(merchantID, fileName string) (*os.File, int64, error) {
			file, err := os.Open(filePath)
			if err != nil {
				return nil, 0, err
			}
			return file, int64(len("SELECT 1;")), nil
		},
	})

	router := gin.New()
	router.GET("/device/license/backups/download", withAuthenticatedUser(handler.DownloadLicenseBackup))

	req := httptest.NewRequest(http.MethodGet, "/device/license/backups/download?merchant_id=M123&file_name=LicenseM123_20260311_120000.sql", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if body := rec.Body.String(); body != "SELECT 1;" {
		t.Fatalf("body = %q, want SQL file content", body)
	}
}

func TestRestoreLicenseFromUploadRejectsNonSQLFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeLicenseService(t, &fakeLicenseService{
		importFunc: func(host, sqlContent string) (*services.LicenseImportResult, error) {
			return &services.LicenseImportResult{ExecutedCount: 1}, nil
		},
	})

	router := gin.New()
	router.POST("/device/license/restore/upload", withAuthenticatedUser(handler.RestoreLicenseFromUpload))

	var body bytes.Buffer
	writer := io.MultiWriter(&body)
	_ = writer

	req := httptest.NewRequest(http.MethodPost, "/device/license/restore/upload", &body)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=invalid")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code == http.StatusOK {
		t.Fatalf("expected invalid upload to fail")
	}
}

func TestRestoreLicenseFromServerRequiresPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openDeviceLicenseHandlerTestDB(t)
	user := &models.User{ID: 2, Username: "user", PasswordHash: "x", Role: "user", Status: "approved"}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	merchantID := "M123"
	deviceType := "windows"
	device := &models.ScanResult{
		IP:         "10.0.0.9",
		MerchantID: &merchantID,
		Type:       &deviceType,
		IsOnline:   true,
		ScannedAt:  time.Now(),
	}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("failed to create device: %v", err)
	}

	handler := &DeviceHandler{
		deviceRepo:     repository.NewDeviceRepository(db),
		userRepo:       repository.NewUserRepository(db),
		licenseService: &fakeLicenseService{},
	}

	router := gin.New()
	router.POST("/device/license/restore/server", func(c *gin.Context) {
		c.Set("user_id", uint(2))
		handler.RestoreLicenseFromServer(c)
	})

	body, _ := json.Marshal(map[string]string{
		"merchant_id": "M123",
		"file_name":   "LicenseM123_20260311_120000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/license/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
}
