package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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
	listBackupGroupsFunc  func(merchantIDs []string, excludeMerchantID string) ([]services.DBBackupGroup, error)
	openBackupFileFunc    func(merchantID, fileName string) (*os.File, int64, error)
	deleteBackupFunc      func(merchantID, fileName string) error
	restoreFromServerFunc func(host, merchantID, fileName string) error
	restoreFromMerchantFunc func(host, sourceMerchantID, fileName string) error
	restoreFromUploadFunc func(host, filePath string) error
}

func (f *fakeDBBackupService) CreateBackup(host, merchantID, version string) (*services.DBBackupFileInfo, error) {
	return f.createBackupFunc(host, merchantID, version)
}

func (f *fakeDBBackupService) ListBackups(merchantID string) ([]services.DBBackupFileInfo, error) {
	return f.listBackupsFunc(merchantID)
}

func (f *fakeDBBackupService) ListBackupGroups(merchantIDs []string, excludeMerchantID string) ([]services.DBBackupGroup, error) {
	if f.listBackupGroupsFunc == nil {
		groups := make([]services.DBBackupGroup, 0, len(merchantIDs))
		for _, merchantID := range merchantIDs {
			if merchantID == "" || merchantID == excludeMerchantID {
				continue
			}
			items, err := f.listBackupsFunc(merchantID)
			if err != nil {
				return nil, err
			}
			if len(items) == 0 {
				continue
			}
			groups = append(groups, services.DBBackupGroup{
				SourceMerchantID: merchantID,
				Items:            items,
			})
		}
		return groups, nil
	}
	return f.listBackupGroupsFunc(merchantIDs, excludeMerchantID)
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

func (f *fakeDBBackupService) RestoreFromMerchantBackupFile(host, sourceMerchantID, fileName string) error {
	if f.restoreFromMerchantFunc == nil {
		return f.restoreFromServerFunc(host, sourceMerchantID, fileName)
	}
	return f.restoreFromMerchantFunc(host, sourceMerchantID, fileName)
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

func seedBackupTestDevice(t *testing.T, repo *repository.DeviceRepository, merchantID, ip, version string) {
	t.Helper()

	name := merchantID + "-device"
	deviceType := "windows"
	result := &models.ScanResult{
		IP:         ip,
		MerchantID: &merchantID,
		Name:       &name,
		Version:    &version,
		Type:       &deviceType,
		IsOnline:   true,
		ScannedAt:  time.Now(),
	}
	if err := repo.CreateScanResult(result); err != nil {
		t.Fatalf("failed to create backup test device %s: %v", merchantID, err)
	}
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

func TestDeviceDBBackupSourceDoesNotContainMojibake(t *testing.T) {
	sourcePath := filepath.Join("device_db_backup.go")
	content, err := os.ReadFile(sourcePath)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", sourcePath, err)
	}

	text := string(content)
	for _, fragment := range []string{
		"閺佺増宓",
		"鐠囬攱",
		"閸欏倹鏆",
		"娑撳﹣",
		"褰撳墠璁惧闈濴inux",
	} {
		if strings.Contains(text, fragment) {
			t.Fatalf("source file still contains mojibake fragment %q", fragment)
		}
	}
}

func TestListCrossMerchantDatabaseBackupsReturnsGroupedItems(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		listBackupsFunc: func(merchantID string) ([]services.DBBackupFileInfo, error) {
			switch merchantID {
			case "M123":
				return []services.DBBackupFileInfo{
					{Name: "1.0.0_20260311_120000.sql", Version: "1.0.0", Size: 128, ModTime: time.Unix(1700000000, 0)},
				}, nil
			case "M200":
				return []services.DBBackupFileInfo{
					{Name: "2.0.0_20260312_080000.sql", Version: "2.0.0", Size: 256, ModTime: time.Unix(1700100000, 0)},
				}, nil
			case "M300":
				return []services.DBBackupFileInfo{
					{Name: "3.0.0_20260313_090000.sql", Version: "3.0.0", Size: 512, ModTime: time.Unix(1700200000, 0)},
				}, nil
			default:
				return []services.DBBackupFileInfo{}, nil
			}
		},
	})
	seedBackupTestDevice(t, handler.deviceRepo, "M200", "10.0.0.20", "2.0.0")
	seedBackupTestDevice(t, handler.deviceRepo, "M300", "10.0.0.30", "3.0.0")
	handler.licenseService = &fakeLicenseService{
		listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
			if merchantID != "M123" {
				return []services.LicenseBackupFileInfo{}, nil
			}
			return []services.LicenseBackupFileInfo{
				{Name: "LicenseM123_20260311_120000.sql", Size: 12, ModTime: time.Unix(1700000000, 0)},
			}, nil
		},
	}

	router := gin.New()
	router.GET("/device/db/backups/all", withAuthenticatedUser(handler.ListAllDatabaseBackups))

	req := httptest.NewRequest(http.MethodGet, "/device/db/backups/all?merchant_id=M123", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"license_backup_ready":true`)) {
		t.Fatalf("expected response to include license readiness: %s", rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"source_merchant_id":"M200"`)) {
		t.Fatalf("expected response to include grouped source merchant: %s", rec.Body.String())
	}
	if bytes.Contains(rec.Body.Bytes(), []byte(`"source_merchant_id":"M123"`)) {
		t.Fatalf("expected response to exclude target merchant group: %s", rec.Body.String())
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

	handler := NewDeviceHandler(nil, nil, nil, licenseFake, dbFake, nil, nil, nil, nil, nil)

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

func TestRestoreDatabaseFromServerRequiresLicenseBackupForCrossMerchantImport(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		restoreFromServerFunc: func(host, merchantID, fileName string) error {
			return nil
		},
	})
	seedBackupTestDevice(t, handler.deviceRepo, "M200", "10.0.0.20", "2.0.0")
	handler.licenseService = &fakeLicenseService{
		listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
			return []services.LicenseBackupFileInfo{}, nil
		},
	}

	router := gin.New()
	router.POST("/device/db/restore/server", withAuthenticatedUser(handler.RestoreDatabaseFromServer))

	body, _ := json.Marshal(map[string]string{
		"merchant_id":        "M123",
		"source_merchant_id": "M200",
		"file_name":          "2.0.0_20260312_080000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/db/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`License`)) {
		t.Fatalf("expected response to mention License backup requirement: %s", rec.Body.String())
	}
}

func TestRestoreDatabaseFromServerRejectsSameSourceMerchant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		restoreFromServerFunc: func(host, merchantID, fileName string) error {
			return nil
		},
	})
	handler.licenseService = &fakeLicenseService{
		listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
			return []services.LicenseBackupFileInfo{
				{Name: "LicenseM123_20260311_120000.sql", Size: 12, ModTime: time.Unix(1700000000, 0)},
			}, nil
		},
	}

	router := gin.New()
	router.POST("/device/db/restore/server", withAuthenticatedUser(handler.RestoreDatabaseFromServer))

	body, _ := json.Marshal(map[string]string{
		"merchant_id":        "M123",
		"source_merchant_id": "M123",
		"file_name":          "1.0.0_20260311_120000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/db/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestRestoreDatabaseFromServerRejectsForbiddenSourceMerchant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := openDeviceLicenseHandlerTestDB(t)
	user := seedNonAdminUser(t, db, 2, "owner")
	_ = user
	seedDeviceLicenseHandlerData(t, db)

	targetDevice, err := repository.NewDeviceRepository(db).GetScanResultByMerchantID("M123")
	if err != nil {
		t.Fatalf("GetScanResultByMerchantID() error = %v", err)
	}
	targetDevice.OwnerID = &user.ID
	if err := db.Save(targetDevice).Error; err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	sourceMID := "M200"
	sourceName := "source-device"
	sourceVersion := "2.0.0"
	sourceType := "windows"
	sourceDevice := &models.ScanResult{
		IP:         "10.0.0.20",
		MerchantID: &sourceMID,
		Name:       &sourceName,
		Version:    &sourceVersion,
		Type:       &sourceType,
		IsOnline:   true,
		ScannedAt:  time.Now(),
	}
	if err := repository.NewDeviceRepository(db).CreateScanResult(sourceDevice); err != nil {
		t.Fatalf("CreateScanResult() error = %v", err)
	}

	handler := &DeviceHandler{
		deviceRepo: repository.NewDeviceRepository(db),
		userRepo:   repository.NewUserRepository(db),
		licenseService: &fakeLicenseService{
			listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
				return []services.LicenseBackupFileInfo{
					{Name: "LicenseM123_20260311_120000.sql", Size: 12, ModTime: time.Unix(1700000000, 0)},
				}, nil
			},
		},
		dbBackupService: &fakeDBBackupService{
			restoreFromServerFunc: func(host, merchantID, fileName string) error {
				t.Fatalf("restore should not be called for forbidden source merchant")
				return nil
			},
		},
	}

	router := gin.New()
	router.POST("/device/db/restore/server", func(c *gin.Context) {
		c.Set("user_id", uint(2))
		handler.RestoreDatabaseFromServer(c)
	})

	body, _ := json.Marshal(map[string]string{
		"merchant_id":        "M123",
		"source_merchant_id": "M200",
		"file_name":          "2.0.0_20260312_080000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/db/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
}

func TestRestoreDatabaseFromServerCrossMerchantUsesSourceMerchantRestore(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := newDeviceHandlerWithFakeDBBackupService(t, &fakeDBBackupService{
		restoreFromServerFunc: func(host, merchantID, fileName string) error {
			t.Fatalf("same-merchant restore should not be used for cross-merchant import")
			return nil
		},
		restoreFromMerchantFunc: func(host, sourceMerchantID, fileName string) error {
			if host != "10.0.0.8" {
				t.Fatalf("host = %q, want %q", host, "10.0.0.8")
			}
			if sourceMerchantID != "M200" {
				t.Fatalf("sourceMerchantID = %q, want %q", sourceMerchantID, "M200")
			}
			if fileName != "2.0.0_20260312_080000.sql" {
				t.Fatalf("fileName = %q, want source backup file", fileName)
			}
			return nil
		},
	})
	seedBackupTestDevice(t, handler.deviceRepo, "M200", "10.0.0.20", "2.0.0")
	handler.licenseService = &fakeLicenseService{
		listBackupsFunc: func(merchantID string) ([]services.LicenseBackupFileInfo, error) {
			return []services.LicenseBackupFileInfo{
				{Name: "LicenseM123_20260311_120000.sql", Size: 12, ModTime: time.Unix(1700000000, 0)},
			}, nil
		},
	}

	router := gin.New()
	router.POST("/device/db/restore/server", withAuthenticatedUser(handler.RestoreDatabaseFromServer))

	body, _ := json.Marshal(map[string]string{
		"merchant_id":        "M123",
		"source_merchant_id": "M200",
		"file_name":          "2.0.0_20260312_080000.sql",
	})
	req := httptest.NewRequest(http.MethodPost, "/device/db/restore/server", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"source_merchant_id":"M200"`)) {
		t.Fatalf("expected response to include source merchant id: %s", rec.Body.String())
	}
}
