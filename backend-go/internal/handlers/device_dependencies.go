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

var _ licenseBackupManager = (*services.LicenseService)(nil)
var _ dbBackupManager = (*services.DBBackupService)(nil)
