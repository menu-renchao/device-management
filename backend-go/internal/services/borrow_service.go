package services

import (
	"errors"
	"fmt"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"gorm.io/gorm"
)

var (
	ErrBorrowAssetUnavailable  = errors.New("asset unavailable")
	ErrBorrowRequestExists     = errors.New("pending borrow request exists")
	ErrBorrowRequestProcessed  = errors.New("borrow request already processed")
	ErrBorrowPermissionDenied  = errors.New("borrow permission denied")
	ErrBorrowApproverNotFound  = errors.New("borrow approver not found")
	ErrBorrowUnsupportedAsset  = errors.New("unsupported borrow asset type")
)

type BorrowSubmitInput struct {
	AssetType   string
	AssetID     uint
	MerchantID  string
	RequesterID uint
	Purpose     string
	EndTime     time.Time
}

type BorrowService struct {
	borrowRepo     *repository.BorrowRequestRepository
	deviceRepo     *repository.DeviceRepository
	mobileRepo     *repository.MobileRepository
	userRepo       *repository.UserRepository
	accessService  *AssetAccessService
}

func NewBorrowService(
	borrowRepo *repository.BorrowRequestRepository,
	deviceRepo *repository.DeviceRepository,
	mobileRepo *repository.MobileRepository,
	userRepo *repository.UserRepository,
	accessService *AssetAccessService,
) *BorrowService {
	return &BorrowService{
		borrowRepo:    borrowRepo,
		deviceRepo:    deviceRepo,
		mobileRepo:    mobileRepo,
		userRepo:      userRepo,
		accessService: accessService,
	}
}

func (s *BorrowService) Submit(input BorrowSubmitInput) (*models.BorrowRequest, error) {
	switch input.AssetType {
	case models.BorrowAssetTypePOS:
		return s.submitPOS(input)
	case models.BorrowAssetTypeMobile:
		return s.submitMobile(input)
	default:
		return nil, ErrBorrowUnsupportedAsset
	}
}

func (s *BorrowService) Approve(requestID, approverID uint) (*models.BorrowRequest, error) {
	req, err := s.borrowRepo.GetByID(requestID)
	if err != nil {
		return nil, err
	}
	if req.Status != models.BorrowRequestStatusPending {
		return nil, ErrBorrowRequestProcessed
	}
	if ok, err := s.canApprove(approverID, req); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrBorrowPermissionDenied
	}

	now := time.Now()
	switch req.AssetType {
	case models.BorrowAssetTypePOS:
		if req.MerchantID == nil {
			return nil, ErrBorrowUnsupportedAsset
		}
		occupancy, _ := s.deviceRepo.GetOccupancyByMerchantIDUnscoped(*req.MerchantID)
		if occupancy != nil && !occupancy.DeletedAt.Valid && occupancy.EndTime.After(now) {
			return nil, ErrBorrowAssetUnavailable
		}
		purpose := req.Purpose
		startTime := now
		if occupancy != nil {
			occupancy.UserID = req.RequesterID
			occupancy.Purpose = &purpose
			occupancy.StartTime = startTime
			occupancy.EndTime = req.EndTime
			if err := s.deviceRepo.UpdateOccupancy(occupancy); err != nil {
				return nil, err
			}
		} else {
			occupancy = &models.DeviceOccupancy{
				MerchantID: *req.MerchantID,
				UserID:     req.RequesterID,
				Purpose:    &purpose,
				StartTime:  startTime,
				EndTime:    req.EndTime,
			}
			if err := s.deviceRepo.CreateOccupancy(occupancy); err != nil {
				return nil, err
			}
		}
	case models.BorrowAssetTypeMobile:
		if req.AssetID == nil {
			return nil, ErrBorrowUnsupportedAsset
		}
		device, err := s.mobileRepo.GetByID(*req.AssetID)
		if err != nil {
			return nil, err
		}
		if device.OccupierID != nil && device.EndTime != nil && device.EndTime.After(now) {
			return nil, ErrBorrowAssetUnavailable
		}
		purpose := req.Purpose
		startTime := now
		device.OccupierID = &req.RequesterID
		device.Purpose = &purpose
		device.StartTime = &startTime
		device.EndTime = &req.EndTime
		if err := s.mobileRepo.Update(device); err != nil {
			return nil, err
		}
	default:
		return nil, ErrBorrowUnsupportedAsset
	}

	req.Status = models.BorrowRequestStatusApproved
	req.ProcessedAt = &now
	req.ProcessedBy = &approverID
	if err := s.borrowRepo.Update(req); err != nil {
		return nil, err
	}
	return s.borrowRepo.GetByID(req.ID)
}

func (s *BorrowService) Reject(requestID, approverID uint, reason string) (*models.BorrowRequest, error) {
	req, err := s.borrowRepo.GetByID(requestID)
	if err != nil {
		return nil, err
	}
	if req.Status != models.BorrowRequestStatusPending {
		return nil, ErrBorrowRequestProcessed
	}
	if ok, err := s.canApprove(approverID, req); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrBorrowPermissionDenied
	}

	now := time.Now()
	req.Status = models.BorrowRequestStatusRejected
	req.ProcessedAt = &now
	req.ProcessedBy = &approverID
	if reason != "" {
		req.RejectionReason = &reason
	}
	if err := s.borrowRepo.Update(req); err != nil {
		return nil, err
	}
	return s.borrowRepo.GetByID(req.ID)
}

func (s *BorrowService) ListByRequester(requesterID uint) ([]models.BorrowRequest, error) {
	return s.borrowRepo.ListByRequester(requesterID)
}

func (s *BorrowService) ListPendingByApprover(approverID uint) ([]models.BorrowRequest, error) {
	return s.borrowRepo.ListPendingByApprover(approverID)
}

func (s *BorrowService) List(opts repository.BorrowRequestListOptions) ([]models.BorrowRequest, error) {
	return s.borrowRepo.List(opts)
}

func (s *BorrowService) submitPOS(input BorrowSubmitInput) (*models.BorrowRequest, error) {
	device, err := s.deviceRepo.GetScanResultByMerchantID(input.MerchantID)
	if err != nil {
		return nil, err
	}

	occupancy, _ := s.deviceRepo.GetOccupancyByMerchantID(input.MerchantID)
	if occupancy != nil && occupancy.EndTime.After(time.Now()) {
		return nil, ErrBorrowAssetUnavailable
	}
	if _, err := s.borrowRepo.GetPendingByMerchantID(input.MerchantID); err == nil {
		return nil, ErrBorrowRequestExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	approverID, err := s.resolveApprover(device.OwnerID)
	if err != nil {
		return nil, err
	}
	req := &models.BorrowRequest{
		AssetType:      models.BorrowAssetTypePOS,
		MerchantID:     &input.MerchantID,
		RequesterID:    input.RequesterID,
		ApproverUserID: approverID,
		Status:         models.BorrowRequestStatusPending,
		Purpose:        input.Purpose,
		EndTime:        input.EndTime,
	}
	if err := s.borrowRepo.Create(req); err != nil {
		return nil, err
	}
	return s.borrowRepo.GetByID(req.ID)
}

func (s *BorrowService) submitMobile(input BorrowSubmitInput) (*models.BorrowRequest, error) {
	device, err := s.mobileRepo.GetByID(input.AssetID)
	if err != nil {
		return nil, err
	}
	if device.OccupierID != nil && device.EndTime != nil && device.EndTime.After(time.Now()) {
		return nil, ErrBorrowAssetUnavailable
	}
	if _, err := s.borrowRepo.GetPendingByAssetID(input.AssetID); err == nil {
		return nil, ErrBorrowRequestExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	approverID, err := s.resolveApprover(device.OwnerID)
	if err != nil {
		return nil, err
	}
	req := &models.BorrowRequest{
		AssetType:      models.BorrowAssetTypeMobile,
		AssetID:        &input.AssetID,
		RequesterID:    input.RequesterID,
		ApproverUserID: approverID,
		Status:         models.BorrowRequestStatusPending,
		Purpose:        input.Purpose,
		EndTime:        input.EndTime,
	}
	if err := s.borrowRepo.Create(req); err != nil {
		return nil, err
	}
	return s.borrowRepo.GetByID(req.ID)
}

func (s *BorrowService) resolveApprover(ownerID *uint) (*uint, error) {
	if ownerID != nil {
		return ownerID, nil
	}
	admins, err := s.userRepo.GetAdmins()
	if err != nil {
		return nil, err
	}
	if len(admins) == 0 {
		return nil, ErrBorrowApproverNotFound
	}
	return &admins[0].ID, nil
}

func (s *BorrowService) canApprove(userID uint, req *models.BorrowRequest) (bool, error) {
	scope := servicesScopeFromBorrowRequest(req)
	ok, err := s.accessService.CanAccess(userID, scope, ActionBorrowApprove)
	if err != nil {
		if errors.Is(err, ErrAssetAccessAssetNotFound) {
			return false, fmt.Errorf("%w: %v", ErrBorrowAssetUnavailable, err)
		}
		return false, err
	}
	return ok, nil
}

func servicesScopeFromBorrowRequest(req *models.BorrowRequest) AssetScope {
	scope := AssetScope{AssetType: req.AssetType}
	if req.MerchantID != nil {
		scope.MerchantID = *req.MerchantID
	}
	if req.AssetID != nil {
		scope.AssetID = *req.AssetID
	}
	return scope
}
