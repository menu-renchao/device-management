package models

import "time"

type FeatureRequestLike struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RequestID uint      `gorm:"not null;uniqueIndex:idx_feature_request_user_like" json:"request_id"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_feature_request_user_like" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (FeatureRequestLike) TableName() string {
	return "feature_request_likes"
}
