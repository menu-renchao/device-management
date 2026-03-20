package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type DeviceHandler struct {
	deviceRepo          *repository.DeviceRepository
	userRepo            *repository.UserRepository
	notificationService *services.NotificationService
	licenseService      licenseBackupManager
	dbBackupService     dbBackupManager
	linuxService        *services.LinuxService
	accessService       *services.AssetAccessService
	posAccessService    posAccessResolver
	deviceWebAccessLogRepo deviceWebAccessLogger
}

type posAccessResolver interface {
	ResolveAccessInfo(merchantID string) (*services.POSAccessInfo, error)
}

type deviceWebAccessLogger interface {
	Create(log *models.DeviceWebAccessLog) error
}

func NewDeviceHandler(
	deviceRepo *repository.DeviceRepository,
	userRepo *repository.UserRepository,
	notificationService *services.NotificationService,
	licenseService licenseBackupManager,
	dbBackupService dbBackupManager,
	linuxService *services.LinuxService,
	accessService *services.AssetAccessService,
	posAccessService posAccessResolver,
	deviceWebAccessLogRepo deviceWebAccessLogger,
) *DeviceHandler {
	return &DeviceHandler{
		deviceRepo:          deviceRepo,
		userRepo:            userRepo,
		notificationService: notificationService,
		licenseService:      licenseService,
		dbBackupService:     dbBackupService,
		linuxService:        linuxService,
		accessService:       accessService,
		posAccessService:    posAccessService,
		deviceWebAccessLogRepo: deviceWebAccessLogRepo,
	}
}

type SetOccupancyRequest struct {
	MerchantID string `json:"merchant_id" binding:"required"`
	Purpose    string `json:"purpose"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time" binding:"required"`
}

type SubmitClaimRequest struct {
	MerchantID string `json:"merchant_id" binding:"required"`
}

func (h *DeviceHandler) GetPOSAccess(c *gin.Context) {
	if h.posAccessService == nil {
		response.InternalError(c, "POS access service unavailable")
		return
	}

	info, err := h.posAccessService.ResolveAccessInfo(c.Param("merchant_id"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"merchantId":     info.MerchantID,
		"ip":             info.IP,
		"port":           info.Port,
		"directUrl":      info.DirectURL,
		"proxyUrl":       info.ProxyURL,
		"preferDirect":   info.PreferDirect,
		"isOnline":       info.IsOnline,
		"lastOnlineTime": info.LastOnlineTime.Format(time.RFC3339),
	})
}

func (h *DeviceHandler) ProxyPOS(c *gin.Context) {
	if h.posAccessService == nil {
		response.InternalError(c, "POS access service unavailable")
		return
	}

	info, err := h.posAccessService.ResolveAccessInfo(c.Param("merchant_id"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	targetURL := &url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("%s:%d", info.IP, info.Port),
	}
	proxyBasePath := fmt.Sprintf("/api/device/%s/pos-proxy", info.MerchantID)
	startedAt := time.Now()

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ModifyResponse = func(resp *http.Response) error {
		rewriteProxyLocationHeader(resp.Header, proxyBasePath)
		rewriteProxyCookiePaths(resp.Header, proxyBasePath)
		if err := rewriteProxyHTMLResponse(resp, proxyBasePath); err != nil {
			return err
		}
		return nil
	}
	proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, proxyErr error) {
		response.Error(c, http.StatusBadGateway, proxyErr.Error())
	}

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.URL.Path = c.Param("path")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.Host = targetURL.Host
	}

	proxy.ServeHTTP(c.Writer, c.Request)

	if h.deviceWebAccessLogRepo != nil {
		_ = h.deviceWebAccessLogRepo.Create(&models.DeviceWebAccessLog{
			MerchantID: info.MerchantID,
			TargetIP:   info.IP,
			TargetPort: info.Port,
			Method:     c.Request.Method,
			Path:       c.Request.URL.Path,
			StatusCode: c.Writer.Status(),
			UserID:     middleware.GetUserID(c),
			ClientIP:   c.ClientIP(),
			DurationMs: time.Since(startedAt).Milliseconds(),
		})
	}
}

func rewriteProxyLocationHeader(header http.Header, proxyBasePath string) {
	location := strings.TrimSpace(header.Get("Location"))
	if location == "" {
		return
	}

	rewritten := rewriteProxyPathValue(location, proxyBasePath)
	if rewritten != "" {
		header.Set("Location", rewritten)
	}
}

func rewriteProxyCookiePaths(header http.Header, proxyBasePath string) {
	setCookies := header.Values("Set-Cookie")
	if len(setCookies) == 0 {
		return
	}

	header.Del("Set-Cookie")
	targetPath := ensureTrailingSlash(proxyBasePath)
	for _, cookie := range setCookies {
		rewritten := strings.Replace(cookie, "Path=/;", "Path="+targetPath+";", 1)
		rewritten = strings.Replace(rewritten, "Path=/ ", "Path="+targetPath+" ", 1)
		if strings.HasSuffix(rewritten, "Path=/") {
			rewritten = strings.TrimSuffix(rewritten, "Path=/") + "Path=" + targetPath
		}
		header.Add("Set-Cookie", rewritten)
	}
}

func rewriteProxyPathValue(rawValue, proxyBasePath string) string {
	trimmedValue := strings.TrimSpace(rawValue)
	if trimmedValue == "" {
		return ""
	}

	if strings.HasPrefix(trimmedValue, "/") {
		return joinProxyPath(proxyBasePath, trimmedValue)
	}

	parsedURL, err := url.Parse(trimmedValue)
	if err != nil {
		return ""
	}
	if parsedURL.Path == "" {
		return ""
	}

	rewrittenPath := joinProxyPath(proxyBasePath, parsedURL.Path)
	if parsedURL.RawQuery != "" {
		rewrittenPath += "?" + parsedURL.RawQuery
	}
	if parsedURL.Fragment != "" {
		rewrittenPath += "#" + parsedURL.Fragment
	}
	return rewrittenPath
}

func joinProxyPath(proxyBasePath, targetPath string) string {
	base := strings.TrimRight(proxyBasePath, "/")
	path := targetPath
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

func ensureTrailingSlash(value string) string {
	if strings.HasSuffix(value, "/") {
		return value
	}
	return value + "/"
}

func rewriteProxyHTMLResponse(resp *http.Response, proxyBasePath string) error {
	contentType := strings.ToLower(strings.TrimSpace(resp.Header.Get("Content-Type")))
	if !strings.HasPrefix(contentType, "text/html") || resp.Body == nil {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()

	proxyPrefix := ensureTrailingSlash(strings.TrimRight(proxyBasePath, "/"))
	rewritten := string(body)
	rewritten = strings.ReplaceAll(rewritten, `href="/`, `href="`+proxyPrefix)
	rewritten = strings.ReplaceAll(rewritten, `src="/`, `src="`+proxyPrefix)
	rewritten = strings.ReplaceAll(rewritten, `action="/`, `action="`+proxyPrefix)

	rewrittenBytes := []byte(rewritten)
	resp.Body = io.NopCloser(bytes.NewReader(rewrittenBytes))
	resp.ContentLength = int64(len(rewrittenBytes))
	resp.Header.Set("Content-Length", strconv.Itoa(len(rewrittenBytes)))
	return nil
}

// GetDevices returns paginated device list
func (h *DeviceHandler) GetDevices(c *gin.Context) {
	// Cleanup expired occupancies first and notify the borrower after auto-return.
	expiredOccupancies, err := h.deviceRepo.ListExpiredOccupancies(time.Now())
	if err != nil {
		fmt.Printf("[WARN] list expired POS occupancies failed: %v\n", err)
	} else if _, err := h.deviceRepo.CleanupExpiredOccupancies(); err != nil {
		fmt.Printf("[WARN] cleanup expired POS occupancies failed: %v\n", err)
	} else {
		h.notifyExpiredPOSOccupancies(expiredOccupancies)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	search := c.Query("search")

	// 获取类型和分类筛选参数（支持多选，逗号分隔）
	typesParam := c.Query("types")
	propertiesParam := c.Query("properties")
	mineOnlyParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("mine_only", "0")))
	mineOnly := mineOnlyParam == "1" || mineOnlyParam == "true" || mineOnlyParam == "yes"
	currentUserID := middleware.GetUserID(c)

	var filterTypes []string
	var filterProperties []string

	if typesParam != "" {
		filterTypes = strings.Split(typesParam, ",")
	}
	if propertiesParam != "" {
		filterProperties = strings.Split(propertiesParam, ",")
	}

	if pageSize > 200 {
		pageSize = 200
	}

	results, total, totalPages, err := h.deviceRepo.ListScanResults(page, pageSize, search, filterTypes, filterProperties, mineOnly, currentUserID)
	if err != nil {
		response.InternalError(c, "获取设备列表失败")
		return
	}

	// Get scan session
	session, _ := h.deviceRepo.GetScanSession()

	// Get merchant IDs and owner IDs
	merchantIDs := make([]string, 0)
	ownerIDs := make([]uint, 0)
	for _, r := range results {
		if r.MerchantID != nil && *r.MerchantID != "" {
			merchantIDs = append(merchantIDs, *r.MerchantID)
		}
		if r.OwnerID != nil {
			ownerIDs = append(ownerIDs, *r.OwnerID)
		}
	}

	// Get properties
	properties, _ := h.deviceRepo.ListPropertiesByMerchantIDs(merchantIDs)
	propertyMap := make(map[string]string)
	for _, p := range properties {
		propertyMap[p.MerchantID] = p.Property
	}

	// Get occupancies
	occupancies, _ := h.deviceRepo.ListOccupanciesByMerchantIDs(merchantIDs)
	occupancyMap := make(map[string]*models.DeviceOccupancy)
	occupierIDs := make([]uint, 0)
	for i := range occupancies {
		occupancyMap[occupancies[i].MerchantID] = &occupancies[i]
		// 收集借用人的ID
		occupierIDs = append(occupierIDs, occupancies[i].UserID)
	}

	// Get users (包括设备负责人和借用人)
	allUserIDs := append(ownerIDs, occupierIDs...)
	users, err := h.deviceRepo.GetUsersByIDs(allUserIDs)
	if err != nil {
		fmt.Printf("[ERROR] GetUsersByIDs failed: %v\n", err)
	}
	userMap := make(map[uint]*models.User)
	for i := range users {
		userMap[users[i].ID] = &users[i]
	}

	// Build device list
	devices := make([]map[string]interface{}, 0)
	now := time.Now()
	for _, r := range results {
		device := r.ToDict()

		merchantID := ""
		if r.MerchantID != nil {
			merchantID = *r.MerchantID
		}

		// Add property
		if prop, ok := propertyMap[merchantID]; ok {
			device["property"] = prop
		} else {
			device["property"] = "PC"
		}

		// Add occupancy
		if occupancy, ok := occupancyMap[merchantID]; ok {
			if occupancy.EndTime.After(now) {
				// 手动构建 occupancy 信息，确保使用正确的借用人
				occDict := map[string]interface{}{
					"merchantId": occupancy.MerchantID,
					"userId":     occupancy.UserID,
					"purpose":    occupancy.Purpose,
					"startTime":  occupancy.StartTime.Format(time.RFC3339),
					"endTime":    occupancy.EndTime.Format(time.RFC3339),
					"createdAt":  occupancy.CreatedAt.Format(time.RFC3339),
				}
				// 从 userMap 获取借用人信息
				if occupier, ok := userMap[occupancy.UserID]; ok {
					username := occupier.Username
					if occupier.Name != nil && *occupier.Name != "" {
						username = *occupier.Name
					}
					occDict["username"] = username
				} else {
					occDict["username"] = ""
				}
				device["occupancy"] = occDict
				device["isOccupied"] = true
			} else {
				device["occupancy"] = nil
				device["isOccupied"] = false
			}
		} else {
			device["occupancy"] = nil
			device["isOccupied"] = false
		}

		// Add owner
		if r.OwnerID != nil {
			if owner, ok := userMap[*r.OwnerID]; ok {
				username := owner.Username
				if owner.Name != nil && *owner.Name != "" {
					username = *owner.Name
				}
				device["owner"] = map[string]interface{}{
					"id":       owner.ID,
					"username": username,
				}
			} else {
				device["owner"] = nil
			}
		} else {
			device["owner"] = nil
		}

		devices = append(devices, device)
	}

	lastScanAt := ""
	if session != nil {
		lastScanAt = session.LastScanAt.Format(time.RFC3339)
	}

	response.Success(c, gin.H{
		"devices":    devices,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
		"lastScanAt": lastScanAt,
	})
}

func (h *DeviceHandler) notifyExpiredPOSOccupancies(occupancies []models.DeviceOccupancy) {
	if h.notificationService == nil {
		return
	}

	for _, occupancy := range occupancies {
		deviceName := occupancy.MerchantID
		if device, err := h.deviceRepo.GetScanResultByMerchantID(occupancy.MerchantID); err == nil && device != nil {
			if device.Name != nil && strings.TrimSpace(*device.Name) != "" {
				deviceName = strings.TrimSpace(*device.Name)
			}
		}

		if err := h.notificationService.SendBorrowExpired(occupancy.UserID, deviceName); err != nil {
			fmt.Printf("[WARN] send POS auto-return notification failed: %v\n", err)
		}
	}
}

// GetOccupancies returns all device occupancies
func (h *DeviceHandler) GetOccupancies(c *gin.Context) {
	occupancies, err := h.deviceRepo.ListOccupancies()
	if err != nil {
		response.InternalError(c, "获取借用信息失败")
		return
	}

	occDicts := make([]map[string]interface{}, len(occupancies))
	for i, o := range occupancies {
		occDicts[i] = o.ToDict()
	}

	response.Success(c, gin.H{"occupancies": occDicts})
}

// SetOccupancy sets device occupancy
func (h *DeviceHandler) SetOccupancy(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req SetOccupancyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if req.MerchantID == "" {
		response.BadRequest(c, "商家ID不能为空")
		return
	}

	if req.EndTime == "" {
		response.BadRequest(c, "归还时间不能为空")
		return
	}

	// Parse times
	startTime := time.Now()
	if req.StartTime != "" {
		if t, err := parseDateTime(req.StartTime); err == nil {
			startTime = t
		}
	}

	endTime, err := parseDateTime(req.EndTime)
	if err != nil {
		response.BadRequest(c, "归还时间格式无效")
		return
	}

	if endTime.Before(startTime) || endTime.Equal(startTime) {
		response.BadRequest(c, "归还时间必须大于当前时间")
		return
	}

	// Check for existing occupancy (including soft-deleted)
	occupancy, _ := h.deviceRepo.GetOccupancyByMerchantIDUnscoped(req.MerchantID)
	if occupancy != nil {
		// 如果记录被软删除，先恢复
		if occupancy.DeletedAt.Valid {
			if err := h.deviceRepo.RestoreOccupancy(occupancy); err != nil {
				response.InternalError(c, "恢复借用记录失败")
				return
			}
		}
		occupancy.UserID = userID
		occupancy.Purpose = &req.Purpose
		occupancy.StartTime = startTime
		occupancy.EndTime = endTime
		if err := h.deviceRepo.UpdateOccupancy(occupancy); err != nil {
			response.InternalError(c, "更新借用信息失败")
			return
		}
	} else {
		occupancy = &models.DeviceOccupancy{
			MerchantID: req.MerchantID,
			UserID:     userID,
			Purpose:    &req.Purpose,
			StartTime:  startTime,
			EndTime:    endTime,
		}
		if err := h.deviceRepo.CreateOccupancy(occupancy); err != nil {
			response.InternalError(c, "创建借用信息失败")
			return
		}
	}

	// Reload with user
	occupancy, _ = h.deviceRepo.GetOccupancyByMerchantID(req.MerchantID)

	response.SuccessWithMessage(c, "借用信息已更新", gin.H{"occupancy": occupancy.ToDict()})
}

// ReleaseOccupancy releases device occupancy
func (h *DeviceHandler) ReleaseOccupancy(c *gin.Context) {
	userID := middleware.GetUserID(c)
	merchantID := c.Param("merchant_id")

	occupancy, err := h.deviceRepo.GetOccupancyByMerchantID(merchantID)
	if err != nil {
		response.NotFound(c, "借用记录不存在")
		return
	}

	// Check permission
	user, _ := h.userRepo.GetByID(userID)
	isAdmin := user != nil && user.Role == "admin"
	isOccupier := occupancy.UserID == userID

	// 检查是否是设备负责人
	isOwner := false
	device, _ := h.deviceRepo.GetScanResultByMerchantID(merchantID)
	if device != nil && device.OwnerID != nil && *device.OwnerID == userID {
		isOwner = true
	}

	if !isAdmin && !isOccupier && !isOwner {
		response.Forbidden(c, "无权释放此设备")
		return
	}

	if err := h.deviceRepo.DeleteOccupancy(merchantID); err != nil {
		response.InternalError(c, "释放设备失败")
		return
	}

	response.SuccessWithMessage(c, "设备已释放", nil)
}

// DeleteDevice deletes a device (admin only)
// Supports both merchantID and IP (for devices without merchantID)
func (h *DeviceHandler) DeleteDevice(c *gin.Context) {
	idParam := c.Param("merchant_id")

	// Try to find by merchantID first
	device, err := h.deviceRepo.GetScanResultByMerchantID(idParam)
	if err != nil {
		// If not found by merchantID, try by IP (for devices without merchantID)
		device, err = h.deviceRepo.GetScanResultByIPAndEmptyMerchant(idParam)
		if err != nil {
			response.NotFound(c, "设备不存在")
			return
		}

		// Delete by IP (无 merchant_id 的设备通常没有占用记录)
		if err := h.deviceRepo.DeleteScanResultByIP(idParam); err != nil {
			response.InternalError(c, "删除设备失败")
			return
		}
		response.SuccessWithMessage(c, "设备已删除", nil)
		return
	}

	// 使用事务删除设备及关联记录
	tx := h.deviceRepo.BeginTx()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Delete related records
	if device.MerchantID != nil && *device.MerchantID != "" {
		// 删除占用记录
		if err := tx.DeleteOccupancy(*device.MerchantID); err != nil {
			tx.Rollback()
			response.InternalError(c, "删除设备占用记录失败")
			return
		}
		// 删除认领记录
		if err := tx.DeleteClaimsByMerchantID(*device.MerchantID); err != nil {
			tx.Rollback()
			response.InternalError(c, "删除设备认领记录失败")
			return
		}
		// 删除设备分类属性
		if err := tx.DeleteProperty(*device.MerchantID); err != nil {
			tx.Rollback()
			response.InternalError(c, "删除设备分类属性失败")
			return
		}
		// 删除借用申请记录
		if err := tx.DeleteBorrowRequestsByMerchantID(*device.MerchantID); err != nil {
			tx.Rollback()
			response.InternalError(c, "删除设备借用申请记录失败")
			return
		}
	}

	// Delete device
	if err := tx.DeleteScanResult(*device.MerchantID); err != nil {
		tx.Rollback()
		response.InternalError(c, "删除设备失败")
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		response.InternalError(c, "提交事务失败")
		return
	}

	response.SuccessWithMessage(c, "设备已删除", nil)
}

// SubmitClaim submits a device claim
func (h *DeviceHandler) SubmitClaim(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req SubmitClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if req.MerchantID == "" {
		response.BadRequest(c, "商家ID不能为空")
		return
	}

	// Check device exists
	device, err := h.deviceRepo.GetScanResultByMerchantID(req.MerchantID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	// Check if already claimed
	if device.OwnerID != nil {
		response.BadRequest(c, "设备已被认领")
		return
	}

	// Check for pending claim
	if _, err := h.deviceRepo.GetPendingClaimByMerchantID(req.MerchantID); err == nil {
		response.BadRequest(c, "该设备已有待审核的认领申请")
		return
	}

	// Check if user already claimed
	if _, err := h.deviceRepo.GetPendingClaimByUserAndMerchant(userID, req.MerchantID); err == nil {
		response.BadRequest(c, "您已提交过该设备的认领申请")
		return
	}

	// Create claim
	claim := &models.DeviceClaim{
		MerchantID: req.MerchantID,
		UserID:     userID,
		Status:     "pending",
	}

	if err := h.deviceRepo.CreateClaim(claim); err != nil {
		response.InternalError(c, "提交认领申请失败")
		return
	}

	// 发送通知给所有管理员
	applicant, _ := h.userRepo.GetByID(userID)
	applicantName := "用户"
	if applicant != nil {
		if applicant.Name != nil && *applicant.Name != "" {
			applicantName = *applicant.Name
		} else {
			applicantName = applicant.Username
		}
	}

	deviceName := "设备"
	if device.Name != nil {
		deviceName = *device.Name
	}

	if h.notificationService != nil {
		admins, _ := h.userRepo.GetAdmins()
		for _, admin := range admins {
			if err := h.notificationService.SendNewClaimRequest(admin.ID, applicantName, deviceName); err != nil {
				fmt.Printf("[WARN] 发送认领申请通知给管理员失败: %v\n", err)
			}
		}
	}

	response.SuccessWithMessage(c, "认领申请已提交，请等待管理员审核", nil)
}

// GetClaims returns device claims
func (h *DeviceHandler) GetClaims(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")

	claims, err := h.deviceRepo.ListClaims(status)
	if err != nil {
		response.InternalError(c, "获取认领申请列表失败")
		return
	}

	// Build result with user and device info
	result := make([]map[string]interface{}, 0)
	for _, claim := range claims {
		user, _ := h.userRepo.GetByID(claim.UserID)
		device, _ := h.deviceRepo.GetScanResultByMerchantID(claim.MerchantID)

		username := "未知用户"
		if user != nil {
			if user.Name != nil && *user.Name != "" {
				username = *user.Name
			} else {
				username = user.Username
			}
		}

		deviceName := "未知设备"
		if device != nil && device.Name != nil {
			deviceName = *device.Name
		}

		claimDict := map[string]interface{}{
			"id":          claim.ID,
			"merchantId":  claim.MerchantID,
			"deviceName":  deviceName,
			"userId":      claim.UserID,
			"username":    username,
			"status":      claim.Status,
			"createdAt":   claim.CreatedAt.Format(time.RFC3339),
			"processedAt": nil,
		}
		if claim.ProcessedAt != nil {
			claimDict["processedAt"] = claim.ProcessedAt.Format(time.RFC3339)
		}

		result = append(result, claimDict)
	}

	response.Success(c, gin.H{"claims": result})
}

// ApproveClaim approves a device claim
func (h *DeviceHandler) ApproveClaim(c *gin.Context) {
	userID := middleware.GetUserID(c)
	claimID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "认领申请ID无效")
		return
	}

	claim, err := h.deviceRepo.GetClaimByID(uint(claimID))
	if err != nil {
		response.NotFound(c, "认领申请不存在")
		return
	}

	if claim.Status != "pending" {
		response.BadRequest(c, "该认领申请已处理")
		return
	}

	// Check device exists and not claimed
	device, err := h.deviceRepo.GetScanResultByMerchantID(claim.MerchantID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	if device.OwnerID != nil {
		response.BadRequest(c, "设备已被认领")
		return
	}

	// Update claim
	now := time.Now()
	claim.Status = "approved"
	claim.ProcessedAt = &now
	claim.ProcessedBy = &userID

	// Set device owner
	device.OwnerID = &claim.UserID

	// Update in transaction
	if err := h.deviceRepo.UpdateClaim(claim); err != nil {
		response.InternalError(c, "审批认领申请失败")
		return
	}
	if err := h.deviceRepo.UpdateScanResult(device); err != nil {
		response.InternalError(c, "更新设备信息失败")
		return
	}

	// Reject other pending claims
	h.deviceRepo.RejectOtherPendingClaims(claim.MerchantID, uint(claimID), userID)

	// 发送通知给申请人
	deviceName := "设备"
	if device.Name != nil {
		deviceName = *device.Name
	}
	if h.notificationService != nil {
		if err := h.notificationService.SendClaimApproved(claim.UserID, deviceName); err != nil {
			fmt.Printf("[WARN] 发送认领通过通知失败: %v\n", err)
		}
	}

	response.SuccessWithMessage(c, "认领申请已通过", nil)
}

// RejectClaim rejects a device claim
func (h *DeviceHandler) RejectClaim(c *gin.Context) {
	userID := middleware.GetUserID(c)
	claimID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "认领申请ID无效")
		return
	}

	claim, err := h.deviceRepo.GetClaimByID(uint(claimID))
	if err != nil {
		response.NotFound(c, "认领申请不存在")
		return
	}

	if claim.Status != "pending" {
		response.BadRequest(c, "该认领申请已处理")
		return
	}

	// 获取设备名称用于通知
	deviceName := "设备"
	device, err := h.deviceRepo.GetScanResultByMerchantID(claim.MerchantID)
	if err == nil && device.Name != nil {
		deviceName = *device.Name
	}

	now := time.Now()
	claim.Status = "rejected"
	claim.ProcessedAt = &now
	claim.ProcessedBy = &userID

	if err := h.deviceRepo.UpdateClaim(claim); err != nil {
		response.InternalError(c, "拒绝认领申请失败")
		return
	}

	// 发送通知给申请人
	if h.notificationService != nil {
		if err := h.notificationService.SendClaimRejected(claim.UserID, deviceName); err != nil {
			fmt.Printf("[WARN] 发送认领拒绝通知失败: %v\n", err)
		}
	}

	response.SuccessWithMessage(c, "认领申请已拒绝", nil)
}

// ResetOwner resets device owner (admin only)
func (h *DeviceHandler) ResetOwner(c *gin.Context) {
	merchantID := c.Param("merchant_id")

	device, err := h.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return
	}

	device.OwnerID = nil
	if err := h.deviceRepo.UpdateScanResult(device); err != nil {
		response.InternalError(c, "重置负责人失败")
		return
	}

	response.SuccessWithMessage(c, "负责人已重置", nil)
}

// BackupLicense 导出 License SQL 备份文件
func (h *DeviceHandler) BackupLicense(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
		return
	}

	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
	if merchantID == "" {
		response.BadRequest(c, "商家ID不能为空")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "设备IP为空，无法备份License")
		return
	}

	result, err := h.licenseService.Backup(host)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	encodedFileName := url.QueryEscape(result.FileName)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Type", "application/sql; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+encodedFileName)
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")
	c.Data(http.StatusOK, "application/sql; charset=utf-8", result.Content)
}

// ImportLicense 导入 License SQL 文件
func (h *DeviceHandler) ImportLicense(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
		return
	}

	merchantID := strings.TrimSpace(c.PostForm("merchant_id"))
	if merchantID == "" {
		response.BadRequest(c, "商家ID不能为空")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "设备IP为空，无法导入License")
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传SQL文件")
		return
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".sql" {
		response.BadRequest(c, "仅支持上传 .sql 文件")
		return
	}
	if fileHeader.Size <= 0 {
		response.BadRequest(c, "SQL文件为空")
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		response.BadRequest(c, "读取SQL文件失败")
		return
	}
	defer file.Close()

	const maxSQLFileSize = 20 * 1024 * 1024
	content, err := io.ReadAll(io.LimitReader(file, maxSQLFileSize+1))
	if err != nil {
		response.BadRequest(c, "读取SQL文件失败")
		return
	}
	if int64(len(content)) > maxSQLFileSize {
		response.BadRequest(c, "SQL文件过大，限制为20MB")
		return
	}
	if strings.TrimSpace(string(content)) == "" {
		response.BadRequest(c, "SQL文件内容为空")
		return
	}

	importResult, err := h.licenseService.Import(host, string(content))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "License导入成功", gin.H{
		"executed_count": importResult.ExecutedCount,
		"file_name":      fileHeader.Filename,
	})
}

func (h *DeviceHandler) getPermittedDeviceForLicense(c *gin.Context, merchantID string) (*models.ScanResult, bool) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "未授权")
		return nil, false
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil || user == nil {
		response.Unauthorized(c, "用户不存在")
		return nil, false
	}

	device, err := h.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil || device == nil {
		response.NotFound(c, "设备不存在")
		return nil, false
	}

	if h.accessService == nil {
		if user.Role == "admin" {
			return device, true
		}
		if device.OwnerID != nil && *device.OwnerID == userID {
			return device, true
		}
		occupancy, occErr := h.deviceRepo.GetOccupancyByMerchantID(merchantID)
		if occErr == nil && occupancy != nil && occupancy.UserID == userID && occupancy.EndTime.After(time.Now()) {
			return device, true
		}
		response.Forbidden(c, "permission denied")
		return nil, false
	}

	allowed, err := h.accessService.CanAccessUser(user, services.AssetScope{
		AssetType:  models.BorrowAssetTypePOS,
		MerchantID: merchantID,
	}, services.ActionAssetManage)
	if err != nil {
		response.InternalError(c, "权限校验失败")
		return nil, false
	}
	if allowed {
		return device, true
	}

	response.Forbidden(c, "您没有权限操作此设备，只有管理员、负责人或借用人才能访问")
	return nil, false
}

// parseDateTime parses various datetime formats
func parseDateTime(s string) (time.Time, error) {
	// Try RFC3339
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.Local(), nil
	}

	// Try ISO format without timezone
	if t, err := time.Parse("2006-01-02T15:04:05", s); err == nil {
		return t.Local(), nil
	}

	// Try ISO format with Z
	s = strings.Replace(s, "Z", "", 1)
	if t, err := time.Parse("2006-01-02T15:04:05.000", s); err == nil {
		return t.Local(), nil
	}

	return time.Parse(time.RFC3339, s)
}

// GetFilterOptions 获取筛选选项（类型和分类列表）
func (h *DeviceHandler) GetFilterOptions(c *gin.Context) {
	types, err := h.deviceRepo.GetDistinctTypes()
	if err != nil {
		types = []string{}
	}

	properties, err := h.deviceRepo.GetDistinctProperties()
	if err != nil {
		properties = []string{}
	}

	response.Success(c, gin.H{
		"types":      types,
		"properties": properties,
	})
}
