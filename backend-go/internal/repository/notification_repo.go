package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type NotificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Create 创建通知
func (r *NotificationRepository) Create(notification *models.SystemNotification) error {
	return r.db.Create(notification).Error
}

// GetByID 根据ID获取通知
func (r *NotificationRepository) GetByID(id uint) (*models.SystemNotification, error) {
	var notification models.SystemNotification
	err := r.db.First(&notification, id).Error
	if err != nil {
		return nil, err
	}
	return &notification, nil
}

// GetByUserID 获取用户的所有通知
func (r *NotificationRepository) GetByUserID(userID uint, limit int) ([]models.SystemNotification, error) {
	var notifications []models.SystemNotification
	query := r.db.Where("user_id = ?", userID).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&notifications).Error
	return notifications, err
}

// GetUnreadByUserID 获取用户的未读通知
func (r *NotificationRepository) GetUnreadByUserID(userID uint) ([]models.SystemNotification, error) {
	var notifications []models.SystemNotification
	err := r.db.Where("user_id = ? AND is_read = ?", userID, false).Order("created_at DESC").Find(&notifications).Error
	return notifications, err
}

// GetUnreadCount 获取用户未读通知数量
func (r *NotificationRepository) GetUnreadCount(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.SystemNotification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&count).Error
	return count, err
}

// MarkAsRead 标记通知为已读
func (r *NotificationRepository) MarkAsRead(id uint, userID uint) error {
	return r.db.Model(&models.SystemNotification{}).Where("id = ? AND user_id = ?", id, userID).Update("is_read", true).Error
}

// MarkAllAsRead 标记用户所有通知为已读
func (r *NotificationRepository) MarkAllAsRead(userID uint) error {
	return r.db.Model(&models.SystemNotification{}).Where("user_id = ?", userID).Update("is_read", true).Error
}

// DeleteOldNotifications 删除超过指定天数的已读通知
func (r *NotificationRepository) DeleteOldNotifications(days int) error {
	return r.db.Exec("DELETE FROM system_notifications WHERE is_read = ? AND created_at < datetime('now', '-' || ? || ' days')", true, days).Error
}
