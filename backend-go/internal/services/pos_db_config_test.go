package services

import (
	"testing"

	"device-management/internal/config"
)

func TestResolvePOSDBConnectionConfigUsesAppConfigWhenAvailable(t *testing.T) {
	previousConfig := config.AppConfig
	t.Cleanup(func() {
		config.AppConfig = previousConfig
	})

	config.AppConfig = &config.Config{
		POSDatabase: config.POSDatabaseConfig{
			Port:     3307,
			User:     "menu_user",
			Password: "menu_pass",
			Name:     "menu_db",
		},
	}

	got := resolvePOSDBConnectionConfig(22108, "shohoku", "legacy_pass", "kpos")

	if got.Port != 3307 {
		t.Fatalf("Port = %d, want 3307", got.Port)
	}
	if got.User != "menu_user" {
		t.Fatalf("User = %q, want menu_user", got.User)
	}
	if got.Password != "menu_pass" {
		t.Fatalf("Password = %q, want menu_pass", got.Password)
	}
	if got.Name != "menu_db" {
		t.Fatalf("Name = %q, want menu_db", got.Name)
	}
}

func TestResolvePOSDBConnectionConfigFallsBackToDefaults(t *testing.T) {
	previousConfig := config.AppConfig
	t.Cleanup(func() {
		config.AppConfig = previousConfig
	})

	config.AppConfig = nil

	got := resolvePOSDBConnectionConfig(22108, "shohoku", "legacy_pass", "kpos")

	if got.Port != 22108 || got.User != "shohoku" || got.Password != "legacy_pass" || got.Name != "kpos" {
		t.Fatalf("unexpected fallback config: %+v", got)
	}
}
