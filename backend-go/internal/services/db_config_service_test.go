package services

import (
	"reflect"
	"strings"
	"testing"

	"device-management/internal/models"
	appcrypto "device-management/pkg/crypto"
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

func TestResolveTestConnectionInputRequiresExplicitSavedPasswordOptIn(t *testing.T) {
	t.Parallel()

	encrypted, err := appcrypto.EncryptPassword("saved-secret", "db-config-default-secret")
	if err != nil {
		t.Fatalf("encrypt password: %v", err)
	}

	service := &DBConfigService{}
	_, err = service.resolveTestConnectionInput(DBConnectionInput{}, &models.DeviceDBConnection{
		MerchantID:        "M100",
		DBType:            "mysql",
		Host:              "192.168.0.147",
		Port:              22108,
		DatabaseName:      "kpos",
		Username:          "root",
		PasswordEncrypted: encrypted,
	})
	if err == nil {
		t.Fatalf("expected error when saved password is not explicitly requested")
	}
	if err.Error() != "database password is required, or set use_saved_password=true" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResolveTestConnectionInputUsesSavedPasswordWhenExplicitlyRequested(t *testing.T) {
	t.Parallel()

	encrypted, err := appcrypto.EncryptPassword("saved-secret", "db-config-default-secret")
	if err != nil {
		t.Fatalf("encrypt password: %v", err)
	}

	service := &DBConfigService{}
	resolved, err := service.resolveTestConnectionInput(DBConnectionInput{
		UseSavedPassword: true,
	}, &models.DeviceDBConnection{
		MerchantID:        "M100",
		DBType:            "mysql",
		Host:              "192.168.0.147",
		Port:              22108,
		DatabaseName:      "kpos",
		Username:          "root",
		PasswordEncrypted: encrypted,
	})
	if err != nil {
		t.Fatalf("resolve test connection input: %v", err)
	}

	if resolved.Password != "saved-secret" {
		t.Fatalf("expected saved password to be used, got %q", resolved.Password)
	}
	if resolved.Host != "192.168.0.147" {
		t.Fatalf("expected host to be filled from existing connection, got %q", resolved.Host)
	}
	if resolved.Username != "root" {
		t.Fatalf("expected username to be filled from existing connection, got %q", resolved.Username)
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
