package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newLicenseServiceForStorageTest(t *testing.T) *LicenseService {
	t.Helper()

	rootDir := t.TempDir()
	service := NewLicenseService()
	service.backupsRootDirFunc = func() string {
		return rootDir
	}
	service.importFunc = func(host, sqlContent string) (*LicenseImportResult, error) {
		return &LicenseImportResult{ExecutedCount: len(SplitSQLStatements(sqlContent))}, nil
	}
	service.backupFunc = func(host string) (*LicenseBackupResult, error) {
		return &LicenseBackupResult{
			FileName: "LicenseM123_20260311_120000.sql",
			Content:  []byte("UPDATE company_profile SET name = 'demo';"),
		}, nil
	}

	return service
}

func writeLicenseBackupTestFile(t *testing.T, dir, name, content string, modTime time.Time) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := os.Chtimes(path, modTime, modTime); err != nil {
		t.Fatalf("Chtimes() error = %v", err)
	}
}

func TestLicenseBackupStorageListBackupsSortsDescending(t *testing.T) {
	service := newLicenseServiceForStorageTest(t)
	merchantDir, err := service.ensureMerchantDir("M123")
	if err != nil {
		t.Fatalf("ensureMerchantDir() error = %v", err)
	}

	now := time.Now()
	writeLicenseBackupTestFile(t, merchantDir, "LicenseM123_20260310_120000.sql", "SELECT 1;", now.Add(-2*time.Hour))
	writeLicenseBackupTestFile(t, merchantDir, "LicenseM123_20260311_120000.sql", "SELECT 2;", now.Add(-time.Hour))
	writeLicenseBackupTestFile(t, merchantDir, "ignore.txt", "skip", now)

	items, err := service.ListBackups("M123")
	if err != nil {
		t.Fatalf("ListBackups() error = %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
	if items[0].Name != "LicenseM123_20260311_120000.sql" {
		t.Fatalf("items[0].Name = %q, want newest file first", items[0].Name)
	}
	if items[1].Name != "LicenseM123_20260310_120000.sql" {
		t.Fatalf("items[1].Name = %q, want older file second", items[1].Name)
	}
}

func TestLicenseBackupStorageDeleteBackupRejectsIllegalFileName(t *testing.T) {
	service := newLicenseServiceForStorageTest(t)

	err := service.DeleteBackup("M123", "../evil.sql")
	if err == nil {
		t.Fatalf("DeleteBackup() error = nil, want invalid filename error")
	}
}

func TestLicenseBackupStorageOpenBackupFileOnlyAllowsSQLFiles(t *testing.T) {
	service := newLicenseServiceForStorageTest(t)
	merchantDir, err := service.ensureMerchantDir("M123")
	if err != nil {
		t.Fatalf("ensureMerchantDir() error = %v", err)
	}

	writeLicenseBackupTestFile(t, merchantDir, "LicenseM123_20260311_120000.sql", "SELECT 1;", time.Now())

	file, size, err := service.OpenBackupFile("M123", "LicenseM123_20260311_120000.sql")
	if err != nil {
		t.Fatalf("OpenBackupFile() error = %v", err)
	}
	defer file.Close()
	if size <= 0 {
		t.Fatalf("size = %d, want > 0", size)
	}

	_, _, err = service.OpenBackupFile("M123", "not-sql.txt")
	if err == nil {
		t.Fatalf("OpenBackupFile() error = nil, want extension validation error")
	}
}

func TestLicenseBackupStorageRestoreFromServerFileUsesStoredSQL(t *testing.T) {
	service := newLicenseServiceForStorageTest(t)
	merchantDir, err := service.ensureMerchantDir("M123")
	if err != nil {
		t.Fatalf("ensureMerchantDir() error = %v", err)
	}

	writeLicenseBackupTestFile(t, merchantDir, "LicenseM123_20260311_120000.sql", "UPDATE a SET b = 1;", time.Now())

	var importedHost string
	var importedSQL string
	service.importFunc = func(host, sqlContent string) (*LicenseImportResult, error) {
		importedHost = host
		importedSQL = sqlContent
		return &LicenseImportResult{ExecutedCount: 1}, nil
	}

	if err := service.RestoreFromServerFile("10.0.0.8", "M123", "LicenseM123_20260311_120000.sql"); err != nil {
		t.Fatalf("RestoreFromServerFile() error = %v", err)
	}
	if importedHost != "10.0.0.8" {
		t.Fatalf("importedHost = %q, want 10.0.0.8", importedHost)
	}
	if strings.TrimSpace(importedSQL) != "UPDATE a SET b = 1;" {
		t.Fatalf("importedSQL = %q, want file contents", importedSQL)
	}
}

