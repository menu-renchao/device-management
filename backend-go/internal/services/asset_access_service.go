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
	ErrAssetAccessAssetNotFound = errors.New("asset not found")
	ErrAssetAccessUserNotFound  = errors.New("user not found")
	ErrAssetAccessInvalidScope  = errors.New("invalid asset scope")
)

type Action string

const (
	ActionScanView      Action = "scan:view"
	ActionLinuxRead     Action = "linux:read"
	ActionLinuxWrite    Action = "linux:write"
	ActionDBRead        Action = "db:read"
	ActionDBWrite       Action = "db:write"
	ActionBorrowApprove Action = "borrow:approve"
	ActionAssetManage   Action = "asset:manage"
)

const (
	assetRelationNone     = "none"
	assetRelationAdmin    = "admin"
	assetRelationOwner    = "owner"
	assetRelationOccupier = "occupier"
)

type AssetScope struct {
	AssetType  string
	MerchantID string
	AssetID    uint
}

type AssetAccessService struct {
	userRepo   *repository.UserRepository
	deviceRepo *repository.DeviceRepository
	mobileRepo *repository.MobileRepository
}

func NewAssetAccessService(
	userRepo *repository.UserRepository,
	deviceRepo *repository.DeviceRepository,
	mobileRepo *repository.MobileRepository,
) *AssetAccessService {
	return &AssetAccessService{
		userRepo:   userRepo,
		deviceRepo: deviceRepo,
		mobileRepo: mobileRepo,
	}
}

func (s *AssetAccessService) CanAccess(userID uint, scope AssetScope, action Action) (bool, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, ErrAssetAccessUserNotFound
		}
		return false, err
	}
	if user == nil {
		return false, ErrAssetAccessUserNotFound
	}
	return s.CanAccessUser(user, scope, action)
}

func (s *AssetAccessService) CanAccessUser(user *models.User, scope AssetScope, action Action) (bool, error) {
	if user == nil {
		return false, ErrAssetAccessUserNotFound
	}

	relation, err := s.resolveRelation(user, scope)
	if err != nil {
		return false, err
	}

	for _, allowed := range allowedRelations(action) {
		if relation == allowed {
			return true, nil
		}
	}
	return false, nil
}

func (s *AssetAccessService) resolveRelation(user *models.User, scope AssetScope) (string, error) {
	if user.Role == "admin" {
		return assetRelationAdmin, nil
	}

	switch scope.AssetType {
	case models.BorrowAssetTypePOS:
		return s.resolvePOSRelation(user.ID, scope.MerchantID)
	case models.BorrowAssetTypeMobile:
		return s.resolveMobileRelation(user.ID, scope.AssetID)
	default:
		return assetRelationNone, fmt.Errorf("%w: %s", ErrAssetAccessInvalidScope, scope.AssetType)
	}
}

func (s *AssetAccessService) resolvePOSRelation(userID uint, merchantID string) (string, error) {
	if merchantID == "" {
		return assetRelationNone, fmt.Errorf("%w: empty merchant id", ErrAssetAccessInvalidScope)
	}

	device, err := s.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return assetRelationNone, ErrAssetAccessAssetNotFound
		}
		return assetRelationNone, err
	}

	if device.OwnerID != nil && *device.OwnerID == userID {
		return assetRelationOwner, nil
	}

	occupancy, err := s.deviceRepo.GetOccupancyByMerchantID(merchantID)
	if err == nil && occupancy != nil && occupancy.UserID == userID && occupancy.EndTime.After(time.Now()) {
		return assetRelationOccupier, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return assetRelationNone, err
	}

	return assetRelationNone, nil
}

func (s *AssetAccessService) resolveMobileRelation(userID, deviceID uint) (string, error) {
	if deviceID == 0 {
		return assetRelationNone, fmt.Errorf("%w: empty device id", ErrAssetAccessInvalidScope)
	}

	device, err := s.mobileRepo.GetByID(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return assetRelationNone, ErrAssetAccessAssetNotFound
		}
		return assetRelationNone, err
	}

	if device.OwnerID != nil && *device.OwnerID == userID {
		return assetRelationOwner, nil
	}
	if device.OccupierID != nil && *device.OccupierID == userID && device.EndTime != nil && device.EndTime.After(time.Now()) {
		return assetRelationOccupier, nil
	}

	return assetRelationNone, nil
}

func allowedRelations(action Action) []string {
	switch action {
	case ActionBorrowApprove:
		return []string{assetRelationAdmin, assetRelationOwner}
	case ActionScanView, ActionLinuxRead, ActionLinuxWrite, ActionDBRead, ActionDBWrite, ActionAssetManage:
		return []string{assetRelationAdmin, assetRelationOwner, assetRelationOccupier}
	default:
		return []string{assetRelationAdmin}
	}
}
