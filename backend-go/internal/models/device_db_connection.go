package models

import "time"

// DeviceDBConnection 设备数据库连接信息
type DeviceDBConnection struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	MerchantID        string    `gorm:"size:100;uniqueIndex;not null" json:"merchant_id"`
	DBType            string    `gorm:"size:20;not null;default:mysql" json:"db_type"`
	Host              string    `gorm:"size:255;not null" json:"host"`
	Port              int       `gorm:"not null;default:3306" json:"port"`
	DatabaseName      string    `gorm:"size:100;not null" json:"database_name"`
	Username          string    `gorm:"size:100;not null" json:"username"`
	PasswordEncrypted string    `gorm:"type:text;not null" json:"-"`
	UpdatedBy         uint      `gorm:"index" json:"updated_by"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (DeviceDBConnection) TableName() string {
	return "device_db_connections"
}
