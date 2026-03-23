package handlers

import (
	"os"

	"device-management/internal/services"
)

type licenseBackupManager interface {
	Backup(host string) (*services.LicenseBackupResult, error)
	CreateBackup(host, merchantID string) (*services.LicenseBackupFileInfo, error)
	ListBackups(merchantID string) ([]services.LicenseBackupFileInfo, error)
	OpenBackupFile(merchantID, fileName string) (*os.File, int64, error)
	DeleteBackup(merchantID, fileName string) error
	RestoreFromServerFile(host, merchantID, fileName string) error
	Import(host, sqlContent string) (*services.LicenseImportResult, error)
}

type dbBackupManager interface {
	CreateBackup(host, merchantID, version string) (*services.DBBackupFileInfo, error)
	ListBackups(merchantID string) ([]services.DBBackupFileInfo, error)
	ListBackupGroups(merchantIDs []string, excludeMerchantID string) ([]services.DBBackupGroup, error)
	OpenBackupFile(merchantID, fileName string) (*os.File, int64, error)
	DeleteBackup(merchantID, fileName string) error
	RestoreFromServerFile(host, merchantID, fileName string) error
	RestoreFromMerchantBackupFile(host, sourceMerchantID, fileName string) error
	RestoreFromUploadFile(host, filePath string) error
}

type menuPackageManager interface {
	CreatePackage(host, merchantID, version string) (*services.MenuPackageFileInfo, error)
	ListPackages(merchantID string) ([]services.MenuPackageFileInfo, error)
	ListPackageGroups(merchantIDs []string, excludeMerchantID string) ([]services.MenuPackageGroup, error)
	OpenPackageFile(merchantID, fileName string) (*os.File, int64, error)
	DeletePackage(merchantID, fileName string) error
	ImportFromServerPackage(host, merchantID, fileName string) error
	ImportFromUploadPackage(host, filePath string) error
}

var _ licenseBackupManager = (*services.LicenseService)(nil)
var _ dbBackupManager = (*services.DBBackupService)(nil)
var _ menuPackageManager = (*services.MenuPackageService)(nil)
