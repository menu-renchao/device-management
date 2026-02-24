package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type SystemConfigRepository struct {
	db *gorm.DB
}

func NewSystemConfigRepository(db *gorm.DB) *SystemConfigRepository {
	return &SystemConfigRepository{db: db}
}

func (r *SystemConfigRepository) GetByKey(key string) (*models.SystemConfig, error) {
	var config models.SystemConfig
	err := r.db.Where("key = ?", key).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *SystemConfigRepository) Upsert(key, value string) error {
	var config models.SystemConfig
	result := r.db.Where("key = ?", key).First(&config)
	if result.Error == gorm.ErrRecordNotFound {
		config = models.SystemConfig{Key: key, Value: value}
		return r.db.Create(&config).Error
	}
	config.Value = value
	return r.db.Save(&config).Error
}

func (r *SystemConfigRepository) GetAll() ([]models.SystemConfig, error) {
	var configs []models.SystemConfig
	err := r.db.Find(&configs).Error
	return configs, err
}
