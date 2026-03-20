package models

import "time"

type DeviceWebAccessLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	MerchantID   string    `gorm:"size:100;index;not null" json:"merchant_id"`
	TargetIP     string    `gorm:"size:50;not null" json:"target_ip"`
	TargetPort   int       `gorm:"not null" json:"target_port"`
	Method       string    `gorm:"size:16;not null" json:"method"`
	Path         string    `gorm:"size:500;not null" json:"path"`
	StatusCode   int       `gorm:"not null" json:"status_code"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	ClientIP     string    `gorm:"size:100" json:"client_ip"`
	DurationMs   int64     `gorm:"not null;default:0" json:"duration_ms"`
	ErrorMessage string    `gorm:"type:text" json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

func (DeviceWebAccessLog) TableName() string {
	return "device_web_access_logs"
}
