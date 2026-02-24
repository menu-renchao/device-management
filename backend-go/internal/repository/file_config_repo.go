package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type FileConfigRepository struct {
	db *gorm.DB
}

func NewFileConfigRepository(db *gorm.DB) *FileConfigRepository {
	return &FileConfigRepository{db: db}
}

// GetAll 获取所有配置
func (r *FileConfigRepository) GetAll() ([]models.FileConfig, error) {
	var configs []models.FileConfig
	err := r.db.Order("id ASC").Find(&configs).Error
	return configs, err
}

// GetByID 根据ID获取配置
func (r *FileConfigRepository) GetByID(id uint) (*models.FileConfig, error) {
	var config models.FileConfig
	err := r.db.First(&config, id).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// GetEnabled 获取所有启用的配置
func (r *FileConfigRepository) GetEnabled() ([]models.FileConfig, error) {
	var configs []models.FileConfig
	err := r.db.Where("enabled = ?", true).Order("id ASC").Find(&configs).Error
	return configs, err
}

// Create 创建配置
func (r *FileConfigRepository) Create(config *models.FileConfig) error {
	return r.db.Create(config).Error
}

// Update 更新配置
func (r *FileConfigRepository) Update(config *models.FileConfig) error {
	return r.db.Save(config).Error
}

// Delete 删除配置
func (r *FileConfigRepository) Delete(id uint) error {
	return r.db.Delete(&models.FileConfig{}, id).Error
}

// ExistsByName 检查名称是否存在
func (r *FileConfigRepository) ExistsByName(name string, excludeID uint) bool {
	var count int64
	query := r.db.Model(&models.FileConfig{}).Where("name = ?", name)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	query.Count(&count)
	return count > 0
}
