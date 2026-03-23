package config

import "testing"

func TestInitLoadsPOSDatabaseConfig(t *testing.T) {
	oldConfig := AppConfig
	defer func() {
		AppConfig = oldConfig
	}()

	t.Setenv("POS_DB_TYPE", "mysql")
	t.Setenv("POS_DB_PORT", "3307")
	t.Setenv("POS_DB_NAME", "pos_db")
	t.Setenv("POS_DB_USER", "pos_user")
	t.Setenv("POS_DB_PASSWORD", "pos_secret")

	if err := Init(); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}

	if AppConfig.POSDatabase.Type != "mysql" {
		t.Fatalf("POSDatabase.Type = %q, want mysql", AppConfig.POSDatabase.Type)
	}
	if AppConfig.POSDatabase.Port != "3307" {
		t.Fatalf("POSDatabase.Port = %q, want 3307", AppConfig.POSDatabase.Port)
	}
	if AppConfig.POSDatabase.Name != "pos_db" {
		t.Fatalf("POSDatabase.Name = %q, want pos_db", AppConfig.POSDatabase.Name)
	}
	if AppConfig.POSDatabase.User != "pos_user" {
		t.Fatalf("POSDatabase.User = %q, want pos_user", AppConfig.POSDatabase.User)
	}
	if AppConfig.POSDatabase.Password != "pos_secret" {
		t.Fatalf("POSDatabase.Password = %q, want pos_secret", AppConfig.POSDatabase.Password)
	}
}

func TestInitLoadsBootstrapAdminConfig(t *testing.T) {
	oldConfig := AppConfig
	defer func() {
		AppConfig = oldConfig
	}()

	t.Setenv("BOOTSTRAP_ADMIN_USERNAME", "root-admin")
	t.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "secret123")
	t.Setenv("BOOTSTRAP_ADMIN_EMAIL", "root@example.com")
	t.Setenv("BOOTSTRAP_ADMIN_NAME", "Root Admin")

	if err := Init(); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}

	if !AppConfig.BootstrapAdmin.IsConfigured() {
		t.Fatalf("expected bootstrap admin to be configured")
	}
	if AppConfig.BootstrapAdmin.Username != "root-admin" {
		t.Fatalf("Username = %q, want root-admin", AppConfig.BootstrapAdmin.Username)
	}
}

func TestInitRejectsPartialBootstrapAdminConfig(t *testing.T) {
	oldConfig := AppConfig
	defer func() {
		AppConfig = oldConfig
	}()

	t.Setenv("BOOTSTRAP_ADMIN_USERNAME", "root-admin")
	t.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "")

	err := Init()
	if err == nil {
		t.Fatalf("expected Init to fail with partial bootstrap config")
	}
	if err != ErrInvalidBootstrapAdminConfig {
		t.Fatalf("unexpected error: %v", err)
	}
}
