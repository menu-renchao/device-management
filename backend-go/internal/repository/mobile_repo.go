package repository

import (
	"device-management/internal/models"
	"time"

	"gorm.io/gorm"
)

type MobileRepository struct {
	db *gorm.DB
}

func NewMobileRepository(db *gorm.DB) *MobileRepository {
	return &MobileRepository{db: db}
}

func (r *MobileRepository) Create(device *models.MobileDevice) error {
	return r.db.Create(device).Error
}

func (r *MobileRepository) GetByID(id uint) (*models.MobileDevice, error) {
	var device models.MobileDevice
	err := r.db.Preload("Occupier").Preload("Owner").First(&device, id).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *MobileRepository) Update(device *models.MobileDevice) error {
	return r.db.Save(device).Error
}

// UpdateOwner updates device owner
func (r *MobileRepository) UpdateOwner(deviceID uint, ownerID *uint) error {
	return r.db.Model(&models.MobileDevice{}).Where("id = ?", deviceID).Updates(map[string]interface{}{
		"owner_id":   ownerID,
		"updated_at": time.Now(),
	}).Error
}

func (r *MobileRepository) Delete(id uint) error {
	return r.db.Delete(&models.MobileDevice{}, id).Error
}

func (r *MobileRepository) List() ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	err := r.db.Preload("Occupier").Preload("Owner").Order("created_at DESC").Find(&devices).Error
	return devices, err
}

func (r *MobileRepository) ListExpiredOccupiedDevices(referenceTime time.Time) ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	err := r.db.
		Where("occupier_id IS NOT NULL AND end_time IS NOT NULL AND datetime(end_time) < datetime(?)", referenceTime).
		Order("end_time ASC, id ASC").
		Find(&devices).Error
	return devices, err
}

func (r *MobileRepository) CleanupExpiredOccupancies() (int64, error) {
	now := LocalTime()
	result := r.db.Model(&models.MobileDevice{}).
		Where("end_time IS NOT NULL AND datetime(end_time) < datetime(?)", now).
		Updates(map[string]interface{}{
			"occupier_id": nil,
			"purpose":     nil,
			"start_time":  nil,
			"end_time":    nil,
		})
	return result.RowsAffected, result.Error
}

func LocalTime() time.Time {
	return time.Now()
}

// ListOccupiedDevicesByUserID gets user's current borrowed devices
func (r *MobileRepository) ListOccupiedDevicesByUserID(userID uint) ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	err := r.db.Where("occupier_id = ? AND end_time IS NOT NULL AND datetime(end_time) > datetime(?)", userID, LocalTime()).Order("end_time ASC").Find(&devices).Error
	return devices, err
}

// ListDevicesByOwnerID gets devices owned by user
func (r *MobileRepository) ListDevicesByOwnerID(ownerID uint) ([]models.MobileDevice, error) {
	var devices []models.MobileDevice
	err := r.db.Where("owner_id = ?", ownerID).Order("created_at DESC").Find(&devices).Error
	return devices, err
}
