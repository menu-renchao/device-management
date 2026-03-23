package services

import (
	"testing"

	"device-management/internal/config"
	"device-management/internal/repository"
)

func TestPOSDBRuntimeResolveUsesDeviceIPAndGlobalDefaults(t *testing.T) {
	db := repositoryTestDB(t)
	deviceRepo := repository.NewDeviceRepository(db)
	seedRuntimeScanResult(t, db, "M100", "192.168.0.88")

	originalConfig := config.AppConfig
	config.AppConfig = &config.Config{
		POSDatabase: config.POSDatabaseConfig{
			Port:     22108,
			User:     "shohoku",
			Password: "secret",
			Name:     "kpos",
		},
	}
	t.Cleanup(func() {
		config.AppConfig = originalConfig
	})

	runtime := NewPOSDBRuntime(deviceRepo)
	input, err := runtime.Resolve("M100")
	if err != nil {
		t.Fatalf("Resolve returned error: %v", err)
	}

	if input.Host != "192.168.0.88" {
		t.Fatalf("input.Host = %q, want 192.168.0.88", input.Host)
	}
	if input.Port != 22108 {
		t.Fatalf("input.Port = %d, want 22108", input.Port)
	}
	if input.Username != "shohoku" {
		t.Fatalf("input.Username = %q, want shohoku", input.Username)
	}
	if input.Password != "secret" {
		t.Fatalf("input.Password = %q, want secret", input.Password)
	}
	if input.DatabaseName != "kpos" {
		t.Fatalf("input.DatabaseName = %q, want kpos", input.DatabaseName)
	}
}

func TestPOSDBRuntimeGetDefaultConnectionInfoMasksPassword(t *testing.T) {
	db := repositoryTestDB(t)
	deviceRepo := repository.NewDeviceRepository(db)
	seedRuntimeScanResult(t, db, "M200", "10.0.0.7")

	originalConfig := config.AppConfig
	config.AppConfig = &config.Config{
		POSDatabase: config.POSDatabaseConfig{
			Port:     3307,
			User:     "default-user",
			Password: "secret",
			Name:     "default-db",
		},
	}
	t.Cleanup(func() {
		config.AppConfig = originalConfig
	})

	runtime := NewPOSDBRuntime(deviceRepo)
	info, err := runtime.GetDefaultConnectionInfo("M200")
	if err != nil {
		t.Fatalf("GetDefaultConnectionInfo returned error: %v", err)
	}

	if info.PasswordSet != true {
		t.Fatalf("info.PasswordSet = %v, want true", info.PasswordSet)
	}
	if info.Host != "10.0.0.7" {
		t.Fatalf("info.Host = %q, want 10.0.0.7", info.Host)
	}
}

func TestPOSDBRuntimeResolveRejectsUnknownMerchant(t *testing.T) {
	db := repositoryTestDB(t)
	deviceRepo := repository.NewDeviceRepository(db)

	runtime := NewPOSDBRuntime(deviceRepo)
	_, err := runtime.Resolve("M404")
	if err == nil {
		t.Fatal("expected error for unknown merchant")
	}
}
