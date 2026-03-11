package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

func (h *DeviceHandler) CreateLicenseBackup(c *gin.Context) {
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

	result, err := h.licenseService.CreateBackup(host, merchantID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "License备份成功", gin.H{
		"backup": result,
	})
}

func (h *DeviceHandler) ListLicenseBackups(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
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

	items, err := h.licenseService.ListBackups(merchantID)
	if err != nil {
		response.InternalError(c, "查询License备份列表失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": items,
		"total": len(items),
	})
}

func (h *DeviceHandler) DownloadLicenseBackup(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
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

	file, size, err := h.licenseService.OpenBackupFile(merchantID, fileName)
	if err != nil {
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

func (h *DeviceHandler) DeleteLicenseBackup(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
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

	if err := h.licenseService.DeleteBackup(merchantID, fileName); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "License备份文件删除成功", nil)
}

func (h *DeviceHandler) RestoreLicenseFromServer(c *gin.Context) {
	if h.licenseService == nil {
		response.InternalError(c, "License服务未初始化")
		return
	}

	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		FileName   string `json:"file_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
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
		response.BadRequest(c, "设备IP为空，无法恢复License")
		return
	}

	if err := h.licenseService.RestoreFromServerFile(host, merchantID, fileName); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "License恢复成功", gin.H{
		"source_type": "server",
		"file_name":   fileName,
	})
}

func (h *DeviceHandler) RestoreLicenseFromUpload(c *gin.Context) {
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
		response.BadRequest(c, "设备IP为空，无法恢复License")
		return
	}

	fileHeader, content, err := readLicenseUploadContent(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	importResult, err := h.licenseService.Import(host, string(content))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "License恢复成功", gin.H{
		"source_type":    "upload",
		"file_name":      fileHeader.Filename,
		"executed_count": importResult.ExecutedCount,
	})
}

func readLicenseUploadContent(c *gin.Context) (*multipart.FileHeader, []byte, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return nil, nil, fmt.Errorf("请上传SQL文件")
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".sql" {
		return nil, nil, fmt.Errorf("仅支持上传 .sql 文件")
	}
	if fileHeader.Size <= 0 {
		return nil, nil, fmt.Errorf("SQL文件为空")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()

	const maxSQLFileSize = 20 * 1024 * 1024
	content, err := io.ReadAll(io.LimitReader(file, maxSQLFileSize+1))
	if err != nil {
		return nil, nil, fmt.Errorf("读取SQL文件失败")
	}
	if int64(len(content)) > maxSQLFileSize {
		return nil, nil, fmt.Errorf("SQL文件过大，限制为20MB")
	}
	if strings.TrimSpace(string(content)) == "" {
		return nil, nil, fmt.Errorf("SQL文件内容为空")
	}

	return fileHeader, content, nil
}
