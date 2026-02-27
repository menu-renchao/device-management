package services

import (
	"fmt"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
)

type NotificationService struct {
	repo *repository.NotificationRepository
}

func NewNotificationService(repo *repository.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

// SendBorrowWarning 发送借用即将到期提醒
func (s *NotificationService) SendBorrowWarning(userID uint, deviceName string, endTime time.Time) error {
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "设备借用即将到期",
		Content: fmt.Sprintf("您借用的设备「%s」将于 %s 到期，请及时归还或申请续借。", deviceName, endTime.Format("2006-01-02 15:04")),
		Type:    models.NotificationTypeBorrowWarning,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendBorrowExpired 发送借用已过期通知
func (s *NotificationService) SendBorrowExpired(userID uint, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "设备借用已过期",
		Content: fmt.Sprintf("您借用的设备「%s」已过期，系统已自动释放该设备。", deviceName),
		Type:    models.NotificationTypeBorrowExpired,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendBorrowApproved 发送借用申请已通过通知
func (s *NotificationService) SendBorrowApproved(userID uint, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "借用申请已通过",
		Content: fmt.Sprintf("您申请借用的设备「%s」已通过审核。", deviceName),
		Type:    models.NotificationTypeBorrowApproved,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendBorrowRejected 发送借用申请已拒绝通知
func (s *NotificationService) SendBorrowRejected(userID uint, deviceName string, reason string) error {
	content := fmt.Sprintf("您申请借用的设备「%s」被拒绝。", deviceName)
	if reason != "" {
		content = fmt.Sprintf("您申请借用的设备「%s」被拒绝。原因：%s", deviceName, reason)
	}
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "借用申请已拒绝",
		Content: content,
		Type:    models.NotificationTypeBorrowRejected,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendNewBorrowRequest 发送新的借用申请通知给审核人
func (s *NotificationService) SendNewBorrowRequest(approverID uint, applicantName string, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  approverID,
		Title:   "新的借用申请",
		Content: fmt.Sprintf("「%s」申请借用设备「%s」，请及时审核。", applicantName, deviceName),
		Type:    models.NotificationTypeBorrowRequest,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendClaimApproved 发送认领申请已通过通知
func (s *NotificationService) SendClaimApproved(userID uint, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "认领申请已通过",
		Content: fmt.Sprintf("您申请认领的设备「%s」已通过审核，您现在是该设备的负责人。", deviceName),
		Type:    models.NotificationTypeClaimApproved,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendClaimRejected 发送认领申请已拒绝通知
func (s *NotificationService) SendClaimRejected(userID uint, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  userID,
		Title:   "认领申请已拒绝",
		Content: fmt.Sprintf("您申请认领的设备「%s」被拒绝。", deviceName),
		Type:    models.NotificationTypeClaimRejected,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendNewClaimRequest 发送新的认领申请通知给管理员
func (s *NotificationService) SendNewClaimRequest(adminID uint, applicantName string, deviceName string) error {
	notification := &models.SystemNotification{
		UserID:  adminID,
		Title:   "新的认领申请",
		Content: fmt.Sprintf("「%s」申请认领设备「%s」，请及时审核。", applicantName, deviceName),
		Type:    models.NotificationTypeClaimRequest,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// SendNewUserRegister 发送新用户注册通知给管理员
func (s *NotificationService) SendNewUserRegister(adminID uint, username string, name string) error {
	notification := &models.SystemNotification{
		UserID:  adminID,
		Title:   "新用户注册",
		Content: fmt.Sprintf("新用户「%s」（姓名：%s）已完成注册，请及时审核。", username, name),
		Type:    models.NotificationTypeUserRegister,
		IsRead:  false,
	}
	return s.repo.Create(notification)
}

// GetNotifications 获取用户通知列表
func (s *NotificationService) GetNotifications(userID uint, limit int) ([]models.SystemNotification, error) {
	return s.repo.GetByUserID(userID, limit)
}

// GetUnreadNotifications 获取用户未读通知
func (s *NotificationService) GetUnreadNotifications(userID uint) ([]models.SystemNotification, error) {
	return s.repo.GetUnreadByUserID(userID)
}

// GetUnreadCount 获取未读通知数量
func (s *NotificationService) GetUnreadCount(userID uint) (int64, error) {
	return s.repo.GetUnreadCount(userID)
}

// MarkAsRead 标记通知为已读
func (s *NotificationService) MarkAsRead(id uint, userID uint) error {
	return s.repo.MarkAsRead(id, userID)
}

// MarkAllAsRead 标记所有通知为已读
func (s *NotificationService) MarkAllAsRead(userID uint) error {
	return s.repo.MarkAllAsRead(userID)
}

// CleanupOldNotifications 清理旧的已读通知（保留30天）
func (s *NotificationService) CleanupOldNotifications() error {
	return s.repo.DeleteOldNotifications(30)
}
