package handlers

import (
	"time"

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type WorkspaceHandler struct {
	deviceRepo *repository.DeviceRepository
	mobileRepo *repository.MobileRepository
	userRepo   *repository.UserRepository
}

func NewWorkspaceHandler(deviceRepo *repository.DeviceRepository, mobileRepo *repository.MobileRepository, userRepo *repository.UserRepository) *WorkspaceHandler {
	return &WorkspaceHandler{
		deviceRepo: deviceRepo,
		mobileRepo: mobileRepo,
		userRepo:   userRepo,
	}
}

// GetMyRequests 获取当前用户的借用申请
func (h *WorkspaceHandler) GetMyRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// 获取 POS 设备借用申请
	posRequests, err := h.deviceRepo.ListBorrowRequestsByUserID(userID)
	if err != nil {
		response.InternalError(c, "获取POS设备借用申请失败")
		return
	}

	// 获取移动设备借用申请
	mobileRequests, err := h.mobileRepo.ListBorrowRequestsByUserID(userID)
	if err != nil {
		response.InternalError(c, "获取移动设备借用申请失败")
		return
	}

	// 构建 POS 设备借用申请结果
	posResult := make([]map[string]interface{}, 0)
	for _, r := range posRequests {
		reqDict := r.ToDict()

		// 添加设备信息
		if r.ScanResult != nil {
			deviceName := "未知设备"
			if r.ScanResult.Name != nil {
				deviceName = *r.ScanResult.Name
			}
			reqDict["deviceName"] = deviceName
			reqDict["deviceType"] = "pos"
			reqDict["ip"] = r.ScanResult.IP
		} else {
			reqDict["deviceName"] = "未知设备"
			reqDict["deviceType"] = "pos"
			reqDict["ip"] = ""
		}

		posResult = append(posResult, reqDict)
	}

	// 构建移动设备借用申请结果
	mobileResult := make([]map[string]interface{}, 0)
	for _, r := range mobileRequests {
		reqDict := r.ToDict()

		// 添加设备信息
		if r.Device != nil {
			reqDict["deviceName"] = r.Device.Name
			reqDict["deviceType"] = "mobile"
		} else {
			reqDict["deviceName"] = "未知设备"
			reqDict["deviceType"] = "mobile"
		}

		mobileResult = append(mobileResult, reqDict)
	}

	response.Success(c, gin.H{
		"posRequests":    posResult,
		"mobileRequests": mobileResult,
	})
}

// GetMyBorrows 获取当前用户正在借用的设备
func (h *WorkspaceHandler) GetMyBorrows(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// 获取 POS 设备借用
	posOccupancies, err := h.deviceRepo.ListOccupanciesByUserID(userID)
	if err != nil {
		response.InternalError(c, "获取POS设备借用信息失败")
		return
	}

	// 获取移动设备借用
	mobileDevices, err := h.mobileRepo.ListOccupiedDevicesByUserID(userID)
	if err != nil {
		response.InternalError(c, "获取移动设备借用信息失败")
		return
	}

	// 构建 POS 设备借用结果
	posResult := make([]map[string]interface{}, 0)
	for _, o := range posOccupancies {
		// 获取设备信息
		device, _ := h.deviceRepo.GetScanResultByMerchantID(o.MerchantID)
		if device == nil {
			continue
		}

		deviceName := "未知设备"
		if device.Name != nil {
			deviceName = *device.Name
		}

		occDict := map[string]interface{}{
			"merchantId":  o.MerchantID,
			"deviceName":  deviceName,
			"deviceType":  "pos",
			"ip":          device.IP,
			"purpose":     o.Purpose,
			"startTime":   o.StartTime.Format(time.RFC3339),
			"endTime":     o.EndTime.Format(time.RFC3339),
			"remainingMs": o.EndTime.Sub(time.Now()).Milliseconds(),
		}

		posResult = append(posResult, occDict)
	}

	// 构建移动设备借用结果
	mobileResult := make([]map[string]interface{}, 0)
	for _, d := range mobileDevices {
		remainingMs := int64(0)
		if d.EndTime != nil {
			remainingMs = d.EndTime.Sub(time.Now()).Milliseconds()
		}

		deviceDict := map[string]interface{}{
			"deviceId":    d.ID,
			"deviceName":  d.Name,
			"deviceType":  "mobile",
			"purpose":     d.Purpose,
			"startTime":   nil,
			"endTime":     nil,
			"remainingMs": remainingMs,
		}
		if d.StartTime != nil {
			deviceDict["startTime"] = d.StartTime.Format(time.RFC3339)
		}
		if d.EndTime != nil {
			deviceDict["endTime"] = d.EndTime.Format(time.RFC3339)
		}

		mobileResult = append(mobileResult, deviceDict)
	}

	response.Success(c, gin.H{
		"posBorrows":    posResult,
		"mobileBorrows": mobileResult,
	})
}

// GetMyDevices 获取当前用户负责的设备（及待审核的借用申请）
func (h *WorkspaceHandler) GetMyDevices(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// 获取用户负责的 POS 设备
	posDevices, err := h.deviceRepo.ListDevicesByOwnerID(userID)
	if err != nil {
		response.InternalError(c, "获取POS设备列表失败")
		return
	}

	// 获取用户负责的移动设备
	mobileDevices, err := h.mobileRepo.ListDevicesByOwnerID(userID)
	if err != nil {
		response.InternalError(c, "获取移动设备列表失败")
		return
	}

	// 构建 POS 设备结果
	posResult := make([]map[string]interface{}, 0)
	posMerchantIDs := make([]string, 0)
	for _, d := range posDevices {
		deviceDict := map[string]interface{}{
			"merchantId":        *d.MerchantID,
			"deviceName":        *d.Name,
			"deviceType":        "pos",
			"ip":                d.IP,
			"isOnline":          d.IsOnline,
			"isOccupied":        false,
			"occupancy":         nil,
			"pendingBorrowCount": 0,
		}

		if d.MerchantID != nil {
			posMerchantIDs = append(posMerchantIDs, *d.MerchantID)
		}

		posResult = append(posResult, deviceDict)
	}

	// 获取 POS 设备的占用信息和待审核申请数
	if len(posMerchantIDs) > 0 {
		// 获取占用信息
		occupancies, _ := h.deviceRepo.ListOccupanciesByMerchantIDs(posMerchantIDs)
		occupancyMap := make(map[string]*models.DeviceOccupancy)
		occupierIDs := make([]uint, 0)
		for i := range occupancies {
			occupancyMap[occupancies[i].MerchantID] = &occupancies[i]
			occupierIDs = append(occupierIDs, occupancies[i].UserID)
		}

		// 获取借用人信息
		occupierUsers, _ := h.deviceRepo.GetUsersByIDs(occupierIDs)
		occupierUserMap := make(map[uint]*models.User)
		for i := range occupierUsers {
			occupierUserMap[occupierUsers[i].ID] = &occupierUsers[i]
		}

		// 更新设备信息
		for i, d := range posResult {
			if merchantID, ok := d["merchantId"].(string); ok {
				if occupancy, exists := occupancyMap[merchantID]; exists && occupancy.EndTime.After(time.Now()) {
					// 获取借用人姓名
					username := ""
					if occupier, ok := occupierUserMap[occupancy.UserID]; ok {
						username = occupier.Username
						if occupier.Name != nil && *occupier.Name != "" {
							username = *occupier.Name
						}
					}
					posResult[i]["isOccupied"] = true
					posResult[i]["occupancy"] = map[string]interface{}{
						"userId":   occupancy.UserID,
						"username": username,
						"purpose":  occupancy.Purpose,
						"endTime":  occupancy.EndTime.Format(time.RFC3339),
					}
				}

				// 获取待审核借用申请数
				pendingReqs, _ := h.deviceRepo.ListBorrowRequests("pending")
				for _, req := range pendingReqs {
					if req.MerchantID == merchantID {
						posResult[i]["pendingBorrowCount"] = posResult[i]["pendingBorrowCount"].(int) + 1
					}
				}
			}
		}
	}

	// 构建移动设备结果
	// 先收集所有借用人的ID
	mobileOccupierIDs := make([]uint, 0)
	for _, d := range mobileDevices {
		if d.OccupierID != nil && d.EndTime != nil && d.EndTime.After(time.Now()) {
			mobileOccupierIDs = append(mobileOccupierIDs, *d.OccupierID)
		}
	}
	// 获取移动设备借用人信息
	mobileOccupierUsers, _ := h.userRepo.GetUsersByIDs(mobileOccupierIDs)
	mobileOccupierUserMap := make(map[uint]*models.User)
	for i := range mobileOccupierUsers {
		mobileOccupierUserMap[mobileOccupierUsers[i].ID] = &mobileOccupierUsers[i]
	}

	mobileResult := make([]map[string]interface{}, 0)
	for _, d := range mobileDevices {
		deviceDict := map[string]interface{}{
			"deviceId":           d.ID,
			"deviceName":         d.Name,
			"deviceType":         "mobile",
			"isOccupied":         d.OccupierID != nil && d.EndTime != nil && d.EndTime.After(time.Now()),
			"pendingBorrowCount": 0,
		}

		if d.OccupierID != nil && d.EndTime != nil && d.EndTime.After(time.Now()) {
			// 获取借用人姓名
			username := ""
			if occupier, ok := mobileOccupierUserMap[*d.OccupierID]; ok {
				username = occupier.Username
				if occupier.Name != nil && *occupier.Name != "" {
					username = *occupier.Name
				}
			}
			deviceDict["occupancy"] = map[string]interface{}{
				"userId":   *d.OccupierID,
				"username": username,
				"purpose":  d.Purpose,
				"endTime":  d.EndTime.Format(time.RFC3339),
			}
		}

		// 获取待审核借用申请数
		pendingReqs, _ := h.mobileRepo.ListBorrowRequestsByDevice(d.ID, "pending")
		deviceDict["pendingBorrowCount"] = len(pendingReqs)

		mobileResult = append(mobileResult, deviceDict)
	}

	response.Success(c, gin.H{
		"posDevices":    posResult,
		"mobileDevices": mobileResult,
	})
}
