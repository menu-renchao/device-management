package services

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"device-management/internal/config"
)

func TestNewDBBackupServiceUsesShohokuDefaults(t *testing.T) {
	service := NewDBBackupService()

	if service.dbUser != "shohoku" {
		t.Fatalf("dbUser = %q, want %q", service.dbUser, "shohoku")
	}
	if service.dbPort != 22108 {
		t.Fatalf("dbPort = %d, want %d", service.dbPort, 22108)
	}
	if service.dbName != "kpos" {
		t.Fatalf("dbName = %q, want %q", service.dbName, "kpos")
	}
}

func TestNewDBBackupServiceUsesConfiguredPOSDatabaseWhenAvailable(t *testing.T) {
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

	service := NewDBBackupService()

	if service.dbPort != 3307 {
		t.Fatalf("dbPort = %d, want %d", service.dbPort, 3307)
	}
	if service.dbUser != "menu_user" {
		t.Fatalf("dbUser = %q, want %q", service.dbUser, "menu_user")
	}
	if service.dbPassword != "menu_pass" {
		t.Fatalf("dbPassword = %q, want %q", service.dbPassword, "menu_pass")
	}
	if service.dbName != "menu_db" {
		t.Fatalf("dbName = %q, want %q", service.dbName, "menu_db")
	}
}

func TestDBBackupServiceListBackupGroupsExcludesTargetAndSortsNewestFirst(t *testing.T) {
	rootDir := t.TempDir()

	writeDBBackupTestFile(t, filepath.Join(rootDir, "M123", "target_20260311_120000.sql"), "target", time.Unix(1700000000, 0))
	writeDBBackupTestFile(t, filepath.Join(rootDir, "M200", "2.0.0_20260312_080000.sql"), "old", time.Unix(1700100000, 0))
	writeDBBackupTestFile(t, filepath.Join(rootDir, "M200", "2.1.0_20260313_090000.sql"), "new", time.Unix(1700200000, 0))
	writeDBBackupTestFile(t, filepath.Join(rootDir, "M300", "ignore.txt"), "not-sql", time.Unix(1700300000, 0))
	writeDBBackupTestFile(t, filepath.Join(rootDir, "M300", "3.0.0_20260314_100000.sql"), "only", time.Unix(1700400000, 0))

	service := &DBBackupService{
		backupsRootDirFunc: func() string {
			return rootDir
		},
	}

	groups, err := service.ListBackupGroups([]string{"M123", "M200", "M300"}, "M123")
	if err != nil {
		t.Fatalf("ListBackupGroups() error = %v", err)
	}

	if len(groups) != 2 {
		t.Fatalf("len(groups) = %d, want 2", len(groups))
	}
	if groups[0].SourceMerchantID != "M200" {
		t.Fatalf("groups[0].SourceMerchantID = %q, want %q", groups[0].SourceMerchantID, "M200")
	}
	if len(groups[0].Items) != 2 {
		t.Fatalf("len(groups[0].Items) = %d, want 2", len(groups[0].Items))
	}
	if groups[0].Items[0].Name != "2.1.0_20260313_090000.sql" {
		t.Fatalf("groups[0].Items[0].Name = %q, want newest file first", groups[0].Items[0].Name)
	}
	if groups[1].SourceMerchantID != "M300" {
		t.Fatalf("groups[1].SourceMerchantID = %q, want %q", groups[1].SourceMerchantID, "M300")
	}
	if len(groups[1].Items) != 1 || groups[1].Items[0].Name != "3.0.0_20260314_100000.sql" {
		t.Fatalf("groups[1].Items = %#v, want only SQL file", groups[1].Items)
	}
}

func TestDBBackupServiceRestoreFromMerchantBackupFileUsesSourceMerchantPath(t *testing.T) {
	rootDir := t.TempDir()
	expectedPath := filepath.Join(rootDir, "M200", "2.0.0_20260312_080000.sql")
	writeDBBackupTestFile(t, expectedPath, "source", time.Unix(1700100000, 0))

	var gotHost string
	var gotPath string
	service := &DBBackupService{
		backupsRootDirFunc: func() string {
			return rootDir
		},
		restoreFromFileFunc: func(host, filePath string) error {
			gotHost = host
			gotPath = filePath
			return nil
		},
	}

	err := service.RestoreFromMerchantBackupFile("10.0.0.8", "M200", "2.0.0_20260312_080000.sql")
	if err != nil {
		t.Fatalf("RestoreFromMerchantBackupFile() error = %v", err)
	}
	if gotHost != "10.0.0.8" {
		t.Fatalf("restore host = %q, want %q", gotHost, "10.0.0.8")
	}
	if gotPath != expectedPath {
		t.Fatalf("restore path = %q, want %q", gotPath, expectedPath)
	}
}

func writeDBBackupTestFile(t *testing.T, path, content string, modTime time.Time) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := os.Chtimes(path, modTime, modTime); err != nil {
		t.Fatalf("Chtimes() error = %v", err)
	}
}
