package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type ScanJobLogRepository struct {
	db *gorm.DB
}

func NewScanJobLogRepository(db *gorm.DB) *ScanJobLogRepository {
	return &ScanJobLogRepository{db: db}
}

func (r *ScanJobLogRepository) Create(log *models.ScanJobLog) error {
	return r.db.Create(log).Error
}

func (r *ScanJobLogRepository) Update(log *models.ScanJobLog) error {
	return r.db.Save(log).Error
}

func (r *ScanJobLogRepository) GetByID(id uint) (*models.ScanJobLog, error) {
	var log models.ScanJobLog
	if err := r.db.First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *ScanJobLogRepository) List(page, pageSize int) ([]models.ScanJobLog, int64, error) {
	var logs []models.ScanJobLog
	var total int64

	query := r.db.Model(&models.ScanJobLog{})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	err := query.Order("started_at DESC, id DESC").Offset(offset).Limit(pageSize).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

func (r *ScanJobLogRepository) LatestAutoRun() (*models.ScanJobLog, error) {
	var log models.ScanJobLog
	if err := r.db.Where("trigger_type = ?", "auto").Order("started_at DESC, id DESC").First(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *ScanJobLogRepository) PruneAutoRuns(limit int) error {
	if limit <= 0 {
		return nil
	}

	subQuery := r.db.Model(&models.ScanJobLog{}).
		Select("id").
		Where("trigger_type = ?", "auto").
		Order("started_at DESC, id DESC").
		Limit(limit)

	return r.db.
		Where("trigger_type = ?", "auto").
		Where("id NOT IN (?)", subQuery).
		Delete(&models.ScanJobLog{}).Error
}
