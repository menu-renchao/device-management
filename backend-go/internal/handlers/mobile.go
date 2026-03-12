package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"device-management/internal/config"
	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MobileHandler struct {
	mobileRepo          *repository.MobileRepository
	userRepo            *repository.UserRepository
	notificationService *services.NotificationService
	accessService       *services.AssetAccessService
}

func NewMobileHandler(mobileRepo *repository.MobileRepository, userRepo *repository.UserRepository, notificationService *services.NotificationService, accessService *services.AssetAccessService) *MobileHandler {
	return &MobileHandler{
		mobileRepo:          mobileRepo,
		userRepo:            userRepo,
		notificationService: notificationService,
		accessService:       accessService,
	}
}

type CreateMobileDeviceRequest struct {
	Name          string `json:"name" binding:"required"`
	DeviceType    string `json:"deviceType"`
	SN            string `json:"sn"`
	SystemVersion string `json:"systemVersion"`
}

type UpdateMobileDeviceRequest struct {
	Name          string `json:"name"`
	DeviceType    string `json:"deviceType"`
	SN            string `json:"sn"`
	SystemVersion string `json:"systemVersion"`
	ImageA        string `json:"imageA"`
	ImageB        string `json:"imageB"`
}

type OccupyMobileDeviceRequest struct {
	Purpose string `json:"purpose"`
	EndTime string `json:"endTime" binding:"required"`
}

type SubmitBorrowRequest struct {
	DeviceID uint   `json:"deviceId" binding:"required"`
	Purpose  string `json:"purpose"`
	EndTime  string `json:"endTime" binding:"required"`
}

// GetDevices returns all mobile devices
func (h *MobileHandler) GetDevices(c *gin.Context) {
	// Cleanup expired occupancies
	h.mobileRepo.CleanupExpiredOccupancies()

	devices, err := h.mobileRepo.List()
	if err != nil {
		response.InternalError(c, "Failed to get devices")
		return
	}

	deviceDicts := make([]map[string]interface{}, len(devices))
	for i, d := range devices {
		deviceDicts[i] = d.ToDict()
	}

	response.Success(c, gin.H{"devices": deviceDicts})
}

// CreateDevice creates a new mobile device
func (h *MobileHandler) CreateDevice(c *gin.Context) {
	var req CreateMobileDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if req.Name == "" {
		response.BadRequest(c, "Device name cannot be empty")
		return
	}

	var deviceType, sn, systemVersion *string
	if req.DeviceType != "" {
		deviceType = &req.DeviceType
	}
	if req.SN != "" {
		sn = &req.SN
	}
	if req.SystemVersion != "" {
		systemVersion = &req.SystemVersion
	}

	device := &models.MobileDevice{
		Name:          req.Name,
		DeviceType:    deviceType,
		SN:            sn,
		SystemVersion: systemVersion,
	}

	if err := h.mobileRepo.Create(device); err != nil {
		response.InternalError(c, "Failed to create device")
		return
	}

	// Reload with occupier
	device, _ = h.mobileRepo.GetByID(device.ID)

	response.CreatedWithMessage(c, "Device created successfully", gin.H{"device": device.ToDict()})
}

// UpdateDevice updates a mobile device
func (h *MobileHandler) UpdateDevice(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid device ID")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "Device not found")
		return
	}

	var req UpdateMobileDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if req.Name != "" {
		device.Name = req.Name
	}
	if req.DeviceType != "" {
		device.DeviceType = &req.DeviceType
	}
	if req.SN != "" {
		device.SN = &req.SN
	}
	if req.SystemVersion != "" {
		device.SystemVersion = &req.SystemVersion
	}
	if req.ImageA != "" {
		device.ImageA = &req.ImageA
	}
	if req.ImageB != "" {
		device.ImageB = &req.ImageB
	}

	device.UpdatedAt = time.Now()

	if err := h.mobileRepo.Update(device); err != nil {
		response.InternalError(c, "Failed to update device")
		return
	}

	// Reload
	device, _ = h.mobileRepo.GetByID(device.ID)

	response.SuccessWithMessage(c, "Device updated successfully", gin.H{"device": device.ToDict()})
}

// DeleteDevice deletes a mobile device
func (h *MobileHandler) DeleteDevice(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid device ID")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "Device not found")
		return
	}

	// Delete associated images
	if device.ImageA != nil && *device.ImageA != "" {
		imagePath := filepath.Join(config.AppConfig.Upload.Path, *device.ImageA)
		os.Remove(imagePath)
	}
	if device.ImageB != nil && *device.ImageB != "" {
		imagePath := filepath.Join(config.AppConfig.Upload.Path, *device.ImageB)
		os.Remove(imagePath)
	}

	if err := h.mobileRepo.Delete(uint(deviceID)); err != nil {
		response.InternalError(c, "Failed to delete device")
		return
	}

	response.SuccessWithMessage(c, "Device deleted", nil)
}

// UploadImage uploads an image for a mobile device
func (h *MobileHandler) UploadImage(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid device ID")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "Device not found")
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		response.BadRequest(c, "No image uploaded")
		return
	}

	imageType := c.DefaultPostForm("type", "a")
	if imageType != "a" && imageType != "b" {
		imageType = "a"
	}

	// Check file extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".gif" {
		response.BadRequest(c, "Unsupported file format")
		return
	}

	// Create upload directory
	uploadDir := filepath.Join(config.AppConfig.Upload.Path, "mobile_devices")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		response.InternalError(c, "Failed to create upload directory")
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("%d_%s_%s%s", deviceID, imageType, uuid.New().String()[:8], ext)
	filePath := filepath.Join(uploadDir, filename)

	// Save file
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		response.InternalError(c, "Failed to save file")
		return
	}

	// Update device
	relativePath := filepath.Join("mobile_devices", filename)
	if imageType == "a" {
		device.ImageA = &relativePath
	} else {
		device.ImageB = &relativePath
	}
	device.UpdatedAt = time.Now()

	if err := h.mobileRepo.Update(device); err != nil {
		response.InternalError(c, "Failed to update device")
		return
	}

	response.Success(c, gin.H{
		"message": "Image uploaded successfully",
		"path":    relativePath,
	})
}

// OccupyDevice occupies a mobile device
func (h *MobileHandler) OccupyDevice(c *gin.Context) {
	userID := middleware.GetUserID(c)

	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid device ID")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "Device not found")
		return
	}

	var req OccupyMobileDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if req.EndTime == "" {
		response.BadRequest(c, "End time cannot be empty")
		return
	}

	endTime, err := parseDateTime(req.EndTime)
	if err != nil {
		response.BadRequest(c, "Invalid end time format")
		return
	}

	now := time.Now()
	device.OccupierID = &userID
	device.Purpose = &req.Purpose
	device.StartTime = &now
	device.EndTime = &endTime

	if err := h.mobileRepo.Update(device); err != nil {
		response.InternalError(c, "Failed to occupy device")
		return
	}

	// Reload
	device, _ = h.mobileRepo.GetByID(device.ID)

	response.SuccessWithMessage(c, "Device occupied", gin.H{"device": device.ToDict()})
}

// ReleaseDevice releases a mobile device
func (h *MobileHandler) ReleaseDevice(c *gin.Context) {
	userID := middleware.GetUserID(c)

	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid device ID")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "Device not found")
		return
	}

	user, _ := h.userRepo.GetByID(userID)
	allowed, accessErr := h.accessService.CanAccessUser(user, services.AssetScope{
		AssetType: models.BorrowAssetTypeMobile,
		AssetID:   uint(deviceID),
	}, services.ActionAssetManage)
	if accessErr != nil {
		response.InternalError(c, "权限校验失败")
		return
	}
	if !allowed {
		response.Forbidden(c, "无权释放此设备")
		return
	}

	device.OccupierID = nil
	device.Purpose = nil
	device.StartTime = nil
	device.EndTime = nil

	if err := h.mobileRepo.Update(device); err != nil {
		response.InternalError(c, "Failed to release device")
		return
	}

	// Reload
	device, _ = h.mobileRepo.GetByID(device.ID)

	response.SuccessWithMessage(c, "Device released", gin.H{"device": device.ToDict()})
}

// SubmitBorrowRequest 提交借用申请
func (h *MobileHandler) SubmitBorrowRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req SubmitBorrowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 检查设备是否存在
	device, err := h.mobileRepo.GetByID(req.DeviceID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	// 检查设备是否已被借用
	if device.EndTime != nil && device.EndTime.After(time.Now()) {
		response.BadRequest(c, "设备已被借用")
		return
	}

	// 检查是否已有待审核的申请
	if _, err := h.mobileRepo.GetPendingBorrowRequestByDevice(req.DeviceID); err == nil {
		response.BadRequest(c, "该设备已有待审核的借用申请")
		return
	}

	// 解析归还时间
	endTime, err := parseDateTime(req.EndTime)
	if err != nil {
		response.BadRequest(c, "归还时间格式无效")
		return
	}

	if endTime.Before(time.Now()) {
		response.BadRequest(c, "归还时间必须大于当前时间")
		return
	}

	// 创建借用申请
	borrowReq := &models.MobileBorrowRequest{
		DeviceID: req.DeviceID,
		UserID:   userID,
		Purpose:  req.Purpose,
		EndTime:  endTime,
		Status:   "pending",
	}

	if err := h.mobileRepo.CreateBorrowRequest(borrowReq); err != nil {
		response.InternalError(c, "提交借用申请失败")
		return
	}

	// 发送通知给审核人（设备负责人和管理员）
	applicant, _ := h.userRepo.GetByID(userID)
	applicantName := "用户"
	if applicant != nil {
		if applicant.Name != nil && *applicant.Name != "" {
			applicantName = *applicant.Name
		} else {
			applicantName = applicant.Username
		}
	}

	deviceName := "移动设备"
	if device.Name != "" {
		deviceName = device.Name
	}

	// 通知设备负责人
	if h.notificationService != nil && device.OwnerID != nil {
		if err := h.notificationService.SendNewBorrowRequest(*device.OwnerID, applicantName, deviceName); err != nil {
			fmt.Printf("[WARN] 发送借用申请通知给负责人失败: %v\n", err)
		}
	}

	// 通知所有管理员
	if h.notificationService != nil {
		admins, _ := h.userRepo.GetAdmins()
		for _, admin := range admins {
			// 避免重复通知（如果负责人也是管理员）
			if device.OwnerID != nil && admin.ID == *device.OwnerID {
				continue
			}
			if err := h.notificationService.SendNewBorrowRequest(admin.ID, applicantName, deviceName); err != nil {
				fmt.Printf("[WARN] 发送借用申请通知给管理员失败: %v\n", err)
			}
		}
	}

	response.SuccessWithMessage(c, "借用申请已提交，请等待审核", nil)
}

// GetBorrowRequests 获取借用申请列表
func (h *MobileHandler) GetBorrowRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)
	status := c.DefaultQuery("status", "pending")

	user, _ := h.userRepo.GetByID(userID)
	isAdmin := user != nil && user.Role == "admin"

	var requests []models.MobileBorrowRequest
	var err error

	if isAdmin {
		// 管理员可以看到所有申请
		requests, err = h.mobileRepo.ListBorrowRequests(status)
	} else {
		// 普通用户只能看到自己负责的设备的申请
		requests, err = h.mobileRepo.ListBorrowRequests(status)
		// 过滤出用户是设备负责人的申请
		filtered := make([]models.MobileBorrowRequest, 0)
		for _, r := range requests {
			if r.Device != nil && r.Device.OwnerID != nil && *r.Device.OwnerID == userID {
				filtered = append(filtered, r)
			}
		}
		requests = filtered
	}

	if err != nil {
		response.InternalError(c, "获取借用申请列表失败")
		return
	}

	// 构建返回结果
	result := make([]map[string]interface{}, 0)
	for _, r := range requests {
		reqDict := r.ToDict()

		// 添加用户信息
		if r.User != nil {
			username := r.User.Username
			if r.User.Name != nil && *r.User.Name != "" {
				username = *r.User.Name
			}
			reqDict["username"] = username
		} else {
			reqDict["username"] = "未知用户"
		}

		// 添加设备信息
		if r.Device != nil {
			reqDict["deviceName"] = r.Device.Name
			reqDict["deviceType"] = r.Device.DeviceType
			// 添加负责人信息
			if r.Device.Owner != nil {
				ownerName := r.Device.Owner.Username
				if r.Device.Owner.Name != nil && *r.Device.Owner.Name != "" {
					ownerName = *r.Device.Owner.Name
				}
				reqDict["ownerName"] = ownerName
			} else if r.Device.OwnerID != nil {
				reqDict["ownerName"] = "未知"
			} else {
				reqDict["ownerName"] = ""
			}
		} else {
			reqDict["deviceName"] = "未知设备"
			reqDict["deviceType"] = nil
			reqDict["ownerName"] = ""
		}

		result = append(result, reqDict)
	}

	response.Success(c, gin.H{"requests": result})
}

// ApproveBorrowRequest 审核通过借用申请
func (h *MobileHandler) ApproveBorrowRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	reqID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "申请ID无效")
		return
	}

	borrowReq, err := h.mobileRepo.GetBorrowRequestByID(uint(reqID))
	if err != nil {
		response.NotFound(c, "借用申请不存在")
		return
	}

	if borrowReq.Status != "pending" {
		response.BadRequest(c, "该申请已处理")
		return
	}

	user, _ := h.userRepo.GetByID(userID)
	allowed, accessErr := h.accessService.CanAccessUser(user, services.AssetScope{
		AssetType: models.BorrowAssetTypeMobile,
		AssetID:   borrowReq.DeviceID,
	}, services.ActionBorrowApprove)
	if accessErr != nil {
		response.InternalError(c, "权限校验失败")
		return
	}
	if !allowed {
		response.Forbidden(c, "无权审核此申请")
		return
	}

	// 检查设备是否仍可用
	device, err := h.mobileRepo.GetByID(borrowReq.DeviceID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	if device.EndTime != nil && device.EndTime.After(time.Now()) {
		response.BadRequest(c, "设备已被借用")
		return
	}

	// 更新借用申请状态
	now := time.Now()
	borrowReq.Status = "approved"
	borrowReq.ProcessedAt = &now
	borrowReq.ProcessedBy = &userID

	if err := h.mobileRepo.UpdateBorrowRequest(borrowReq); err != nil {
		response.InternalError(c, "审核失败")
		return
	}

	// 更新设备借用状态
	startTime := time.Now()
	device.OccupierID = &borrowReq.UserID
	device.Purpose = &borrowReq.Purpose
	device.StartTime = &startTime
	device.EndTime = &borrowReq.EndTime

	if err := h.mobileRepo.Update(device); err != nil {
		response.InternalError(c, "更新设备状态失败")
		return
	}

	// 发送通知给申请人
	deviceName := "移动设备"
	if device.Name != "" {
		deviceName = device.Name
	}
	if h.notificationService != nil {
		if err := h.notificationService.SendBorrowApproved(borrowReq.UserID, deviceName); err != nil {
			fmt.Printf("[WARN] 发送借用通过通知失败: %v\n", err)
		}
	}

	response.SuccessWithMessage(c, "借用申请已通过", nil)
}

// RejectBorrowRequest 审核拒绝借用申请
func (h *MobileHandler) RejectBorrowRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	reqID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "申请ID无效")
		return
	}

	// 解析请求体获取拒绝原因
	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	borrowReq, err := h.mobileRepo.GetBorrowRequestByID(uint(reqID))
	if err != nil {
		response.NotFound(c, "借用申请不存在")
		return
	}

	if borrowReq.Status != "pending" {
		response.BadRequest(c, "该申请已处理")
		return
	}

	user, _ := h.userRepo.GetByID(userID)
	allowed, accessErr := h.accessService.CanAccessUser(user, services.AssetScope{
		AssetType: models.BorrowAssetTypeMobile,
		AssetID:   borrowReq.DeviceID,
	}, services.ActionBorrowApprove)
	if accessErr != nil {
		response.InternalError(c, "权限校验失败")
		return
	}
	if !allowed {
		response.Forbidden(c, "无权审核此申请")
		return
	}

	// 更新借用申请状态
	now := time.Now()
	borrowReq.Status = "rejected"
	borrowReq.ProcessedAt = &now
	borrowReq.ProcessedBy = &userID

	// 保存拒绝原因
	if req.Reason != "" {
		borrowReq.RejectionReason = &req.Reason
	}

	if err := h.mobileRepo.UpdateBorrowRequest(borrowReq); err != nil {
		response.InternalError(c, "拒绝失败")
		return
	}

	// 发送通知给申请人
	deviceName := "移动设备"
	if borrowReq.Device != nil && borrowReq.Device.Name != "" {
		deviceName = borrowReq.Device.Name
	}
	if h.notificationService != nil {
		if err := h.notificationService.SendBorrowRejected(borrowReq.UserID, deviceName, req.Reason); err != nil {
			fmt.Printf("[WARN] 发送借用拒绝通知失败: %v\n", err)
		}
	}

	response.SuccessWithMessage(c, "借用申请已拒绝", nil)
}

// SetDeviceOwner 设置设备负责人（管理员）
func (h *MobileHandler) SetDeviceOwner(c *gin.Context) {
	deviceID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "设备ID无效")
		return
	}

	var req struct {
		OwnerID *uint `json:"ownerId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	device, err := h.mobileRepo.GetByID(uint(deviceID))
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	// 使用 UpdateOwner 方法确保正确更新 nil 值
	if err := h.mobileRepo.UpdateOwner(device.ID, req.OwnerID); err != nil {
		response.InternalError(c, "设置负责人失败")
		return
	}

	// 重新加载
	device, _ = h.mobileRepo.GetByID(device.ID)

	response.SuccessWithMessage(c, "负责人已设置", gin.H{"device": device.ToDict()})
}
