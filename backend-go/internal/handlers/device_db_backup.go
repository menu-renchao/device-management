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

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *DeviceHandler) BackupDatabase(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "璇锋眰鏍煎紡鏃犳晥")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
	if merchantID == "" {
		response.BadRequest(c, "鍟嗗ID涓嶈兘涓虹┖")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "璁惧IP涓虹┖锛屾棤娉曞浠芥暟鎹簱")
		return
	}

	version := ""
	if device.Version != nil {
		version = strings.TrimSpace(*device.Version)
	}

	result, err := h.dbBackupService.CreateBackup(host, merchantID, version)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "鏁版嵁澶囦唤鎴愬姛", gin.H{
		"backup": result,
	})
}

func (h *DeviceHandler) ListDatabaseBackups(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 涓嶈兘涓虹┖")
		return
	}

	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	items, err := h.dbBackupService.ListBackups(merchantID)
	if err != nil {
		response.InternalError(c, "鏌ヨ澶囦唤鍒楄〃澶辫触: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": items,
		"total": len(items),
	})
}

func (h *DeviceHandler) ListAllDatabaseBackups(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "database backup service not initialized")
		return
	}
	if h.licenseService == nil {
		response.InternalError(c, "license service not initialized")
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

	licenseBackups, err := h.licenseService.ListBackups(targetMerchantID)
	if err != nil {
		response.InternalError(c, "failed to list license backups: "+err.Error())
		return
	}

	sourceMerchantIDs, err := h.listAccessibleDatabaseBackupSourceMerchantIDs(user, targetMerchantID)
	if err != nil {
		response.InternalError(c, "failed to list accessible backup merchants: "+err.Error())
		return
	}

	backupGroups, err := h.dbBackupService.ListBackupGroups(sourceMerchantIDs, targetMerchantID)
	if err != nil {
		response.InternalError(c, "failed to list database backups: "+err.Error())
		return
	}

	groups := make([]gin.H, 0, len(backupGroups))
	for _, backupGroup := range backupGroups {
		groupItems := make([]gin.H, 0, len(backupGroup.Items))
		for _, item := range backupGroup.Items {
			groupItems = append(groupItems, gin.H{
				"source_merchant_id": backupGroup.SourceMerchantID,
				"name":               item.Name,
				"version":            item.Version,
				"size":               item.Size,
				"mod_time":           item.ModTime,
			})
		}

		groups = append(groups, gin.H{
			"source_merchant_id": backupGroup.SourceMerchantID,
			"total":              len(groupItems),
			"items":              groupItems,
		})
	}

	response.Success(c, gin.H{
		"target_merchant_id":   targetMerchantID,
		"license_backup_ready": len(licenseBackups) > 0,
		"groups":               groups,
	})
}

func (h *DeviceHandler) DownloadDatabaseBackup(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	fileName := strings.TrimSpace(c.Query("file_name"))
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "鍙傛暟涓嶅畬鏁?")
		return
	}

	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	file, size, err := h.dbBackupService.OpenBackupFile(merchantID, fileName)
	if err != nil {
		if os.IsNotExist(err) {
			response.NotFound(c, "澶囦唤鏂囦欢涓嶅瓨鍦?")
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

func (h *DeviceHandler) DeleteDatabaseBackup(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	fileName := strings.TrimSpace(c.Query("file_name"))
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "鍙傛暟涓嶅畬鏁?")
		return
	}

	if _, ok := h.getPermittedDeviceForLicense(c, merchantID); !ok {
		return
	}

	if err := h.dbBackupService.DeleteBackup(merchantID, fileName); err != nil {
		if os.IsNotExist(err) {
			response.NotFound(c, "澶囦唤鏂囦欢涓嶅瓨鍦?")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "澶囦唤鏂囦欢鍒犻櫎鎴愬姛", nil)
}

func (h *DeviceHandler) RestoreDatabaseFromServer(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	var req struct {
		MerchantID             string `json:"merchant_id" binding:"required"`
		SourceMerchantID       string `json:"source_merchant_id"`
		FileName               string `json:"file_name" binding:"required"`
		RestartPOSAfterRestore bool   `json:"restart_pos_after_restore"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "璇锋眰鏍煎紡鏃犳晥")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
	sourceMerchantID := strings.TrimSpace(req.SourceMerchantID)
	fileName := strings.TrimSpace(req.FileName)
	if merchantID == "" || fileName == "" {
		response.BadRequest(c, "鍙傛暟涓嶅畬鏁?")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "璁惧IP涓虹┖锛屾棤娉曟仮澶嶆暟鎹簱")
		return
	}

	restoreSourceMerchantID := merchantID
	if sourceMerchantID != "" {
		if sourceMerchantID == merchantID {
			response.BadRequest(c, "source_merchant_id cannot be the same as merchant_id")
			return
		}
		if h.licenseService == nil {
			response.InternalError(c, "license service not initialized")
			return
		}

		licenseBackups, err := h.licenseService.ListBackups(merchantID)
		if err != nil {
			response.InternalError(c, "failed to list license backups: "+err.Error())
			return
		}
		if len(licenseBackups) == 0 {
			response.BadRequest(c, "License backup is required before importing data from another device")
			return
		}
		if _, ok := h.getPermittedDeviceForLicense(c, sourceMerchantID); !ok {
			return
		}

		restoreSourceMerchantID = sourceMerchantID
	}

	restoreFn := h.dbBackupService.RestoreFromServerFile
	if sourceMerchantID != "" {
		restoreFn = h.dbBackupService.RestoreFromMerchantBackupFile
	}

	if err := restoreFn(host, restoreSourceMerchantID, fileName); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	restartResult := h.tryRestartPOSAfterRestore(device, merchantID, req.RestartPOSAfterRestore)
	response.SuccessWithMessage(c, "鏁版嵁鎭㈠鎴愬姛", gin.H{
		"source_type":        "server",
		"file_name":          fileName,
		"source_merchant_id": restoreSourceMerchantID,
		"restart":            restartResult,
	})
}

func (h *DeviceHandler) RestoreDatabaseFromUpload(c *gin.Context) {
	if h.dbBackupService == nil {
		response.InternalError(c, "鏁版嵁搴撳浠芥湇鍔℃湭鍒濆鍖?")
		return
	}

	merchantID := strings.TrimSpace(c.PostForm("merchant_id"))
	if merchantID == "" {
		response.BadRequest(c, "鍟嗗ID涓嶈兘涓虹┖")
		return
	}

	device, ok := h.getPermittedDeviceForLicense(c, merchantID)
	if !ok {
		return
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		response.BadRequest(c, "璁惧IP涓虹┖锛屾棤娉曟仮澶嶆暟鎹簱")
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "璇蜂笂浼?.sql 鏂囦欢")
		return
	}
	if fileHeader.Size <= 0 {
		response.BadRequest(c, "涓婁紶鏂囦欢涓虹┖")
		return
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".sql" {
		response.BadRequest(c, "浠呮敮鎸佷笂浼?.sql 鏂囦欢")
		return
	}

	restartPOSAfterRestore := parseBoolFormValue(c.PostForm("restart_pos_after_restore"))
	tempFilePath := filepath.Join(
		os.TempDir(),
		fmt.Sprintf("db_restore_%d_%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename)),
	)
	if err := c.SaveUploadedFile(fileHeader, tempFilePath); err != nil {
		response.InternalError(c, "淇濆瓨涓婁紶鏂囦欢澶辫触")
		return
	}
	defer os.Remove(tempFilePath)

	if err := h.dbBackupService.RestoreFromUploadFile(host, tempFilePath); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	restartResult := h.tryRestartPOSAfterRestore(device, merchantID, restartPOSAfterRestore)
	response.SuccessWithMessage(c, "鏁版嵁鎭㈠鎴愬姛", gin.H{
		"source_type": "upload",
		"file_name":   fileHeader.Filename,
		"restart":     restartResult,
	})
}

func (h *DeviceHandler) tryRestartPOSAfterRestore(device *models.ScanResult, merchantID string, requested bool) gin.H {
	if !requested {
		return gin.H{
			"requested": false,
			"attempted": false,
			"success":   false,
			"message":   "鏈姹傞噸鍚疨OS",
		}
	}

	if device == nil || device.Type == nil || !strings.Contains(strings.ToLower(strings.TrimSpace(*device.Type)), "linux") {
		return gin.H{
			"requested": true,
			"attempted": false,
			"success":   false,
			"message":   "褰撳墠璁惧闈濴inux锛屽凡璺宠繃閲嶅惎",
		}
	}

	if h.linuxService == nil {
		return gin.H{
			"requested": true,
			"attempted": false,
			"success":   false,
			"message":   "Linux鏈嶅姟鏈垵濮嬪寲锛屽凡璺宠繃閲嶅惎",
		}
	}

	if !h.linuxService.IsConnected(merchantID) {
		return gin.H{
			"requested": true,
			"attempted": false,
			"success":   false,
			"message":   "鏈缓绔婼SH杩炴帴锛屽凡璺宠繃閲嶅惎",
		}
	}

	msg, err := h.linuxService.RestartPOS(merchantID)
	if err != nil {
		return gin.H{
			"requested": true,
			"attempted": true,
			"success":   false,
			"message":   "鎭㈠鎴愬姛锛屼絾閲嶅惎POS澶辫触: " + err.Error(),
		}
	}

	return gin.H{
		"requested": true,
		"attempted": true,
		"success":   true,
		"message":   msg,
	}
}

func parseBoolFormValue(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	return normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on"
}

func (h *DeviceHandler) listAccessibleDatabaseBackupSourceMerchantIDs(user *models.User, targetMerchantID string) ([]string, error) {
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

		allowed, accessErr := h.canAccessDatabaseBackupMerchant(user, merchantID)
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

func (h *DeviceHandler) canAccessDatabaseBackupMerchant(user *models.User, merchantID string) (bool, error) {
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
