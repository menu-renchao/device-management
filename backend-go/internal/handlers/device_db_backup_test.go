package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type fakeDBBackupService struct {
	createBackupFunc      func(host, merchantID, version string) (*services.DBBackupFileInfo, error)
	listBackupsFunc       func(merchantID string) ([]services.DBBackupFileInfo, error)
	openBackupFileFunc    func(merchantID, fileName string) (*os.File, int64, error)
	deleteBackupFunc      func(merchantID, fileName string) error
	restoreFromServerFunc func(host, merchantID, fileName string) error
	restoreFromUploadFunc func(host, filePath string) error
}

func (f *fakeDBBackupService) CreateBackup(host, merchantID, version string) (*services.DBBackupFileInfo, error) {
	return f.createBackupFunc(host, merchantID, version)
}

func (f *fakeDBBackupService) ListBackups(merchantID string) ([]services.DBBackupFileInfo, error) {
	return f.listBackupsFunc(merchantID)
}

func (f *fakeDBBackupService) OpenBackupFile(merchantID, fileName string) (*os.File, int64, error) {
	return f.openBackupFileFunc(merchantID, fileName)
}

func (f *fakeDBBackupService) DeleteBackup(merchantID, fileName string) error {
	return f.deleteBackupFunc(merchantID, fileName)
}

func (f *fakeDBBackupService) RestoreFromServerFile(host, merchantID, fileName string) error {
	return f.restoreFromServerFunc(host, merchantID, fileName)
}

func (f *fakeDBBackupService) RestoreFromUploadFile(host, filePath string) error {
	return f.restoreFromUploadFunc(host, filePath)
}

func newDeviceHandlerWithFakeDBBackupService(t *testing.T, fake *fakeDBBackupService) *DeviceHandler {
	t.Helper()

	db := openDeviceLicenseHandlerTestDB(t)
	seedDeviceLicenseHandlerData(t, db)

	return &DeviceHandler{
		deviceRepo:      repository.NewDeviceRepository(db),
		userRepo:        repository.NewUserRepository(db),
		licenseService:  nil,
		dbBackupService: fake,
		linuxService:    nil,
	}
}

func seedNonAdminUser(t *testing.T, db *gorm.DB, id uint, username string) *models.User {
	t.Helper()

	user := &models.User{ID: id, Username: username, PasswordHash: "x", Role: "user", Status: "approved"}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	return user
}

func TestListDatabaseBackupsReturnsItems(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		listBackupsFunc: func(merchantID string) ([]services.DBBackupFileInfo, error) {
			return []services.DBBackupFileInfo{
				{Name: "1.0.0_20260311_120000.sql", Version: "1.0.0", Size: 128, ModTime: time.Unix(1700000000, 0)},
			}, nil
		},
	})

	router := gin.New()
	router.GET("/device/db/backups", withAuthenticatedUser(handler.ListDatabaseBackups))

	req := httptest.NewRequest(http.MethodGet, "/device/db/backups?merchant_id=M123", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"1.0.0_20260311_120000.sql"`)) {
		t.Fatalf("expected response to include backup file name: %s", rec.Body.String())
	}
}

func TestBackupDatabaseCreatesServerManagedFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		createBackupFunc: func(host, merchantID, version string) (*services.DBBackupFileInfo, error) {
			if host != "10.0.0.8" {
				t.Fatalf("host = %q, want %q", host, "10.0.0.8")
			}
			if merchantID != "M123" {
				t.Fatalf("merchantID = %q, want %q", merchantID, "M123")
			}
			if version != "1.0.0" {
				t.Fatalf("version = %q, want %q", version, "1.0.0")
			}
			return &services.DBBackupFileInfo{
				Name:    "1.0.0_20260311_120000.sql",
				Version: "1.0.0",
				Size:    256,
				ModTime: time.Unix(1700000000, 0),
			}, nil
		},
	})

	router := gin.New()
	router.POST("/device/db/backup", withAuthenticatedUser(handler.BackupDatabase))

	body, _ := json.Marshal(map[string]string{"merchant_id": "M123"})
	req := httptest.NewRequest(http.MethodPost, "/device/db/backup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"1.0.0_20260311_120000.sql"`)) {
		t.Fatalf("expected response to include created backup metadata: %s", rec.Body.String())
	}
}

func TestNewDeviceHandlerKeepsInjectedBackupManagers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	licenseFake := &fakeLicenseService{}
	dbFake := &fakeDBBackupService{}

	handler := NewDeviceHandler(nil, nil, nil, licenseFake, dbFake, nil, nil)

	if handler.licenseService != licenseFake {
		t.Fatalf("licenseService was not preserved by constructor")
	}
	if handler.dbBackupService != dbFake {
		t.Fatalf("dbBackupService was not preserved by constructor")
	}
}

func TestDeleteDatabaseBackupReturnsNotFoundForMissingFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		deleteBackupFunc: func(merchantID, fileName string) error {
			return os.ErrNotExist
		},
	})

	router := gin.New()
	router.DELETE("/device/db/backups", withAuthenticatedUser(handler.DeleteDatabaseBackup))

	req := httptest.NewRequest(http.MethodDelete, "/device/db/backups?merchant_id=M123&file_name=missing.sql", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusNotFound, rec.Body.String())
	}
}

func TestRestoreDatabaseFromServerRequiresPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openDeviceLicenseHandlerTestDB(t)
	user := seedNonAdminUser(t, db, 2, "user")
	_ = user
	seedDeviceLicenseHandlerData(t, db)

	handler := &DeviceHandler{
		deviceRepo: repository.NewDeviceRepository(db),
		userRepo:   repository.NewUserRepository(db),
		dbBackupService: &fakeDBBackupService{
			restoreFromServerFunc: func(host, merchantID, fileName string) error {
				return errors.New("should not be called")
			},
		},
	}

	router := gin.New()
	router.POST("/device/db/restore/server", func(c *gin.Context) {
		c.Set("user_id", uint(2))
		handler.RestoreDatabaseFromServer(c)
	})

	body, _ := json.Marshal(map[string]string{
		"merchant_id": "M123",
		"file_name":   "1.0.0_20260311_120000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/db/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
}
