package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

const defaultCleanupDatabasePath = "../../data.db"

func main() {
	dbPath := strings.TrimSpace(os.Getenv("DATABASE_PATH"))
	if dbPath == "" {
		dbPath = defaultCleanupDatabasePath
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	matched, deleted, err := cleanupServiceExceptionRows(db)
	if err != nil {
		log.Fatalf("failed to cleanup service-exception rows: %v", err)
	}

	fmt.Printf("database: %s\n", dbPath)
	fmt.Printf("matched invalid rows: %d\n", matched)
	fmt.Printf("deleted invalid rows: %d\n", deleted)
}

func cleanupServiceExceptionRows(db *gorm.DB) (matched int64, deleted int64, err error) {
	query := db.Unscoped().
		Model(&models.ScanResult{}).
		Where("merchant_id IS NULL OR TRIM(merchant_id) = ''")

	if err := query.Count(&matched).Error; err != nil {
		return 0, 0, err
	}

	result := db.Exec("DELETE FROM scan_results WHERE merchant_id IS NULL OR TRIM(merchant_id) = ''")
	if result.Error != nil {
		return matched, 0, result.Error
	}

	return matched, result.RowsAffected, nil
}
