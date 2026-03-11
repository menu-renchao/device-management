package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type AutoScanConfigRepository struct {
	db *gorm.DB
}

func NewAutoScanConfigRepository(db *gorm.DB) *AutoScanConfigRepository {
	return &AutoScanConfigRepository{db: db}
}

func (r *AutoScanConfigRepository) GetOrCreateDefault() (*models.AutoScanConfig, error) {
	var config models.AutoScanConfig
	err := r.db.First(&config).Error
	if err == nil {
		return &config, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	config = models.AutoScanConfig{
		Enabled:               false,
		IntervalMinutes:       60,
		Port:                  22080,
		ConnectTimeoutSeconds: 2,
		RequestTimeoutSeconds: 5,
		MaxProbeWorkers:       200,
		MaxFetchWorkers:       100,
	}
	if err := config.SetCIDRBlocks([]string{}); err != nil {
		return nil, err
	}
	if err := r.db.Create(&config).Error; err != nil {
		return nil, err
	}

	return &config, nil
}

func (r *AutoScanConfigRepository) Update(config *models.AutoScanConfig) error {
	return r.db.Save(config).Error
}
