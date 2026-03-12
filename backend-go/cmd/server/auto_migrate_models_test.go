package main

import (
	"reflect"
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
