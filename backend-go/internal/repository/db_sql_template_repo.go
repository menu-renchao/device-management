package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type DBSQLTemplateRepository struct {
	db *gorm.DB
}

func NewDBSQLTemplateRepository(db *gorm.DB) *DBSQLTemplateRepository {
	return &DBSQLTemplateRepository{db: db}
}

func (r *DBSQLTemplateRepository) List(page, pageSize int, keyword string) ([]models.DBSQLTemplate, int64, int64, error) {
	var templates []models.DBSQLTemplate
	var total int64

	query := r.db.Model(&models.DBSQLTemplate{})
	if keyword != "" {
		kw := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR remark LIKE ?", kw, kw)
	}
	query.Count(&total)

	totalPages := int64(0)
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
	}

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Offset(offset).Limit(pageSize)
	}

	err := query.Order("updated_at DESC").Find(&templates).Error
	return templates, total, totalPages, err
}

func (r *DBSQLTemplateRepository) GetByID(id uint) (*models.DBSQLTemplate, error) {
	var template models.DBSQLTemplate
	err := r.db.First(&template, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &template, nil
}

func (r *DBSQLTemplateRepository) GetByIDs(ids []uint) ([]models.DBSQLTemplate, error) {
	var templates []models.DBSQLTemplate
	if len(ids) == 0 {
		return templates, nil
	}
	err := r.db.Where("id IN ?", ids).Order("id ASC").Find(&templates).Error
	return templates, err
}

func (r *DBSQLTemplateRepository) ExistsByName(name string, excludeID uint) bool {
	var count int64
	query := r.db.Model(&models.DBSQLTemplate{}).Where("name = ?", name)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	query.Count(&count)
	return count > 0
}

func (r *DBSQLTemplateRepository) Create(template *models.DBSQLTemplate) error {
	return r.db.Create(template).Error
}

func (r *DBSQLTemplateRepository) Update(template *models.DBSQLTemplate) error {
	return r.db.Save(template).Error
}

func (r *DBSQLTemplateRepository) Delete(id uint) error {
	return r.db.Delete(&models.DBSQLTemplate{}, id).Error
}
