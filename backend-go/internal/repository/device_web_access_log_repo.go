package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type DeviceWebAccessLogRepository struct {
	db *gorm.DB
}

func NewDeviceWebAccessLogRepository(db *gorm.DB) *DeviceWebAccessLogRepository {
	return &DeviceWebAccessLogRepository{db: db}
}

func (r *DeviceWebAccessLogRepository) Create(log *models.DeviceWebAccessLog) error {
	return r.db.Create(log).Error
}
