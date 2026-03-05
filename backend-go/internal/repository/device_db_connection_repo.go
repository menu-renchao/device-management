package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type DeviceDBConnectionRepository struct {
	db *gorm.DB
}

func NewDeviceDBConnectionRepository(db *gorm.DB) *DeviceDBConnectionRepository {
	return &DeviceDBConnectionRepository{db: db}
}

func (r *DeviceDBConnectionRepository) GetByMerchantID(merchantID string) (*models.DeviceDBConnection, error) {
	var conn models.DeviceDBConnection
	err := r.db.Where("merchant_id = ?", merchantID).First(&conn).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &conn, nil
}

func (r *DeviceDBConnectionRepository) Upsert(conn *models.DeviceDBConnection) error {
	existing, err := r.GetByMerchantID(conn.MerchantID)
	if err != nil {
		return err
	}
	if existing == nil {
		return r.db.Create(conn).Error
	}

	existing.DBType = conn.DBType
	existing.Host = conn.Host
	existing.Port = conn.Port
	existing.DatabaseName = conn.DatabaseName
	existing.Username = conn.Username
	existing.PasswordEncrypted = conn.PasswordEncrypted
	existing.UpdatedBy = conn.UpdatedBy
	return r.db.Save(existing).Error
}
