package main

import (
	"os"
	"reflect"
	"strings"
	"testing"

	"device-management/internal/models"
)

func TestAutoMigrateModelsExcludeLegacyBorrowTables(t *testing.T) {
	modelsToMigrate := autoMigrateModels()

	for _, model := range modelsToMigrate {
		modelType := reflect.TypeOf(model)
		if modelType == reflect.TypeOf(&models.DeviceBorrowRequest{}) {
			t.Fatalf("legacy model DeviceBorrowRequest should not participate in AutoMigrate")
		}
		if modelType == reflect.TypeOf(&models.MobileBorrowRequest{}) {
			t.Fatalf("legacy model MobileBorrowRequest should not participate in AutoMigrate")
		}
	}
}

func TestMainDoesNotInvokeLegacyBorrowMigration(t *testing.T) {
	contentBytes, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	if strings.Contains(string(contentBytes), "MigrateLegacyBorrowRequests") {
		t.Fatalf("main.go should not invoke legacy borrow migration once old tables are retired")
	}
}

func TestMainDoesNotInvokePOSDefaultPropertyBackfill(t *testing.T) {
	contentBytes, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	if strings.Contains(string(contentBytes), "backfillPOSDefaultProperties(db)") {
		t.Fatalf("main.go should not backfill POS default properties at runtime")
	}
}

func TestAutoMigrateModelsExcludesDeviceDBConnection(t *testing.T) {
	modelsToMigrate := autoMigrateModels()

	for _, model := range modelsToMigrate {
		modelType := reflect.TypeOf(model).Elem()
		if modelType.Name() == "DeviceDBConnection" {
			t.Fatalf("DeviceDBConnection should not participate in AutoMigrate")
		}
	}
}
