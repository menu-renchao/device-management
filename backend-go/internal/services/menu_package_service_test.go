package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestMenuPackageServiceListPackagesOnlyIncludesSQLPackages(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	merchantDir := filepath.Join(rootDir, "M123")
	if err := os.MkdirAll(merchantDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	sqlPath := filepath.Join(merchantDir, "M123_1.0.0_20260323_120000.menupack.sql")
	jsonPath := filepath.Join(merchantDir, "M123_1.0.0_20260323_120100.menupack.json")
	ignorePath := filepath.Join(merchantDir, "ignore.txt")

	if err := os.WriteFile(sqlPath, []byte("SELECT 1;"), 0644); err != nil {
		t.Fatalf("WriteFile(sql) error = %v", err)
	}
	if err := os.WriteFile(jsonPath, []byte(`{"legacy":true}`), 0644); err != nil {
		t.Fatalf("WriteFile(json) error = %v", err)
	}
	if err := os.WriteFile(ignorePath, []byte("skip"), 0644); err != nil {
		t.Fatalf("WriteFile(ignore) error = %v", err)
	}

	now := time.Now()
	if err := os.Chtimes(sqlPath, now, now); err != nil {
		t.Fatalf("Chtimes(sql) error = %v", err)
	}

	service := NewMenuPackageService()
	service.packagesRootDirFunc = func() string {
		return rootDir
	}

	items, err := service.ListPackages("M123")
	if err != nil {
		t.Fatalf("ListPackages() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len(items) = %d, want 1", len(items))
	}
	if items[0].Name != filepath.Base(sqlPath) {
		t.Fatalf("items[0].Name = %q, want SQL package", items[0].Name)
	}
}

func TestMenuPackageServiceResolvePackagePathRejectsLegacyJSONPackage(t *testing.T) {
	t.Parallel()

	service := NewMenuPackageService()
	if _, err := service.resolvePackagePath("M123", "M123_1.0.0_20260323_120000.menupack.json"); err == nil {
		t.Fatalf("resolvePackagePath() error = nil, want legacy JSON package rejected")
	}
}

func TestMenuPackageServiceImportFromFileRejectsLegacyJSONPackage(t *testing.T) {
	t.Parallel()

	service := NewMenuPackageService()
	if err := service.importFromFile("127.0.0.1", "legacy.menupack.json"); err == nil {
		t.Fatalf("importFromFile() error = nil, want legacy JSON package rejected")
	}
}

func TestMenuDomainSpecIncludesInventoryTables(t *testing.T) {
	t.Parallel()

	spec := NewMenuDomainSpec()
	requiredTables := []string{
		"inventory_count_record",
		"inventory_item",
		"inventory_item_change_record",
		"inventory_item_group",
		"inventory_location",
		"inventory_vendor",
	}

	for _, table := range requiredTables {
		if !spec.AllowsTable(table) {
			t.Fatalf("AllowsTable(%q) = false, want true", table)
		}
	}
}

func TestMenuPackageServicePreludeClearsInventoryTables(t *testing.T) {
	t.Parallel()

	service := NewMenuPackageService()
	prelude := service.menuImportPreludeSQL()

	expectedStatements := []string{
		"DELETE FROM `inventory_count_record`;",
		"DELETE FROM `inventory_item_change_record`;",
		"DELETE FROM `inventory_item`;",
		"DELETE FROM `inventory_item_group`;",
		"DELETE FROM `inventory_location`;",
		"DELETE FROM `inventory_vendor`;",
	}

	for _, statement := range expectedStatements {
		if !strings.Contains(prelude, statement) {
			t.Fatalf("menuImportPreludeSQL() missing %q", statement)
		}
	}
}
