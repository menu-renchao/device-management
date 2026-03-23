package services

import (
	"reflect"
	"strings"
	"testing"

	"device-management/internal/config"
	"device-management/internal/models"
)

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

func TestDBConfigServiceResolveConnectionFromDevice(t *testing.T) {
	// Set up config
	oldConfig := config.AppConfig
	defer func() {
		config.AppConfig = oldConfig
	}()

	config.AppConfig = &config.Config{
		POSDatabase: config.POSDatabaseConfig{
			Type:     "mysql",
			Port:     "22108",
			Name:     "kpos",
			User:     "shohoku",
			Password: "runtime-secret",
		},
	}

	t.Run("resolves connection info from device IP", func(t *testing.T) {
		device := &models.ScanResult{
			IP:         "192.168.1.100",
			MerchantID: strPtr("merchant_001"),
		}

		service := &DBConfigService{}
		connInfo, err := service.resolveConnectionFromDevice(device)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if connInfo.Host != "192.168.1.100" {
			t.Fatalf("Host = %q, want 192.168.1.100", connInfo.Host)
		}
		if connInfo.DBType != "mysql" {
			t.Fatalf("DBType = %q, want mysql", connInfo.DBType)
		}
		if connInfo.Port != 22108 {
			t.Fatalf("Port = %d, want 22108", connInfo.Port)
		}
		if connInfo.DatabaseName != "kpos" {
			t.Fatalf("DatabaseName = %q, want kpos", connInfo.DatabaseName)
		}
		if connInfo.Username != "shohoku" {
			t.Fatalf("Username = %q, want shohoku", connInfo.Username)
		}
		if !connInfo.HasPassword {
			t.Fatal("HasPassword should be true")
		}
	})

	t.Run("returns error when device is nil", func(t *testing.T) {
		service := &DBConfigService{}
		_, err := service.resolveConnectionFromDevice(nil)
		if err == nil {
			t.Fatal("expected error for nil device")
		}
	})

	t.Run("returns error when device IP is empty", func(t *testing.T) {
		device := &models.ScanResult{
			IP:         "",
			MerchantID: strPtr("merchant_001"),
		}

		service := &DBConfigService{}
		_, err := service.resolveConnectionFromDevice(device)
		if err == nil {
			t.Fatal("expected error for empty IP")
		}
	})

	t.Run("uses default port when not specified", func(t *testing.T) {
		oldConfig := config.AppConfig
		config.AppConfig = &config.Config{
			POSDatabase: config.POSDatabaseConfig{
				Type:     "mysql",
				Port:     "",
				Name:     "kpos",
				User:     "shohoku",
				Password: "secret",
			},
		}
		defer func() {
			config.AppConfig = oldConfig
		}()

		device := &models.ScanResult{
			IP:         "192.168.1.100",
			MerchantID: strPtr("merchant_001"),
		}

		service := &DBConfigService{}
		connInfo, err := service.resolveConnectionFromDevice(device)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if connInfo.Port != 3306 {
			t.Fatalf("Port = %d, want default 3306", connInfo.Port)
		}
	})
}

func strPtr(s string) *string {
	return &s
}
