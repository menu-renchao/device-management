package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"device-management/internal/logger"
	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *DeviceHandler) ExportMenuPackage(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
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
	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "设备IP为空，无法导出菜单")
		return
	}

	version := ""
	if device.Version != nil {
		version = strings.TrimSpace(*device.Version)
	}

	result, err := h.menuPackageService.CreatePackage(host, merchantID, version)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "菜单导出成功", gin.H{
		"package": result,
	})
}

func (h *DeviceHandler) ListMenuPackages(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}
	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	items, err := h.menuPackageService.ListPackages(merchantID)
	if err != nil {
		response.InternalError(c, "查询菜单包列表失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{
		"items": items,
		"total": len(items),
	})
}

func (h *DeviceHandler) ListAllMenuPackages(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
		return
	}

	targetMerchantID := strings.TrimSpace(c.Query("merchant_id"))
	if targetMerchantID == "" {
		response.BadRequest(c, "merchant_id is required")
		return
	}
	if _, ok := h.getPermittedDeviceForLicense(c, targetMerchantID); !ok {
		return
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "unauthorized")
		return
	}
	user, err := h.userRepo.GetByID(userID)
	if err != nil || user == nil {
		response.Unauthorized(c, "user not found")
		return
	}

	sourceMerchantIDs, err := h.listAccessibleManagedMerchantIDs(user, targetMerchantID)
	if err != nil {
		response.InternalError(c, "failed to list accessible merchants: "+err.Error())
		return
	}
	groups, err := h.menuPackageService.ListPackageGroups(sourceMerchantIDs, targetMerchantID)
	if err != nil {
		response.InternalError(c, "failed to list menu packages: "+err.Error())
		return
	}

	payload := make([]gin.H, 0, len(groups))
	for _, group := range groups {
		items := make([]gin.H, 0, len(group.Items))
		for _, item := range group.Items {
			items = append(items, gin.H{
				"source_merchant_id": group.SourceMerchantID,
				"name":               item.Name,
				"source_version":     item.SourceVersion,
				"size":               item.Size,
				"mod_time":           item.ModTime,
			})
		}
		payload = append(payload, gin.H{
			"source_merchant_id": group.SourceMerchantID,
			"total":              len(items),
			"items":              items,
		})
	}

	response.Success(c, gin.H{
		"target_merchant_id": targetMerchantID,
		"groups":             payload,
	})
}

func (h *DeviceHandler) DownloadMenuPackage(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	fileName := strings.TrimSpace(c.Query("file_name"))
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "参数不完整")
		return
	}
	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	file, size, err := h.menuPackageService.OpenPackageFile(merchantID, fileName)
	if err != nil {
		if os.IsNotExist(err) {
			response.NotFound(c, "菜单包不存在")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}
	defer file.Close()

	encodedFileName := url.QueryEscape(fileName)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Type", "application/sql; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+encodedFileName)
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")
	c.DataFromReader(http.StatusOK, size, "application/sql; charset=utf-8", file, nil)
}

func (h *DeviceHandler) DeleteMenuPackage(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	fileName := strings.TrimSpace(c.Query("file_name"))
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "参数不完整")
		return
	}
	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	if err := h.menuPackageService.DeletePackage(merchantID, fileName); err != nil {
		if os.IsNotExist(err) {
			response.NotFound(c, "菜单包不存在")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "菜单包删除成功", nil)
}

func (h *DeviceHandler) ImportMenuFromServer(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
		return
	}

	var req struct {
		MerchantID            string `json:"merchant_id" binding:"required"`
		SourceMerchantID      string `json:"source_merchant_id"`
		FileName              string `json:"file_name" binding:"required"`
		RestartPOSAfterImport bool   `json:"restart_pos_after_import"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
	sourceMerchantID := strings.TrimSpace(req.SourceMerchantID)
	fileName := strings.TrimSpace(req.FileName)
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "参数不完整")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}
	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "设备IP为空，无法导入菜单")
		return
	}

	importSourceMerchantID := merchantID
	if sourceMerchantID != "" {
		if _, ok := h.getPermittedDeviceForLicense(c, sourceMerchantID); !ok {
			return
		}
		importSourceMerchantID = sourceMerchantID
	}

	if err := h.menuPackageService.ImportFromServerPackage(host, importSourceMerchantID, fileName); err != nil {
		logger.Error("menu import from server failed",
			"request_id", middleware.GetRequestID(c),
			"target_merchant_id", merchantID,
			"source_merchant_id", importSourceMerchantID,
			"file_name", fileName,
			"host", host,
			"error", err.Error(),
		)
		_ = c.Error(err)
		response.BadRequest(c, err.Error())
		return
	}

	restartResult := h.tryRestartPOSAfterRestore(device, merchantID, req.RestartPOSAfterImport)
	response.SuccessWithMessage(c, "菜单导入成功", gin.H{
		"source_type":        "server",
		"file_name":          fileName,
		"source_merchant_id": importSourceMerchantID,
		"restart":            restartResult,
	})
}

func (h *DeviceHandler) ImportMenuFromUpload(c *gin.Context) {
	if h.menuPackageService == nil {
		response.InternalError(c, "menu package service not initialized")
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
		response.BadRequest(c, "设备IP为空，无法导入菜单")
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传 .menupack.sql 文件")
		return
	}
	if fileHeader.Size <= 0 {
		response.BadRequest(c, "上传文件为空")
		return
	}
	if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".menupack.sql") {
		response.BadRequest(c, "仅支持上传 .menupack.sql 文件")
		return
	}

	restartPOSAfterImport := parseBoolFormValue(c.PostForm("restart_pos_after_import"))
	tempFilePath := filepath.Join(
		os.TempDir(),
		fmt.Sprintf("menu_import_%d_%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename)),
	)
	if err := c.SaveUploadedFile(fileHeader, tempFilePath); err != nil {
		response.InternalError(c, "保存上传文件失败")
		return
	}
	defer os.Remove(tempFilePath)

	if err := h.menuPackageService.ImportFromUploadPackage(host, tempFilePath); err != nil {
		logger.Error("menu import from upload failed",
			"request_id", middleware.GetRequestID(c),
			"target_merchant_id", merchantID,
			"file_name", fileHeader.Filename,
			"host", host,
			"error", err.Error(),
		)
		_ = c.Error(err)
		response.BadRequest(c, err.Error())
		return
	}

	restartResult := h.tryRestartPOSAfterRestore(device, merchantID, restartPOSAfterImport)
	response.SuccessWithMessage(c, "菜单导入成功", gin.H{
		"source_type": "upload",
		"file_name":   fileHeader.Filename,
		"restart":     restartResult,
	})
}

func (h *DeviceHandler) listAccessibleManagedMerchantIDs(user *models.User, targetMerchantID string) ([]string, error) {
	results, _, _, err := h.deviceRepo.ListScanResults(1, 1000, "", nil, nil, false, user.ID)
	if err != nil {
		return nil, err
	}

	sourceMerchantIDs := make([]string, 0, len(results))
	for _, result := range results {
		if result.MerchantID == nil {
			continue
		}
		merchantID := strings.TrimSpace(*result.MerchantID)
		if merchantID == "" || merchantID == targetMerchantID {
			continue
		}

		allowed, accessErr := h.canAccessManagedMerchant(user, merchantID)
		if accessErr != nil {
			return nil, accessErr
		}
		if allowed {
			sourceMerchantIDs = append(sourceMerchantIDs, merchantID)
		}
	}

	sort.Strings(sourceMerchantIDs)
	return sourceMerchantIDs, nil
}

func (h *DeviceHandler) canAccessManagedMerchant(user *models.User, merchantID string) (bool, error) {
	if user == nil {
		return false, nil
	}

	if h.accessService == nil {
		if user.Role == "admin" {
			return true, nil
		}

		device, err := h.deviceRepo.GetScanResultByMerchantID(merchantID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return false, nil
			}
			return false, err
		}
		if device.OwnerID != nil && *device.OwnerID == user.ID {
			return true, nil
		}

		occupancy, occErr := h.deviceRepo.GetOccupancyByMerchantID(merchantID)
		if occErr == nil && occupancy != nil && occupancy.UserID == user.ID && occupancy.EndTime.After(time.Now()) {
			return true, nil
		}
		if occErr != nil && !errors.Is(occErr, gorm.ErrRecordNotFound) {
			return false, occErr
		}

		return false, nil
	}

	return h.accessService.CanAccessUser(user, services.AssetScope{
		AssetType:  models.BorrowAssetTypePOS,
		MerchantID: merchantID,
	}, services.ActionAssetManage)
}
