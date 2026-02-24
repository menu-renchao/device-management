package models

import (
	"time"
)

// SystemNotification 系统通知表
type SystemNotification struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`           // 接收用户ID
	Title     string    `gorm:"size:200;not null" json:"title"`          // 通知标题
	Content   string    `gorm:"size:1000" json:"content"`                // 通知内容
	Type      string    `gorm:"size:50;not null;index" json:"type"`      // 类型：borrow_warning / borrow_expired / borrow_approved / borrow_rejected
	IsRead    bool      `gorm:"default:false" json:"is_read"`            // 是否已读
	RelatedID *uint     `json:"related_id"`                              // 关联ID（借用申请ID）
	CreatedAt time.Time `json:"created_at"`

	User *User `gorm:"foreignKey:UserID" json:"-"`
}

func (SystemNotification) TableName() string {
	return "system_notifications"
}

func (n *SystemNotification) ToDict() map[string]interface{} {
	result := map[string]interface{}{
		"id":        n.ID,
		"userId":    n.UserID,
		"title":     n.Title,
		"content":   n.Content,
		"type":      n.Type,
		"isRead":    n.IsRead,
		"relatedId": nil,
		"createdAt": n.CreatedAt.Format(time.RFC3339),
	}
	if n.RelatedID != nil {
		result["relatedId"] = *n.RelatedID
	}
	return result
}

// 通知类型常量
const (
	NotificationTypeBorrowWarning  = "borrow_warning"  // 借用即将到期
	NotificationTypeBorrowExpired  = "borrow_expired"  // 借用已过期
	NotificationTypeBorrowApproved = "borrow_approved" // 借用申请已通过
	NotificationTypeBorrowRejected = "borrow_rejected" // 借用申请已拒绝
	NotificationTypeBorrowRequest  = "borrow_request"  // 新的借用申请（发给审核人）
	NotificationTypeClaimApproved  = "claim_approved"  // 认领申请已通过
	NotificationTypeClaimRejected  = "claim_rejected"  // 认领申请已拒绝
	NotificationTypeClaimRequest   = "claim_request"   // 新的认领申请（发给管理员）
)
