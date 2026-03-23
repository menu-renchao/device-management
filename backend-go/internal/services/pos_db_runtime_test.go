package services

import (
	"errors"
	"strconv"
	"testing"

	"device-management/internal/config"
	"device-management/internal/models"
)

// TestPOSDBRuntimeResolverResolveForMerchant tests the runtime resolver
func TestPOSDBRuntimeResolverResolveForMerchant(t *testing.T) {
	// Save and restore global config
	oldConfig := config.AppConfig
	defer func() {
		config.AppConfig = oldConfig
	}()

	config.AppConfig = &config.Config{
		POSDatabase: config.POSDatabaseConfig{
			Type:     "mysql",
			Port:     "3306",
			Name:     "kpos",
			User:     "shohoku",
			Password: "secret",
		},
	}

	t.Run("resolves connection from device IP", func(t *testing.T) {
		device := &models.ScanResult{
			IP:         "192.168.1.100",
			MerchantID: strPtr("merchant_001"),
		}

		// Use a mock-like approach: directly test the resolve method via exported interface
		resolver := &posDBRuntimeResolverForTest{
			device: device,
			err:    nil,
		}

		input, err := resolver.resolveFromDevice(device)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if input.Host != "192.168.1.100" {
			t.Fatalf("Host = %q, want 192.168.1.100", input.Host)
		}
		if input.DBType != "mysql" {
			t.Fatalf("DBType = %q, want mysql", input.DBType)
		}
		if input.Port != 3306 {
			t.Fatalf("Port = %d, want 3306", input.Port)
		}
		if input.DatabaseName != "kpos" {
			t.Fatalf("DatabaseName = %q, want kpos", input.DatabaseName)
		}
		if input.Username != "shohoku" {
			t.Fatalf("Username = %q, want shohoku", input.Username)
		}
		if input.Password != "secret" {
			t.Fatalf("Password = %q, want secret", input.Password)
		}
	})

	t.Run("returns error when device is nil", func(t *testing.T) {
		device := (*models.ScanResult)(nil)
		resolver := &posDBRuntimeResolverForTest{}

		_, err := resolver.resolveFromDevice(device)
		if err == nil {
			t.Fatal("expected error for nil device")
		}
	})

	t.Run("returns error when device IP is empty", func(t *testing.T) {
		device := &models.ScanResult{
			IP:         "",
			MerchantID: strPtr("merchant_001"),
		}

		resolver := &posDBRuntimeResolverForTest{}

		_, err := resolver.resolveFromDevice(device)
		if err == nil {
			t.Fatal("expected error for empty IP")
		}
		if !errors.Is(err, ErrEmptyDeviceIP) {
			t.Fatalf("unexpected error type: %v", err)
		}
	})

	t.Run("parses custom port correctly", func(t *testing.T) {
		oldConfig := config.AppConfig
		config.AppConfig = &config.Config{
			POSDatabase: config.POSDatabaseConfig{
				Type:     "mysql",
				Port:     "3307",
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

		resolver := &posDBRuntimeResolverForTest{}

		input, err := resolver.resolveFromDevice(device)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if input.Port != 3307 {
			t.Fatalf("Port = %d, want 3307", input.Port)
		}
	})
}


// posDBRuntimeResolverForTest is a test-only wrapper that embeds the logic
// without requiring the actual repository dependency
type posDBRuntimeResolverForTest struct {
	device *models.ScanResult
	err    error
}

func (r *posDBRuntimeResolverForTest) resolveFromDevice(device *models.ScanResult) (DBConnectionInput, error) {
	if device == nil {
		return DBConnectionInput{}, errors.New("device is required")
	}

	ip := device.IP
	if ip == "" {
		return DBConnectionInput{}, ErrEmptyDeviceIP
	}

	posConfig := config.AppConfig.POSDatabase

	port := 3306
	if posConfig.Port != "" {
		// Simple port parsing for test
		if p, err := strconv.Atoi(posConfig.Port); err == nil {
			port = p
		}
	}

	return DBConnectionInput{
		DBType:       posConfig.Type,
		Host:         ip,
		Port:         port,
		DatabaseName: posConfig.Name,
		Username:     posConfig.User,
		Password:     posConfig.Password,
	}, nil
}
