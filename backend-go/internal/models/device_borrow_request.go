package models

import (
	"time"

	"gorm.io/gorm"
)

// DeviceBorrowRequest POS设备借用申请
type DeviceBorrowRequest struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	MerchantID      string         `gorm:"size:100;not null;index" json:"merchant_id"`
	UserID          uint           `gorm:"not null;index" json:"user_id"`
	Purpose         string         `gorm:"size:500" json:"purpose"`
	EndTime         time.Time      `json:"end_time"`
	Status          string         `gorm:"size:20;default:pending" json:"status"` // pending, approved, rejected, completed
	RejectionReason *string        `gorm:"size:500" json:"rejection_reason"`      // 拒绝原因（选填）
	CreatedAt       time.Time      `json:"created_at"`
	ProcessedAt     *time.Time     `json:"processed_at"`
	ProcessedBy     *uint          `json:"processed_by"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	ScanResult  *ScanResult    `gorm:"foreignKey:MerchantID;references:MerchantID" json:"-"`
	User        *User          `gorm:"foreignKey:UserID" json:"-"`
}

func (DeviceBorrowRequest) TableName() string {
	return "device_borrow_requests"
}

func (r *DeviceBorrowRequest) ToDict() map[string]interface{} {
	result := map[string]interface{}{
		"id":              r.ID,
		"merchantId":      r.MerchantID,
		"userId":          r.UserID,
		"purpose":         r.Purpose,
		"endTime":         r.EndTime.Format(time.RFC3339),
		"status":          r.Status,
		"rejectionReason": nil,
		"createdAt":       r.CreatedAt.Format(time.RFC3339),
		"processedAt":     nil,
	}
	if r.RejectionReason != nil {
		result["rejectionReason"] = *r.RejectionReason
	}
	if r.ProcessedAt != nil {
		result["processedAt"] = r.ProcessedAt.Format(time.RFC3339)
	}
	return result
}
