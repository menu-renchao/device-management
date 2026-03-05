package models

import (
	"time"
)

// DBSQLExecuteTask SQL 执行任务主记录
type DBSQLExecuteTask struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	TaskID          string     `gorm:"size:64;uniqueIndex;not null" json:"task_id"`
	MerchantID      string     `gorm:"size:100;index;not null" json:"merchant_id"`
	DeviceType      string     `gorm:"size:50" json:"device_type"`
	ExecutorUserID  uint       `gorm:"index;not null" json:"executor_user_id"`
	ExecutorRole    string     `gorm:"size:20;not null" json:"executor_role"`
	TemplateIDsJSON string     `gorm:"type:text;not null" json:"template_ids_json"`
	IsForced        bool       `gorm:"default:false" json:"is_forced"`
	ForceReason     string     `gorm:"type:text" json:"force_reason"`
	Status          string     `gorm:"size:30;not null" json:"status"`
	TotalCount      int        `gorm:"default:0" json:"total_count"`
	SuccessCount    int        `gorm:"default:0" json:"success_count"`
	FailedCount     int        `gorm:"default:0" json:"failed_count"`
	StartedAt       time.Time  `json:"started_at"`
	FinishedAt      *time.Time `json:"finished_at"`
	DurationMS      int64      `gorm:"default:0" json:"duration_ms"`
	ClientIP        string     `gorm:"size:100" json:"client_ip"`
	UserAgent       string     `gorm:"size:255" json:"user_agent"`
	CreatedAt       time.Time  `json:"created_at"`
}

func (DBSQLExecuteTask) TableName() string {
	return "db_sql_execute_tasks"
}

// DBSQLExecuteTaskItem SQL 执行语句明细
type DBSQLExecuteTaskItem struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	TaskID               string    `gorm:"size:64;index;not null" json:"task_id"`
	TemplateID           uint      `gorm:"index;not null" json:"template_id"`
	TemplateNameSnapshot string    `gorm:"size:100;not null" json:"template_name_snapshot"`
	SQLIndex             int       `gorm:"not null" json:"sql_index"`
	SQLTextSnapshot      string    `gorm:"type:text;not null" json:"sql_text_snapshot"`
	Status               string    `gorm:"size:30;not null" json:"status"`
	ErrorMessage         string    `gorm:"type:text" json:"error_message"`
	DurationMS           int64     `gorm:"default:0" json:"duration_ms"`
	ExecutedAt           time.Time `json:"executed_at"`
}

func (DBSQLExecuteTaskItem) TableName() string {
	return "db_sql_execute_task_items"
}
