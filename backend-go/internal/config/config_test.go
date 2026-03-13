package config

import "testing"

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
