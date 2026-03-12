package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	FeatureRequestStatusPending   = "pending"
	FeatureRequestStatusPlanned   = "planned"
	FeatureRequestStatusCompleted = "completed"
	FeatureRequestStatusRejected  = "rejected"
)

type FeatureRequest struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Title     string         `gorm:"size:200;not null;index" json:"title"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	Status    string         `gorm:"size:20;not null;default:pending;index" json:"status"`
	CreatedBy uint           `gorm:"not null;index" json:"created_by"`
	LikeCount int64          `gorm:"not null;default:0;index" json:"like_count"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (FeatureRequest) TableName() string {
	return "feature_requests"
}

func (f *FeatureRequest) BeforeCreate(_ *gorm.DB) error {
	if f.Status == "" {
		f.Status = FeatureRequestStatusPending
	}
	return nil
}
