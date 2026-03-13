package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type BorrowRequestListOptions struct {
	Status      string
	AssetType   string
	RequesterID *uint
	ApproverID  *uint
}

type BorrowRequestRepository struct {
	db *gorm.DB
}

func NewBorrowRequestRepository(db *gorm.DB) *BorrowRequestRepository {
	return &BorrowRequestRepository{db: db}
}

func (r *BorrowRequestRepository) Create(req *models.BorrowRequest) error {
	return r.db.Create(req).Error
}

func (r *BorrowRequestRepository) GetByID(id uint) (*models.BorrowRequest, error) {
	var req models.BorrowRequest
	err := r.db.Preload("Requester").Preload("Approver").Preload("Processor").Preload("ScanResult").Preload("Device").First(&req, id).Error
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *BorrowRequestRepository) Update(req *models.BorrowRequest) error {
	return r.db.Save(req).Error
}

func (r *BorrowRequestRepository) List(opts BorrowRequestListOptions) ([]models.BorrowRequest, error) {
	var requests []models.BorrowRequest
	query := r.db.Preload("Requester").Preload("Approver").Preload("Processor").Preload("ScanResult").Preload("Device").Order("created_at DESC, id DESC")

	if opts.Status != "" && opts.Status != "all" {
		query = query.Where("status = ?", opts.Status)
	}
	if opts.AssetType != "" {
		query = query.Where("asset_type = ?", opts.AssetType)
	}
	if opts.RequesterID != nil {
		query = query.Where("requester_id = ?", *opts.RequesterID)
	}
	if opts.ApproverID != nil {
		query = query.Where("approver_user_id = ?", *opts.ApproverID)
	}

	err := query.Find(&requests).Error
	return requests, err
}

func (r *BorrowRequestRepository) ListByRequester(requesterID uint) ([]models.BorrowRequest, error) {
	return r.List(BorrowRequestListOptions{RequesterID: &requesterID})
}

func (r *BorrowRequestRepository) ListPendingByApprover(approverID uint) ([]models.BorrowRequest, error) {
	return r.List(BorrowRequestListOptions{
		Status:     models.BorrowRequestStatusPending,
		ApproverID: &approverID,
	})
}

func (r *BorrowRequestRepository) GetPendingByMerchantID(merchantID string) (*models.BorrowRequest, error) {
	var req models.BorrowRequest
	err := r.db.Preload("Requester").Preload("Approver").Preload("Processor").Preload("ScanResult").
		Where("asset_type = ? AND merchant_id = ? AND status = ?", models.BorrowAssetTypePOS, merchantID, models.BorrowRequestStatusPending).
		First(&req).Error
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *BorrowRequestRepository) GetPendingByAssetID(assetID uint) (*models.BorrowRequest, error) {
	var req models.BorrowRequest
	err := r.db.Preload("Requester").Preload("Approver").Preload("Processor").Preload("Device").
		Where("asset_type = ? AND asset_id = ? AND status = ?", models.BorrowAssetTypeMobile, assetID, models.BorrowRequestStatusPending).
		First(&req).Error
	if err != nil {
		return nil, err
	}
	return &req, nil
}
