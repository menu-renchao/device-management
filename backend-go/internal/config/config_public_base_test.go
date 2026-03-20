package config

import "testing"

func TestInitLoadsPublicBaseURL(t *testing.T) {
	oldConfig := AppConfig
	defer func() {
		AppConfig = oldConfig
	}()

	t.Setenv("PUBLIC_BASE_URL", "https://device.example.com")

	if err := Init(); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}

	if AppConfig.Server.PublicBaseURL != "https://device.example.com" {
		t.Fatalf("PublicBaseURL = %q, want https://device.example.com", AppConfig.Server.PublicBaseURL)
	}
}
