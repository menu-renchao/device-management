package models

import (
	"time"
)

const (
	BorrowAssetTypePOS    = "pos"
	BorrowAssetTypeMobile = "mobile"
)

const (
	BorrowRequestStatusPending   = "pending"
	BorrowRequestStatusApproved  = "approved"
	BorrowRequestStatusRejected  = "rejected"
	BorrowRequestStatusCompleted = "completed"
)

const (
	BorrowLegacySourcePOS    = "device_borrow_requests"
	BorrowLegacySourceMobile = "mobile_borrow_requests"
)

type BorrowRequest struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	AssetType       string     `gorm:"size:20;not null;index" json:"asset_type"`
	AssetID         *uint      `gorm:"index" json:"asset_id"`
	MerchantID      *string    `gorm:"size:100;index" json:"merchant_id"`
	RequesterID     uint       `gorm:"not null;index" json:"requester_id"`
	ApproverUserID  *uint      `gorm:"index" json:"approver_user_id"`
	Status          string     `gorm:"size:20;not null;default:pending;index" json:"status"`
	Purpose         string     `gorm:"size:500" json:"purpose"`
	EndTime         time.Time  `json:"end_time"`
	RejectionReason *string    `gorm:"size:500" json:"rejection_reason"`
	ProcessedAt     *time.Time `json:"processed_at"`
	ProcessedBy     *uint      `json:"processed_by"`
	LegacySource    *string    `gorm:"size:50;index:idx_borrow_requests_legacy,unique" json:"legacy_source"`
	LegacyID        *uint      `gorm:"index:idx_borrow_requests_legacy,unique" json:"legacy_id"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	Requester *User         `gorm:"foreignKey:RequesterID" json:"-"`
	Approver  *User         `gorm:"foreignKey:ApproverUserID" json:"-"`
	Processor *User         `gorm:"foreignKey:ProcessedBy" json:"-"`
	ScanResult *ScanResult  `gorm:"foreignKey:MerchantID;references:MerchantID" json:"-"`
	Device    *MobileDevice `gorm:"foreignKey:AssetID" json:"-"`
}

func (BorrowRequest) TableName() string {
	return "borrow_requests"
}

