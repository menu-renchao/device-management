package models

import (
	"time"

	"gorm.io/gorm"
)

// DBSQLTemplate 全局 SQL 模板
type DBSQLTemplate struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:100;uniqueIndex;not null" json:"name"`
	SQLContent  string         `gorm:"type:text;not null" json:"sql_content"`
	NeedRestart bool           `gorm:"not null;default:false" json:"need_restart"`
	Remark      string         `gorm:"type:text" json:"remark"`
	CreatedBy   uint           `gorm:"index;not null" json:"created_by"`
	UpdatedBy   uint           `gorm:"index;not null" json:"updated_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (DBSQLTemplate) TableName() string {
	return "db_sql_templates"
}
