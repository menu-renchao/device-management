package services

import (
	"database/sql"
	"reflect"
	"strings"
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type stubPOSDBRuntime struct {
	info       *POSDBDefaultConnectionInfo
	infoErr    error
	input      DBConnectionInput
	resolveErr error
}

func (s stubPOSDBRuntime) GetDefaultConnectionInfo(merchantID string) (*POSDBDefaultConnectionInfo, error) {
	if s.infoErr != nil {
		return nil, s.infoErr
	}
	if s.info != nil {
		return s.info, nil
	}
	return &POSDBDefaultConnectionInfo{MerchantID: merchantID}, nil
}

func (s stubPOSDBRuntime) Resolve(merchantID string) (DBConnectionInput, error) {
	if s.resolveErr != nil {
		return DBConnectionInput{}, s.resolveErr
	}
	return s.input, nil
}

func TestMySQLConnectionHostsIncludesLoopbackForLocalDeviceIP(t *testing.T) {
	t.Parallel()

	hosts := mysqlConnectionHosts("192.168.0.115", []string{"192.168.0.115", "10.0.0.8"})

	expected := []string{"192.168.0.115", "localhost", "127.0.0.1"}
	if !reflect.DeepEqual(hosts, expected) {
		t.Fatalf("expected hosts %v, got %v", expected, hosts)
	}
}

func TestMySQLConnectionHostsKeepsRemoteHostUnchanged(t *testing.T) {
	t.Parallel()

	hosts := mysqlConnectionHosts("192.168.0.200", []string{"192.168.0.115", "10.0.0.8"})

	expected := []string{"192.168.0.200"}
	if !reflect.DeepEqual(hosts, expected) {
		t.Fatalf("expected hosts %v, got %v", expected, hosts)
	}
}

func TestOpenAndPingMySQLWrapsReadableError(t *testing.T) {
	t.Parallel()

	_, err := openAndPingMySQL(DBConnectionInput{
		Host:         "127.0.0.1",
		Port:         1,
		DatabaseName: "kpos",
		Username:     "root",
		Password:     "secret",
	})
	if err == nil {
		t.Fatalf("expected connection error")
	}
	if !strings.HasPrefix(err.Error(), "connection failed:") {
		t.Fatalf("expected readable error prefix, got %q", err.Error())
	}
}

func TestDBConfigServiceGetDefaultConnectionInfoDelegatesToRuntime(t *testing.T) {
	t.Parallel()

	expected := &POSDBDefaultConnectionInfo{
		MerchantID:   "M100",
		Host:         "192.168.0.10",
		Port:         22108,
		DatabaseName: "kpos",
		Username:     "shohoku",
		PasswordSet:  true,
	}
	service := &DBConfigService{
		posDBRuntime: stubPOSDBRuntime{info: expected},
	}

	info, err := service.GetDefaultConnectionInfo("M100")
	if err != nil {
		t.Fatalf("GetDefaultConnectionInfo returned error: %v", err)
	}
	if !reflect.DeepEqual(info, expected) {
		t.Fatalf("info = %#v, want %#v", info, expected)
	}
}

func TestDBConfigServiceTestConnectionForMerchantUsesRuntimeConnection(t *testing.T) {
	t.Parallel()

	expectedInput := DBConnectionInput{
		Host:         "192.168.0.10",
		Port:         22108,
		DatabaseName: "kpos",
		Username:     "shohoku",
		Password:     "secret",
	}
	var received DBConnectionInput
	service := &DBConfigService{
		posDBRuntime: stubPOSDBRuntime{input: expectedInput},
		openAndPingMySQLFunc: func(input DBConnectionInput) (*sql.DB, error) {
			received = input
			return nil, nil
		},
	}

	err := service.TestConnectionForMerchant("M100")
	if err != nil {
		t.Fatalf("TestConnectionForMerchant returned error: %v", err)
	}
	if !reflect.DeepEqual(received, expectedInput) {
		t.Fatalf("received = %#v, want %#v", received, expectedInput)
	}
}

func repositoryTestDB(t *testing.T) *gorm.DB {
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

func seedRuntimeScanResult(t *testing.T, db *gorm.DB, merchantID, ip string) {
	t.Helper()

	deviceType := "PC"
	name := "POS Device"
	version := "1.0.0"
	now := time.Now()
	result := &models.ScanResult{
		IP:             ip,
		MerchantID:     &merchantID,
		Name:           &name,
		Version:        &version,
		Type:           &deviceType,
		ScannedAt:      now,
		IsOnline:       true,
		LastOnlineTime: now,
	}

	if err := db.Create(result).Error; err != nil {
		t.Fatalf("failed to seed runtime scan result %s: %v", merchantID, err)
	}
}
