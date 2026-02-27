package handlers

import (
	"context"
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"device-management/internal/middleware"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"
	"device-management/pkg/ssh"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// LinuxHandler Linux 设备 Handler
type LinuxHandler struct {
	linuxService   *services.LinuxService
	fileConfigRepo *repository.FileConfigRepository
	deviceRepo     *repository.DeviceRepository
	userRepo       *repository.UserRepository
}

// NewLinuxHandler 创建 Linux Handler
func NewLinuxHandler(linuxService *services.LinuxService, fileConfigRepo *repository.FileConfigRepository, deviceRepo *repository.DeviceRepository, userRepo *repository.UserRepository) *LinuxHandler {
	return &LinuxHandler{
		linuxService:   linuxService,
		fileConfigRepo: fileConfigRepo,
		deviceRepo:     deviceRepo,
		userRepo:       userRepo,
	}
}

// checkDevicePermission 检查用户是否有设备操作权限
// 返回 true 表示有权限（管理员、负责人、借用人）
func (h *LinuxHandler) checkDevicePermission(c *gin.Context, merchantID string) bool {
	userID := middleware.GetUserID(c)

	// 获取当前用户
	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		response.Unauthorized(c, "用户不存在")
		return false
	}

	// 管理员有全部权限
	if user.Role == "admin" {
		return true
	}

	// 获取设备信息
	device, err := h.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil {
		response.NotFound(c, "设备不存在")
		return false
	}

	// 检查是否是负责人
	if device.OwnerID != nil && *device.OwnerID == userID {
		return true
	}

	// 检查是否是借用人
	occupancy, err := h.deviceRepo.GetOccupancyByMerchantID(merchantID)
	if err == nil && occupancy != nil && occupancy.EndTime.After(time.Now()) && occupancy.UserID == userID {
		return true
	}

	response.Forbidden(c, "您没有权限操作此设备，只有管理员、负责人或借用人才能访问")
	return false
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ConnectRequest 连接请求
type ConnectRequest struct {
	MerchantID string `json:"merchant_id" binding:"required"`
	Host       string `json:"host" binding:"required"`
	Port       int    `json:"port"`
	User       string `json:"user" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

// TestConnectionRequest 测试连接请求（不需要 merchant_id）
type TestConnectionRequest struct {
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port"`
	User     string `json:"user" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Connect 建立 SSH 连接
func (h *LinuxHandler) Connect(c *gin.Context) {
	var req ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	config := &services.ConnectionConfig{
		Host:     req.Host,
		Port:     req.Port,
		User:     req.User,
		Password: req.Password,
	}

	if err := h.linuxService.Connect(req.MerchantID, config); err != nil {
		response.InternalError(c, fmt.Sprintf("连接失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "连接成功", gin.H{
		"merchant_id": req.MerchantID,
		"host":        req.Host,
	})
}

// Disconnect 断开连接
func (h *LinuxHandler) Disconnect(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if err := h.linuxService.Disconnect(req.MerchantID); err != nil {
		response.InternalError(c, fmt.Sprintf("断开连接失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "已断开连接", nil)
}

// GetStatus 获取连接状态
func (h *LinuxHandler) GetStatus(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	connected := h.linuxService.IsConnected(merchantID)

	result := gin.H{
		"merchant_id": merchantID,
		"connected":   connected,
	}

	if connected {
		info, err := h.linuxService.GetConnectionInfo(merchantID)
		if err == nil {
			result["info"] = info
		}

		// 获取 POS 状态
		posStatus, _ := h.linuxService.GetPOSStatus(merchantID)
		result["pos_status"] = posStatus
	}

	response.Success(c, result)
}

// TestConnection 测试连接
func (h *LinuxHandler) TestConnection(c *gin.Context) {
	var req TestConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	config := &services.ConnectionConfig{
		Host:     req.Host,
		Port:     req.Port,
		User:     req.User,
		Password: req.Password,
	}

	// 测试端口可达性
	port := req.Port
	if port == 0 {
		port = 22
	}
	if !ssh.CheckPortReachable(req.Host, port, 5*time.Second) {
		response.BadRequest(c, "主机不可达或端口未开放")
		return
	}

	if err := h.linuxService.TestConnection(config); err != nil {
		response.InternalError(c, fmt.Sprintf("连接测试失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "连接测试成功", nil)
}

// StopPOS 停止 POS
func (h *LinuxHandler) StopPOS(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	msg, err := h.linuxService.StopPOS(req.MerchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("停止 POS 失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// StartPOS 启动 POS
func (h *LinuxHandler) StartPOS(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	msg, err := h.linuxService.StartPOS(req.MerchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("启动 POS 失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// RestartPOS 重启 POS
func (h *LinuxHandler) RestartPOS(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	msg, err := h.linuxService.RestartPOS(req.MerchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("重启 POS 失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// RestartTomcat 重启 Tomcat
func (h *LinuxHandler) RestartTomcat(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	msg, err := h.linuxService.RestartTomcat(req.MerchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("重启 Tomcat 失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// UploadWAR 上传 WAR 包
func (h *LinuxHandler) UploadWAR(c *gin.Context) {
	merchantID := c.PostForm("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	// 获取可选的目标路径参数
	targetPath := c.PostForm("target_path")

	// 权限检查
	if !h.checkDevicePermission(c, merchantID) {
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "上传文件无效")
		return
	}
	defer file.Close()

	// 保存到临时文件
	tempDir := c.GetString("temp_dir")
	if tempDir == "" {
		tempDir = "/tmp"
	}
	tempPath := filepath.Join(tempDir, header.Filename)

	// 确保删除临时文件
	defer func() {
		// 可以选择保留或删除
	}()

	// 创建临时文件
	if err := c.SaveUploadedFile(header, tempPath); err != nil {
		response.InternalError(c, "保存临时文件失败")
		return
	}

	// 确定远程路径
	var remotePath string
	if targetPath != "" {
		remotePath = targetPath
	} else {
		remotePath = "/opt/tomcat7/webapps/" + header.Filename
	}

	// 开始上传任务
	taskInfo, err := h.linuxService.StartUploadTask(merchantID, tempPath, remotePath)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("开始上传失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"task_id":    taskInfo.ID,
		"file_name":  taskInfo.FileName,
		"total_size": taskInfo.TotalSize,
		"status":     taskInfo.Status,
	})
}

// GetUploadProgress 获取上传进度
func (h *LinuxHandler) GetUploadProgress(c *gin.Context) {
	taskID := c.Param("taskId")
	if taskID == "" {
		response.BadRequest(c, "taskId 不能为空")
		return
	}

	taskInfo, err := h.linuxService.GetUploadProgress(taskID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, taskInfo)
}

// CreateBackup 创建备份
func (h *LinuxHandler) CreateBackup(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	backupPath, err := h.linuxService.CreateBackup(req.MerchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("创建备份失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "备份创建成功", gin.H{
		"backup_path": backupPath,
	})
}

// ListBackups 备份列表
func (h *LinuxHandler) ListBackups(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	backups, err := h.linuxService.ListBackups(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("获取备份列表失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"backups": backups,
	})
}

// RestoreBackup 恢复备份
func (h *LinuxHandler) RestoreBackup(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		BackupPath string `json:"backup_path" binding:"required"`
		IsZip      bool   `json:"is_zip"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	msg, err := h.linuxService.RestoreBackup(req.MerchantID, req.BackupPath, req.IsZip)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("恢复备份失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// ListLogs 日志列表
func (h *LinuxHandler) ListLogs(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	logs, err := h.linuxService.ListLogs(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("获取日志列表失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"logs": logs,
	})
}

// DownloadLog 下载日志
func (h *LinuxHandler) DownloadLog(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	logPath := c.Query("log_path")

	if merchantID == "" || logPath == "" {
		response.BadRequest(c, "参数不完整")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	reader, size, err := h.linuxService.DownloadLog(merchantID, logPath)
	if err != nil {
		response.NotFound(c, "日志文件不存在: "+err.Error())
		return
	}

	filename := filepath.Base(logPath)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.DataFromReader(200, size, "application/octet-stream", reader.(io.ReadCloser), nil)
}

// ReadLogContent 读取日志内容
func (h *LinuxHandler) ReadLogContent(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	logPath := c.Query("log_path")
	linesStr := c.DefaultQuery("lines", "100")

	if merchantID == "" || logPath == "" {
		response.BadRequest(c, "参数不完整")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	lines, _ := strconv.Atoi(linesStr)
	content, err := h.linuxService.ReadLogContent(merchantID, logPath, lines)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("读取日志失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"content": content,
		"path":    logPath,
	})
}

// RealtimeLog 实时日志 (WebSocket)
func (h *LinuxHandler) RealtimeLog(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	logPath := c.Query("log_path")
	token := c.Query("token")

	log.Printf("[RealtimeLog] 收到请求: merchantID=%s, logPath=%s, token长度=%d", merchantID, logPath, len(token))

	if merchantID == "" || logPath == "" {
		log.Printf("[RealtimeLog] 参数不完整")
		c.JSON(400, gin.H{"error": "参数不完整"})
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		log.Printf("[RealtimeLog] SSH 未连接")
		c.JSON(400, gin.H{"error": "未连接"})
		return
	}

	// 升级为 WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[RealtimeLog] WebSocket 升级失败: %v", err)
		return
	}
	defer conn.Close()
	log.Printf("[RealtimeLog] WebSocket 升级成功")

	// 获取 SSH 会话
	info, exists := ssh.GetSessionPool().Get(merchantID)
	if !exists {
		log.Printf("[RealtimeLog] SSH 会话不存在")
		conn.WriteMessage(websocket.TextMessage, []byte("错误: SSH 会话不存在"))
		return
	}

	// 先发送最后 50 行日志
	lastLinesCmd := fmt.Sprintf("tail -n 50 %s 2>/dev/null || echo '无法读取日志文件'", logPath)
	log.Printf("[RealtimeLog] 执行初始命令: %s", lastLinesCmd)
	lastLines, err := info.Client.ExecuteCommand(lastLinesCmd)
	if err != nil {
		log.Printf("[RealtimeLog] 初始命令执行失败: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("读取初始日志失败: %v", err)))
	} else if lastLines != "" {
		log.Printf("[RealtimeLog] 发送初始日志，长度=%d", len(lastLines))
		conn.WriteMessage(websocket.TextMessage, []byte(lastLines))
	}

	// 启动 tail -F 命令
	tailCmd := fmt.Sprintf("tail -F %s", logPath)
	log.Printf("[RealtimeLog] 启动命令: %s", tailCmd)
	cmdSession, err := info.Client.StartCommand(tailCmd)
	if err != nil {
		log.Printf("[RealtimeLog] 启动命令失败: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("启动命令失败: %s", err.Error())))
		return
	}
	defer cmdSession.Close()

	log.Printf("[RealtimeLog] tail 命令已启动，开始监听")
	conn.WriteMessage(websocket.TextMessage, []byte("\n--- 开始实时监听 ---\n"))

	// 创建上下文用于取消
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 同时读取 stdout 和 stderr
	go func() {
		buf := make([]byte, 8192)
		for {
			select {
			case <-ctx.Done():
				log.Printf("[RealtimeLog] stdout goroutine 收到停止信号")
				return
			default:
				n, err := cmdSession.Stdout.Read(buf)
				if err != nil {
					log.Printf("[RealtimeLog] stdout 读取结束: %v", err)
					return
				}
				if n > 0 {
					log.Printf("[RealtimeLog] stdout 读取了 %d 字节", n)
					if err := conn.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
						log.Printf("[RealtimeLog] WebSocket 写入失败: %v", err)
						return
					}
				}
			}
		}
	}()

	go func() {
		buf := make([]byte, 8192)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := cmdSession.Stderr.Read(buf)
				if err != nil {
					return
				}
				if n > 0 {
					log.Printf("[RealtimeLog] stderr 读取了 %d 字节: %s", n, string(buf[:n]))
					conn.WriteMessage(websocket.TextMessage, buf[:n])
				}
			}
		}
	}()

	// 等待客户端断开
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[RealtimeLog] WebSocket 客户端断开: %v", err)
			cancel()
			break
		}
	}
}

// GetAppVersion 获取应用版本
func (h *LinuxHandler) GetAppVersion(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	version, err := h.linuxService.GetAppVersion(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("获取版本失败: %s", err.Error()))
		return
	}

	response.Success(c, version)
}

// GetCloudVersion 获取 CloudDataHub 版本
func (h *LinuxHandler) GetCloudVersion(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	version, err := h.linuxService.GetCloudVersion(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("获取版本失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"cloud_version": version,
	})
}

// GetRemoteMD5 获取远程 MD5
func (h *LinuxHandler) GetRemoteMD5(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		RemotePath string `json:"remote_path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	md5, err := h.linuxService.GetRemoteMD5(req.MerchantID, req.RemotePath)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("计算 MD5 失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"md5": md5,
	})
}

// CalculateLocalMD5 计算本地 MD5
func (h *LinuxHandler) CalculateLocalMD5(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "上传文件无效")
		return
	}
	defer file.Close()

	// 读取文件计算 MD5
	buf := make([]byte, 32*1024)
	hash := md5.New()
	for {
		n, err := file.Read(buf)
		if n > 0 {
			hash.Write(buf[:n])
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			response.InternalError(c, "计算 MD5 失败")
			return
		}
	}

	md5Str := fmt.Sprintf("%x", hash.Sum(nil))

	response.Success(c, gin.H{
		"md5": md5Str,
	})
}

// GetConfig 获取配置文件
func (h *LinuxHandler) GetConfig(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	configPath := c.Query("config_path")

	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	// 如果没有指定路径，返回可用的配置文件列表
	if configPath == "" {
		configs, err := h.linuxService.ListConfigFiles(merchantID)
		if err != nil {
			response.InternalError(c, fmt.Sprintf("获取配置文件列表失败: %s", err.Error()))
			return
		}
		response.Success(c, gin.H{
			"config_files": configs,
		})
		return
	}

	content, err := h.linuxService.GetConfig(merchantID, configPath)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("读取配置文件失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"path":    configPath,
		"content": content,
	})
}

// UpdateConfig 更新配置文件
func (h *LinuxHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		ConfigPath string `json:"config_path" binding:"required"`
		Content    string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	if err := h.linuxService.UpdateConfig(req.MerchantID, req.ConfigPath, req.Content); err != nil {
		response.InternalError(c, fmt.Sprintf("更新配置文件失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "配置文件已更新", nil)
}

// OneClickUpgrade 一键升级
func (h *LinuxHandler) OneClickUpgrade(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		WarPath    string `json:"war_path"`
		Env        string `json:"env"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	// 默认环境为 QA
	if req.Env == "" {
		req.Env = "QA"
	}

	msg, err := h.linuxService.OneClickUpgrade(req.MerchantID, req.WarPath, h.fileConfigRepo, req.Env)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("一键升级失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, msg, nil)
}

// GetSystemInfo 获取系统信息
func (h *LinuxHandler) GetSystemInfo(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	diskUsage, _ := h.linuxService.GetDiskUsage(merchantID)
	memUsage, _ := h.linuxService.GetMemoryUsage(merchantID)

	response.Success(c, gin.H{
		"disk_usage":   diskUsage,
		"memory_usage": memUsage,
	})
}

// ListConfigFiles 列出配置文件
func (h *LinuxHandler) ListConfigFiles(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	configs, err := h.linuxService.ListConfigFiles(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("获取配置文件列表失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"config_files": configs,
	})
}

// ScanUpgradePackages 扫描远程升级包
func (h *LinuxHandler) ScanUpgradePackages(c *gin.Context) {
	merchantID := c.Query("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	packages, err := h.linuxService.ScanUpgradePackages(merchantID)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("扫描升级包失败: %s", err.Error()))
		return
	}

	response.Success(c, gin.H{
		"packages": packages,
	})
}

// UploadUpgradePackage 上传升级包 (zip) 并解压
func (h *LinuxHandler) UploadUpgradePackage(c *gin.Context) {
	merchantID := c.PostForm("merchant_id")
	if merchantID == "" {
		response.BadRequest(c, "merchant_id 不能为空")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, merchantID) {
		return
	}

	if !h.linuxService.IsConnected(merchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "上传文件无效")
		return
	}
	defer file.Close()

	// 检查文件扩展名
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		response.BadRequest(c, "请上传 .zip 格式的升级包")
		return
	}

	// 保存到临时文件
	tempDir := c.GetString("temp_dir")
	if tempDir == "" {
		tempDir = os.TempDir()
	}
	tempPath := filepath.Join(tempDir, header.Filename)

	// 创建临时文件
	if err := c.SaveUploadedFile(header, tempPath); err != nil {
		response.InternalError(c, "保存临时文件失败")
		return
	}

	// 确保删除临时文件
	defer os.Remove(tempPath)

	// 上传并解压
	extractedPath, err := h.linuxService.UploadAndExtractPackage(merchantID, tempPath, func(progress int) {
		// 进度回调（可用于 WebSocket 推送）
	})
	if err != nil {
		response.InternalError(c, fmt.Sprintf("上传解压失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "升级包上传成功", gin.H{
		"extracted_path": extractedPath,
		"package_name":   filepath.Base(extractedPath),
	})
}

// ExecutePackageUpgrade 执行升级包升级
func (h *LinuxHandler) ExecutePackageUpgrade(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id" binding:"required"`
		PackageDir string `json:"package_dir" binding:"required"`
		WarPath    string `json:"war_path"`
		WarSource  string `json:"war_source"` // "local" | "history"
		Env        string `json:"env"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 权限检查
	if !h.checkDevicePermission(c, req.MerchantID) {
		return
	}

	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接")
		return
	}

	// 默认环境为 QA
	if req.Env == "" {
		req.Env = "QA"
	}

	// 执行升级包升级
	err := h.linuxService.ExecutePackageUpgrade(req.MerchantID, req.PackageDir, req.WarPath, req.Env, h.fileConfigRepo, func(progress int, message string) {
		// 进度回调（可用于 WebSocket 推送）
		log.Printf("[ExecutePackageUpgrade] %d%% - %s", progress, message)
	})
	if err != nil {
		response.InternalError(c, fmt.Sprintf("升级包升级失败: %s", err.Error()))
		return
	}

	response.SuccessWithMessage(c, "升级包升级完成", gin.H{
		"package_dir": req.PackageDir,
	})
}
