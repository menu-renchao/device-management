package handlers

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type WarDownloadHandler struct {
	service    *services.WarDownloadService
	configRepo *repository.SystemConfigRepository
}

func NewWarDownloadHandler(service *services.WarDownloadService, configRepo *repository.SystemConfigRepository) *WarDownloadHandler {
	return &WarDownloadHandler{
		service:    service,
		configRepo: configRepo,
	}
}

// ListPackages 获取已下载的包列表
func (h *WarDownloadHandler) ListPackages(c *gin.Context) {
	// 获取过滤类型参数：war, zip, 或空（全部）
	filterType := c.Query("type")

	packages, err := h.service.ListPackagesWithFilter(filterType)
	if err != nil {
		response.InternalError(c, "获取包列表失败")
		return
	}
	response.Success(c, gin.H{"packages": packages})
}

// StartDownload 开始下载
func (h *WarDownloadHandler) StartDownload(c *gin.Context) {
	var req struct {
		URL         string `json:"url" binding:"required"`
		Overwrite    bool   `json:"overwrite"`
		PackageType string `json:"package_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 直接开始下载，重复检测在下载服务中进行（获取到版本号后）
	task, err := h.service.StartDownload(req.URL, req.Overwrite, req.PackageType)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, gin.H{
		"task_id": task.ID,
		"name":    task.Name,
	})
}

// GetDownloadProgress 获取下载进度
func (h *WarDownloadHandler) GetDownloadProgress(c *gin.Context) {
	taskID := c.Param("taskId")
	task := h.service.GetTask(taskID)
	if task == nil {
		// 返回 not_found 状态，让前端优雅处理
		response.Success(c, gin.H{
			"status": "not_found",
			"error":  "任务不存在",
		})
		return
	}

	response.Success(c, gin.H{
		"status":     task.Status,
		"percentage": task.Percentage,
		"downloaded": task.Downloaded,
		"total":      task.Total,
		"speed":      task.Speed,
		"error":      task.Error,
		"name":       task.Name,
		"file_name":  task.FileName,
	})
}

// CancelDownload 取消下载
func (h *WarDownloadHandler) CancelDownload(c *gin.Context) {
	taskID := c.Param("taskId")
	task := h.service.GetTask(taskID)
	if task == nil {
		response.Success(c, gin.H{"status": "not_found"})
		return
	}

	h.service.CancelTask(taskID)
	response.SuccessWithMessage(c, "已取消", nil)
}

// DeletePackage 删除包
func (h *WarDownloadHandler) DeletePackage(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "包名不能为空")
		return
	}

	if err := h.service.DeletePackage(name); err != nil {
		response.InternalError(c, "删除失败")
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// DownloadPackage 下载包到本地
func (h *WarDownloadHandler) DownloadPackage(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "包名不能为空")
		return
	}

	// 获取包路径
	pkgPath := h.service.GetPackagePath(name)
	if pkgPath == "" {
		response.NotFound(c, "包不存在")
		return
	}

	// 查找包内的 war 文件
	files, err := os.ReadDir(pkgPath)
	if err != nil {
		response.NotFound(c, "包目录不存在")
		return
	}

	var warFile string
	for _, f := range files {
		if !f.IsDir() && (filepath.Ext(f.Name()) == ".war" || filepath.Ext(f.Name()) == ".zip") {
			warFile = f.Name()
			break
		}
	}

	if warFile == "" {
		response.NotFound(c, "包内没有可下载的文件")
		return
	}

	filePath := filepath.Join(pkgPath, warFile)
	fileName := warFile

	// 设置响应头
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Type", "application/octet-stream")
	encodedFileName := url.QueryEscape(fileName)
	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+encodedFileName)
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")

	c.File(filePath)
}

// GetDownloadConfig 获取下载配置（Cookie）
func (h *WarDownloadHandler) GetDownloadConfig(c *gin.Context) {
	config, err := h.configRepo.GetByKey("download_cookie")
	if err != nil {
		response.Success(c, gin.H{"cookie": ""})
		return
	}
	response.Success(c, gin.H{"cookie": config.Value})
}

// UpdateDownloadConfig 更新下载配置（Cookie）
func (h *WarDownloadHandler) UpdateDownloadConfig(c *gin.Context) {
	var req struct {
		Cookie string `json:"cookie"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if err := h.configRepo.Upsert("download_cookie", req.Cookie); err != nil {
		response.InternalError(c, "保存配置失败")
		return
	}

	response.SuccessWithMessage(c, "配置已保存", nil)
}

// UploadLocalFile 上传本地文件到 downloads 目录
func (h *WarDownloadHandler) UploadLocalFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请选择文件")
		return
	}

	// 从文件名提取版本号
	filename := file.Filename
	baseName := filepath.Base(filename)
	ext := filepath.Ext(baseName)
	nameWithoutExt := strings.TrimSuffix(baseName, ext)

	// 创建版本目录（使用文件名作为版本号）
	downloadsDir := h.service.GetDownloadsDir()
	versionDir := filepath.Join(downloadsDir, nameWithoutExt)
	if err := os.MkdirAll(versionDir, 0755); err != nil {
		response.InternalError(c, "创建目录失败")
		return
	}

	// 保存文件到版本目录
	targetPath := filepath.Join(versionDir, baseName)
	if err := c.SaveUploadedFile(file, targetPath); err != nil {
		response.InternalError(c, "保存文件失败")
		return
	}

	response.SuccessWithMessage(c, "上传成功", gin.H{
		"package_name": nameWithoutExt,
		"file_name":    baseName,
		"path":         targetPath,
	})
}

// GetPackageMD5 获取包的 MD5 值
func (h *WarDownloadHandler) GetPackageMD5(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		response.BadRequest(c, "包名不能为空")
		return
	}

	// 获取包路径
	pkgPath := h.service.GetPackagePath(name)
	if pkgPath == "" {
		response.NotFound(c, "包不存在")
		return
	}

	// 查找包内的 war 文件
	files, err := os.ReadDir(pkgPath)
	if err != nil {
		response.NotFound(c, "包目录不存在")
		return
	}

	var warFile string
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(f.Name()) == ".war" {
			warFile = f.Name()
			break
		}
	}

	if warFile == "" {
		response.NotFound(c, "包内没有 WAR 文件")
		return
	}

	// 计算 MD5
	filePath := filepath.Join(pkgPath, warFile)
	file, err := os.Open(filePath)
	if err != nil {
		response.InternalError(c, "打开文件失败")
		return
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		response.InternalError(c, "计算 MD5 失败")
		return
	}

	md5Hash := hex.EncodeToString(hash.Sum(nil))
	response.Success(c, gin.H{"md5": md5Hash, "file_name": warFile})
}
