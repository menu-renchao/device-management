package repository

import (
	"fmt"
	"time"

	"device-management/internal/models"

	"gorm.io/gorm"
)

type WarPackageRepository struct {
	db *gorm.DB
}

func NewWarPackageRepository(db *gorm.DB) *WarPackageRepository {
	return &WarPackageRepository{db: db}
}

// GetByPackageName 根据包名获取元数据
func (r *WarPackageRepository) GetByPackageName(packageName string) (*models.WarPackageMetadata, error) {
	var metadata models.WarPackageMetadata
	err := r.db.Where("package_name = ?", packageName).First(&metadata).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &metadata, err
}

// List 列出所有元数据
func (r *WarPackageRepository) List() ([]models.WarPackageMetadata, error) {
	var list []models.WarPackageMetadata
	err := r.db.Order("created_at DESC").Find(&list).Error
	return list, err
}

// CreateOrUpdate 创建或更新元数据
func (r *WarPackageRepository) CreateOrUpdate(metadata *models.WarPackageMetadata) error {
	now := time.Now()

	// 检查是否已存在
	existing, err := r.GetByPackageName(metadata.PackageName)
	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("检查元数据失败: %w", err)
	}

	if existing != nil {
		// 更新
		err = r.db.Model(&models.WarPackageMetadata{}).
			Where("package_name = ?", metadata.PackageName).
			Updates(map[string]interface{}{
				"package_type": metadata.PackageType,
				"version":       metadata.Version,
				"is_release":    metadata.IsRelease,
				"description":   metadata.Description,
				"updated_at":    now,
			}).Error
		return err
	}

	// 创建
	metadata.CreatedAt = now
	metadata.UpdatedAt = now
	err = r.db.Create(metadata).Error
	return err
}

// Delete 删除元数据
func (r *WarPackageRepository) Delete(packageName string) error {
	err := r.db.Where("package_name = ?", packageName).Delete(&models.WarPackageMetadata{}).Error
	return err
}
