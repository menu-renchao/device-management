package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
)

type BorrowRequestListOptions struct {
	Status     string
	AssetType  string
	RequesterID *uint
	ApproverID *uint
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

func (r *BorrowRequestRepository) MigrateLegacyBorrowRequests() error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := migrateLegacyPOSBorrowRequests(tx); err != nil {
			return err
		}
		if err := migrateLegacyMobileBorrowRequests(tx); err != nil {
			return err
		}
		return nil
	})
}

func migrateLegacyPOSBorrowRequests(tx *gorm.DB) error {
	var requests []models.DeviceBorrowRequest
	if err := tx.Order("id ASC").Find(&requests).Error; err != nil {
		return err
	}

	for _, legacy := range requests {
		legacyID := legacy.ID
		legacySource := models.BorrowLegacySourcePOS

		exists, err := legacyBorrowRequestExists(tx, legacySource, legacyID)
		if err != nil {
			return err
		}
		if exists {
			continue
		}

		migrated := &models.BorrowRequest{
			AssetType:       models.BorrowAssetTypePOS,
			MerchantID:      stringPtr(legacy.MerchantID),
			RequesterID:     legacy.UserID,
			ApproverUserID:  lookupPOSApprover(tx, legacy.MerchantID),
			Status:          normalizeBorrowStatus(legacy.Status),
			Purpose:         legacy.Purpose,
			EndTime:         legacy.EndTime,
			RejectionReason: legacy.RejectionReason,
			ProcessedAt:     legacy.ProcessedAt,
			ProcessedBy:     legacy.ProcessedBy,
			LegacySource:    &legacySource,
			LegacyID:        &legacyID,
			CreatedAt:       legacy.CreatedAt,
			UpdatedAt:       legacy.CreatedAt,
		}
		if migrated.Status == models.BorrowRequestStatusPending && migrated.ApproverUserID == nil {
			migrated.ApproverUserID = lookupAnyAdmin(tx)
		}

		if err := tx.Create(migrated).Error; err != nil {
			return err
		}
	}

	return nil
}

func migrateLegacyMobileBorrowRequests(tx *gorm.DB) error {
	var requests []models.MobileBorrowRequest
	if err := tx.Order("id ASC").Find(&requests).Error; err != nil {
		return err
	}

	for _, legacy := range requests {
		legacyID := legacy.ID
		legacySource := models.BorrowLegacySourceMobile

		exists, err := legacyBorrowRequestExists(tx, legacySource, legacyID)
		if err != nil {
			return err
		}
		if exists {
			continue
		}

		assetID := legacy.DeviceID
		migrated := &models.BorrowRequest{
			AssetType:       models.BorrowAssetTypeMobile,
			AssetID:         &assetID,
			RequesterID:     legacy.UserID,
			ApproverUserID:  lookupMobileApprover(tx, legacy.DeviceID),
			Status:          normalizeBorrowStatus(legacy.Status),
			Purpose:         legacy.Purpose,
			EndTime:         legacy.EndTime,
			RejectionReason: legacy.RejectionReason,
			ProcessedAt:     legacy.ProcessedAt,
			ProcessedBy:     legacy.ProcessedBy,
			LegacySource:    &legacySource,
			LegacyID:        &legacyID,
			CreatedAt:       legacy.CreatedAt,
			UpdatedAt:       legacy.CreatedAt,
		}
		if migrated.Status == models.BorrowRequestStatusPending && migrated.ApproverUserID == nil {
			migrated.ApproverUserID = lookupAnyAdmin(tx)
		}

		if err := tx.Create(migrated).Error; err != nil {
			return err
		}
	}

	return nil
}

func legacyBorrowRequestExists(tx *gorm.DB, source string, legacyID uint) (bool, error) {
	var count int64
	err := tx.Model(&models.BorrowRequest{}).
		Where("legacy_source = ? AND legacy_id = ?", source, legacyID).
		Count(&count).Error
	return count > 0, err
}

func lookupPOSApprover(tx *gorm.DB, merchantID string) *uint {
	var result models.ScanResult
	if err := tx.Where("merchant_id = ?", merchantID).First(&result).Error; err != nil {
		return nil
	}
	if result.OwnerID == nil {
		return nil
	}
	return result.OwnerID
}

func lookupMobileApprover(tx *gorm.DB, deviceID uint) *uint {
	var device models.MobileDevice
	if err := tx.First(&device, deviceID).Error; err != nil {
		return nil
	}
	return device.OwnerID
}

func lookupAnyAdmin(tx *gorm.DB) *uint {
	var admin models.User
	err := tx.Where("role = ? AND status = ?", "admin", "approved").Order("id ASC").First(&admin).Error
	if err != nil {
		return nil
	}
	return &admin.ID
}

func normalizeBorrowStatus(status string) string {
	switch status {
	case models.BorrowRequestStatusPending, models.BorrowRequestStatusApproved, models.BorrowRequestStatusRejected, models.BorrowRequestStatusCompleted:
		return status
	default:
		return models.BorrowRequestStatusPending
	}
}

func stringPtr(value string) *string {
	return &value
}
