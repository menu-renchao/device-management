package services

import (
	"strings"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
)

type WorkspaceRequestsData struct {
	Requests       []map[string]interface{} `json:"requests"`
	PosRequests    []map[string]interface{} `json:"posRequests"`
	MobileRequests []map[string]interface{} `json:"mobileRequests"`
}

type WorkspaceBorrowsData struct {
	Borrows       []map[string]interface{} `json:"borrows"`
	PosBorrows    []map[string]interface{} `json:"posBorrows"`
	MobileBorrows []map[string]interface{} `json:"mobileBorrows"`
}

type WorkspaceDevicesData struct {
	Devices       []map[string]interface{} `json:"devices"`
	PosDevices    []map[string]interface{} `json:"posDevices"`
	MobileDevices []map[string]interface{} `json:"mobileDevices"`
}

type WorkspaceService struct {
	borrowRepo *repository.BorrowRequestRepository
	deviceRepo *repository.DeviceRepository
	mobileRepo *repository.MobileRepository
	userRepo   *repository.UserRepository
}

func NewWorkspaceService(
	borrowRepo *repository.BorrowRequestRepository,
	deviceRepo *repository.DeviceRepository,
	mobileRepo *repository.MobileRepository,
	userRepo *repository.UserRepository,
) *WorkspaceService {
	return &WorkspaceService{
		borrowRepo: borrowRepo,
		deviceRepo: deviceRepo,
		mobileRepo: mobileRepo,
		userRepo:   userRepo,
	}
}

func (s *WorkspaceService) GetMyRequests(userID uint) (*WorkspaceRequestsData, error) {
	requests, err := s.borrowRepo.ListByRequester(userID)
	if err != nil {
		return nil, err
	}

	result := &WorkspaceRequestsData{
		Requests:       make([]map[string]interface{}, 0, len(requests)),
		PosRequests:    make([]map[string]interface{}, 0),
		MobileRequests: make([]map[string]interface{}, 0),
	}

	for _, request := range requests {
		item := serializeWorkspaceBorrowRequest(&request)
		result.Requests = append(result.Requests, item)
		if request.AssetType == models.BorrowAssetTypePOS {
			result.PosRequests = append(result.PosRequests, item)
		} else {
			result.MobileRequests = append(result.MobileRequests, item)
		}
	}

	return result, nil
}

func (s *WorkspaceService) GetMyBorrows(userID uint) (*WorkspaceBorrowsData, error) {
	posOccupancies, err := s.deviceRepo.ListOccupanciesByUserID(userID)
	if err != nil {
		return nil, err
	}

	mobileDevices, err := s.mobileRepo.ListOccupiedDevicesByUserID(userID)
	if err != nil {
		return nil, err
	}

	result := &WorkspaceBorrowsData{
		Borrows:       make([]map[string]interface{}, 0, len(posOccupancies)+len(mobileDevices)),
		PosBorrows:    make([]map[string]interface{}, 0, len(posOccupancies)),
		MobileBorrows: make([]map[string]interface{}, 0, len(mobileDevices)),
	}

	for _, occupancy := range posOccupancies {
		device, _ := s.deviceRepo.GetScanResultByMerchantID(occupancy.MerchantID)
		item := map[string]interface{}{
			"type":        models.BorrowAssetTypePOS,
			"asset_type":  models.BorrowAssetTypePOS,
			"merchantId":  occupancy.MerchantID,
			"merchant_id": occupancy.MerchantID,
			"deviceName":  workspacePOSDeviceName(device),
			"device_name": workspacePOSDeviceName(device),
			"deviceType":  models.BorrowAssetTypePOS,
			"ip":          workspacePOSDeviceIP(device),
			"purpose":     occupancy.Purpose,
			"startTime":   occupancy.StartTime.Format(time.RFC3339),
			"start_time":  occupancy.StartTime.Format(time.RFC3339),
			"endTime":     occupancy.EndTime.Format(time.RFC3339),
			"end_time":    occupancy.EndTime.Format(time.RFC3339),
			"remainingMs": time.Until(occupancy.EndTime).Milliseconds(),
		}

		result.PosBorrows = append(result.PosBorrows, item)
		result.Borrows = append(result.Borrows, item)
	}

	for _, device := range mobileDevices {
		item := map[string]interface{}{
			"type":        models.BorrowAssetTypeMobile,
			"asset_type":  models.BorrowAssetTypeMobile,
			"deviceId":    device.ID,
			"device_id":   device.ID,
			"deviceName":  device.Name,
			"device_name": device.Name,
			"deviceType":  models.BorrowAssetTypeMobile,
			"purpose":     workspaceStringValue(device.Purpose),
			"startTime":   workspaceFormatTime(device.StartTime),
			"start_time":  workspaceFormatTime(device.StartTime),
			"endTime":     workspaceFormatTime(device.EndTime),
			"end_time":    workspaceFormatTime(device.EndTime),
			"remainingMs": workspaceRemainingMilliseconds(device.EndTime),
		}

		result.MobileBorrows = append(result.MobileBorrows, item)
		result.Borrows = append(result.Borrows, item)
	}

	return result, nil
}

func (s *WorkspaceService) GetMyDevices(userID uint) (*WorkspaceDevicesData, error) {
	posDevices, err := s.deviceRepo.ListDevicesByOwnerID(userID)
	if err != nil {
		return nil, err
	}

	mobileDevices, err := s.mobileRepo.ListDevicesByOwnerID(userID)
	if err != nil {
		return nil, err
	}

	pendingRequests, err := s.borrowRepo.ListPendingByApprover(userID)
	if err != nil {
		return nil, err
	}

	posPendingCounts := make(map[string]int)
	mobilePendingCounts := make(map[uint]int)
	for _, request := range pendingRequests {
		switch request.AssetType {
		case models.BorrowAssetTypePOS:
			if request.MerchantID != nil {
				posPendingCounts[strings.TrimSpace(*request.MerchantID)]++
			}
		case models.BorrowAssetTypeMobile:
			if request.AssetID != nil {
				mobilePendingCounts[*request.AssetID]++
			}
		}
	}

	result := &WorkspaceDevicesData{
		Devices:       make([]map[string]interface{}, 0, len(posDevices)+len(mobileDevices)),
		PosDevices:    make([]map[string]interface{}, 0, len(posDevices)),
		MobileDevices: make([]map[string]interface{}, 0, len(mobileDevices)),
	}

	posMerchantIDs := make([]string, 0, len(posDevices))
	for _, device := range posDevices {
		if device.MerchantID != nil && strings.TrimSpace(*device.MerchantID) != "" {
			posMerchantIDs = append(posMerchantIDs, strings.TrimSpace(*device.MerchantID))
		}
	}

	occupancyByMerchantID := make(map[string]*models.DeviceOccupancy)
	occupierNameByUserID := make(map[uint]string)
	if len(posMerchantIDs) > 0 {
		occupancies, _ := s.deviceRepo.ListOccupanciesByMerchantIDs(posMerchantIDs)
		userIDs := make([]uint, 0, len(occupancies))
		for i := range occupancies {
			if occupancies[i].EndTime.After(time.Now()) {
				occupancyByMerchantID[occupancies[i].MerchantID] = &occupancies[i]
				userIDs = append(userIDs, occupancies[i].UserID)
			}
		}
		occupierNameByUserID = s.loadUserDisplayNames(userIDs)
	}

	for _, device := range posDevices {
		merchantID := workspaceStringValue(device.MerchantID)
		item := map[string]interface{}{
			"type":               models.BorrowAssetTypePOS,
			"asset_type":         models.BorrowAssetTypePOS,
			"merchantId":         merchantID,
			"merchant_id":        merchantID,
			"deviceName":         workspaceStringValue(device.Name),
			"device_name":        workspaceStringValue(device.Name),
			"deviceType":         models.BorrowAssetTypePOS,
			"ip":                 device.IP,
			"isOnline":           device.IsOnline,
			"is_online":          device.IsOnline,
			"isOccupied":         false,
			"is_occupied":        false,
			"occupancy":          nil,
			"pendingBorrowCount": posPendingCounts[merchantID],
			"pending_borrow_count": posPendingCounts[merchantID],
		}

		if occupancy, ok := occupancyByMerchantID[merchantID]; ok {
			occupancyItem := map[string]interface{}{
				"userId":    occupancy.UserID,
				"user_id":   occupancy.UserID,
				"username":  occupierNameByUserID[occupancy.UserID],
				"purpose":   occupancy.Purpose,
				"endTime":   occupancy.EndTime.Format(time.RFC3339),
				"end_time":  occupancy.EndTime.Format(time.RFC3339),
				"startTime": occupancy.StartTime.Format(time.RFC3339),
				"start_time": occupancy.StartTime.Format(time.RFC3339),
			}
			item["isOccupied"] = true
			item["is_occupied"] = true
			item["occupancy"] = occupancyItem
		}

		result.PosDevices = append(result.PosDevices, item)
		result.Devices = append(result.Devices, item)
	}

	mobileOccupierIDs := make([]uint, 0, len(mobileDevices))
	for _, device := range mobileDevices {
		if device.OccupierID != nil && device.EndTime != nil && device.EndTime.After(time.Now()) {
			mobileOccupierIDs = append(mobileOccupierIDs, *device.OccupierID)
		}
	}
	mobileOccupierNames := s.loadUserDisplayNames(mobileOccupierIDs)

	for _, device := range mobileDevices {
		isOccupied := device.OccupierID != nil && device.EndTime != nil && device.EndTime.After(time.Now())
		item := map[string]interface{}{
			"type":               models.BorrowAssetTypeMobile,
			"asset_type":         models.BorrowAssetTypeMobile,
			"deviceId":           device.ID,
			"device_id":          device.ID,
			"deviceName":         device.Name,
			"device_name":        device.Name,
			"deviceType":         models.BorrowAssetTypeMobile,
			"isOccupied":         isOccupied,
			"is_occupied":        isOccupied,
			"occupancy":          nil,
			"pendingBorrowCount": mobilePendingCounts[device.ID],
			"pending_borrow_count": mobilePendingCounts[device.ID],
		}

		if isOccupied {
			occupierID := *device.OccupierID
			item["occupancy"] = map[string]interface{}{
				"userId":    occupierID,
				"user_id":   occupierID,
				"username":  mobileOccupierNames[occupierID],
				"purpose":   workspaceStringValue(device.Purpose),
				"startTime": workspaceFormatTime(device.StartTime),
				"start_time": workspaceFormatTime(device.StartTime),
				"endTime":   workspaceFormatTime(device.EndTime),
				"end_time":  workspaceFormatTime(device.EndTime),
			}
		}

		result.MobileDevices = append(result.MobileDevices, item)
		result.Devices = append(result.Devices, item)
	}

	return result, nil
}

func (s *WorkspaceService) loadUserDisplayNames(userIDs []uint) map[uint]string {
	names := make(map[uint]string)
	users, err := s.userRepo.GetUsersByIDs(workspaceUniqueUserIDs(userIDs))
	if err != nil {
		return names
	}
	for _, user := range users {
		names[user.ID] = workspaceUserDisplayName(&user)
	}
	return names
}

func serializeWorkspaceBorrowRequest(req *models.BorrowRequest) map[string]interface{} {
	deviceName := "unknown"
	ip := ""
	if req.AssetType == models.BorrowAssetTypePOS && req.ScanResult != nil {
		deviceName = workspacePOSDeviceName(req.ScanResult)
		ip = workspacePOSDeviceIP(req.ScanResult)
	}
	if req.AssetType == models.BorrowAssetTypeMobile && req.Device != nil {
		deviceName = req.Device.Name
	}

	item := map[string]interface{}{
		"id":               req.ID,
		"asset_type":       req.AssetType,
		"asset_id":         workspaceUintValue(req.AssetID),
		"merchant_id":      workspaceStringValue(req.MerchantID),
		"status":           req.Status,
		"purpose":          req.Purpose,
		"rejection_reason": workspaceStringValue(req.RejectionReason),
		"device_name":      deviceName,
		"deviceName":       deviceName,
		"deviceType":       req.AssetType,
		"ip":               ip,
		"end_time":         req.EndTime.Format(time.RFC3339),
		"endTime":          req.EndTime.Format(time.RFC3339),
		"created_at":       req.CreatedAt.Format(time.RFC3339),
		"createdAt":        req.CreatedAt.Format(time.RFC3339),
		"processed_at":     workspaceFormatTime(req.ProcessedAt),
	}
	return item
}

func workspacePOSDeviceName(device *models.ScanResult) string {
	if device == nil || device.Name == nil || strings.TrimSpace(*device.Name) == "" {
		return "unknown"
	}
	return strings.TrimSpace(*device.Name)
}

func workspacePOSDeviceIP(device *models.ScanResult) string {
	if device == nil {
		return ""
	}
	return strings.TrimSpace(device.IP)
}

func workspaceUserDisplayName(user *models.User) string {
	if user == nil {
		return ""
	}
	if user.Name != nil && strings.TrimSpace(*user.Name) != "" {
		return strings.TrimSpace(*user.Name)
	}
	return strings.TrimSpace(user.Username)
}

func workspaceFormatTime(value *time.Time) interface{} {
	if value == nil {
		return nil
	}
	return value.Format(time.RFC3339)
}

func workspaceRemainingMilliseconds(value *time.Time) int64 {
	if value == nil {
		return 0
	}
	return time.Until(*value).Milliseconds()
}

func workspaceStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func workspaceUintValue(value *uint) uint {
	if value == nil {
		return 0
	}
	return *value
}

func workspaceUniqueUserIDs(ids []uint) []uint {
	seen := make(map[uint]struct{}, len(ids))
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}
