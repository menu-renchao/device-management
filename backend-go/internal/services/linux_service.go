package services

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/pkg/ssh"

	"github.com/google/uuid"
)

// LinuxService Linux 设备服务
type LinuxService struct {
	pool        *ssh.SessionPool
	uploadTasks map[string]*ssh.UploadTask
	mu          sync.RWMutex
}

// NewLinuxService 创建 Linux 服务
func NewLinuxService() *LinuxService {
	return &LinuxService{
		pool:        ssh.GetSessionPool(),
		uploadTasks: make(map[string]*ssh.UploadTask),
	}
}

// ConnectionConfig 连接配置
type ConnectionConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
}

// Connect 建立 SSH 连接
func (s *LinuxService) Connect(merchantID string, config *ConnectionConfig) error {
	sshConfig := &ssh.Config{
		Host:     config.Host,
		Port:     config.Port,
		User:     config.User,
		Password: config.Password,
		Timeout:  10 * time.Second,
	}

	_, err := s.pool.Connect(merchantID, sshConfig)
	return err
}

// Disconnect 断开连接
func (s *LinuxService) Disconnect(merchantID string) error {
	return s.pool.Disconnect(merchantID)
}

// IsConnected 检查连接状态
func (s *LinuxService) IsConnected(merchantID string) bool {
	return s.pool.IsConnected(merchantID)
}

// TestConnection 测试连接
func (s *LinuxService) TestConnection(config *ConnectionConfig) error {
	sshConfig := &ssh.Config{
		Host:     config.Host,
		Port:     config.Port,
		User:     config.User,
		Password: config.Password,
		Timeout:  10 * time.Second,
	}

	client := ssh.NewClient(sshConfig)
	defer client.Disconnect()

	return client.TestConnection()
}

// GetConnectionInfo 获取连接信息
func (s *LinuxService) GetConnectionInfo(merchantID string) (map[string]interface{}, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, fmt.Errorf("未连接")
	}

	return map[string]interface{}{
		"host":        info.Config.Host,
		"port":        info.Config.Port,
		"user":        info.Config.User,
		"connected":   info.Client.IsConnected(),
		"connect_at":  info.ConnectAt,
		"last_active": info.LastActive,
	}, nil
}

// ExecuteCommand 执行命令
func (s *LinuxService) ExecuteCommand(merchantID, cmd string) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}

	return info.Client.ExecuteCommand(cmd)
}

// ExecuteSudoCommand 执行 sudo 命令
func (s *LinuxService) ExecuteSudoCommand(merchantID, cmd string) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}

	// 使用 echo 密码管道给 sudo -S
	sudoCmd := fmt.Sprintf("echo '%s' | sudo -S %s", info.Password, cmd)
	return info.Client.ExecuteCommand(sudoCmd)
}

// StopPOS 停止 POS 服务 (匹配 Python 版本逻辑)
func (s *LinuxService) StopPOS(merchantID string) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}
	password := info.Password

	// 定义需要杀死的进程列表
	processes := []struct {
		info    string
		process string
	}{
		{"[INFO] Killing menusifu_pos_extention", "/opt/menusifu/menusifu_pos_extention"},
		{"[INFO] Killing do_pos_start", "/opt/POS/do_pos_start"},
		{"[INFO] Killing show_pos_icon", "/opt/POS/show_pos_icon"},
		{"[INFO] Killing tomcat7", "tomcat7"},
	}

	var results []string

	// 逐个杀死进程
	for _, p := range processes {
		cmd := fmt.Sprintf("echo '%s' | sudo -S pkill -9 -f '%s' 2>/dev/null; echo 'done'", password, p.process)
		output, err := info.Client.ExecuteCommand(cmd)
		if err != nil {
			results = append(results, fmt.Sprintf("%s: 错误 %v", p.info, err))
		} else {
			results = append(results, fmt.Sprintf("%s: 完成", p.info))
		}
		_ = output
	}

	// 停止 tomcat.service
	cmd := fmt.Sprintf("echo '%s' | sudo -S systemctl stop tomcat.service 2>/dev/null; echo 'done'", password)
	_, err := info.Client.ExecuteCommand(cmd)
	if err != nil {
		results = append(results, fmt.Sprintf("[INFO] Stopping tomcat.service: 错误 %v", err))
	} else {
		results = append(results, "[INFO] Stopping tomcat.service: 完成")
	}

	return "停止完成:\n" + strings.Join(results, "\n"), nil
}

// StartPOS 启动 POS 服务 (匹配 Python 版本逻辑)
func (s *LinuxService) StartPOS(merchantID string) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}

	// 使用 DISPLAY=:0 /usr/local/bin/pos_start 启动
	cmd := "DISPLAY=:0 /usr/local/bin/pos_start"
	output, err := info.Client.ExecuteCommand(cmd)
	if err != nil {
		return "", fmt.Errorf("启动 POS 失败: %w", err)
	}

	return "启动完成: " + strings.TrimSpace(output), nil
}

// RestartPOS 重启 POS 服务
func (s *LinuxService) RestartPOS(merchantID string) (string, error) {
	// 停止
	stopResult, err := s.StopPOS(merchantID)
	if err != nil {
		return "", err
	}

	// 等待一秒
	time.Sleep(1 * time.Second)

	// 启动
	startResult, err := s.StartPOS(merchantID)
	if err != nil {
		return stopResult + "\n启动失败: " + err.Error(), err
	}

	return stopResult + "\n" + startResult, nil
}

// RestartTomcat 重启 Tomcat
func (s *LinuxService) RestartTomcat(merchantID string) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}
	password := info.Password

	// 使用 sudo systemctl restart tomcat.service
	cmd := fmt.Sprintf("echo '%s' | sudo -S systemctl restart tomcat.service", password)
	output, err := info.Client.ExecuteCommand(cmd)
	if err != nil {
		return "", fmt.Errorf("重启 Tomcat 失败: %w", err)
	}

	return "Tomcat 已重启: " + strings.TrimSpace(output), nil
}

// GetPOSStatus 获取 POS 状态
func (s *LinuxService) GetPOSStatus(merchantID string) (map[string]interface{}, error) {
	// 检查进程状态
	output, err := s.ExecuteCommand(merchantID, "ps aux | grep -E 'pos|menusifu' | grep -v grep | head -5")
	if err != nil {
		return nil, err
	}

	running := len(strings.TrimSpace(output)) > 0

	result := map[string]interface{}{
		"running": running,
	}

	if running {
		result["process_info"] = strings.TrimSpace(output)
	}

	// 检查 systemctl 状态
	statusOutput, _ := s.ExecuteCommand(merchantID, "systemctl is-active pos-service 2>/dev/null || echo 'unknown'")
	result["systemctl_status"] = strings.TrimSpace(statusOutput)

	return result, nil
}

// UploadTaskInfo 上传任务信息
type UploadTaskInfo struct {
	ID          string  `json:"id"`
	FileName    string  `json:"file_name"`
	TotalSize   int64   `json:"total_size"`
	Transferred int64   `json:"transferred"`
	Percentage  float64 `json:"percentage"`
	Status      string  `json:"status"`
	Error       string  `json:"error,omitempty"`
}

// StartUploadTask 开始上传任务
func (s *LinuxService) StartUploadTask(merchantID, localPath, remotePath string) (*UploadTaskInfo, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, fmt.Errorf("未连接")
	}

	// 获取文件大小
	fileInfo, err := os.Stat(localPath)
	if err != nil {
		return nil, fmt.Errorf("获取文件信息失败: %w", err)
	}

	// 创建任务
	taskID := uuid.New().String()
	task := &ssh.UploadTask{
		ID:         taskID,
		LocalPath:  localPath,
		RemotePath: remotePath,
		TotalSize:  fileInfo.Size(),
		Status:     "pending",
	}

	s.mu.Lock()
	s.uploadTasks[taskID] = task
	s.mu.Unlock()

	// 异步上传
	go func() {
		err := info.SFTPClient.UploadFile(localPath, remotePath, func(transferred, total int64, percentage float64) {
			task.UpdateProgress(transferred, percentage)
		})

		if err != nil {
			task.SetFailed(err)
		} else {
			task.SetCompleted()
		}
	}()

	return &UploadTaskInfo{
		ID:        task.ID,
		FileName:  filepath.Base(localPath),
		TotalSize: task.TotalSize,
		Status:    task.Status,
	}, nil
}

// GetUploadProgress 获取上传进度
func (s *LinuxService) GetUploadProgress(taskID string) (*UploadTaskInfo, error) {
	s.mu.RLock()
	task, exists := s.uploadTasks[taskID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("任务不存在")
	}

	transferred, total, percentage, status, err := task.GetStatus()

	result := &UploadTaskInfo{
		ID:          task.ID,
		FileName:    filepath.Base(task.LocalPath),
		TotalSize:   total,
		Transferred: transferred,
		Percentage:  percentage,
		Status:      status,
	}

	if err != nil {
		result.Error = err.Error()
	}

	return result, nil
}

// BackupInfo 备份信息
type BackupInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
	IsDir   bool      `json:"is_dir"`
}

// CreateBackup 创建备份
func (s *LinuxService) CreateBackup(merchantID string) (string, error) {
	// 执行备份脚本（与 Python 版本一致，在 /opt/backup 目录下执行）
	output, err := s.ExecuteCommand(merchantID, "cd /opt/backup && sh backup.sh")
	if err != nil {
		return "", fmt.Errorf("创建备份失败: %w", err)
	}

	return strings.TrimSpace(output), nil
}

// ListBackups 列出备份（只展示文件夹和 .zip 文件）
func (s *LinuxService) ListBackups(merchantID string) ([]BackupInfo, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, fmt.Errorf("未连接")
	}

	files, err := info.SFTPClient.ListDir("/opt/backup")
	if err != nil {
		// 目录可能不存在
		return []BackupInfo{}, nil
	}

	var backups []BackupInfo
	for _, f := range files {
		name := f.Name()
		// 只保留文件夹和 .zip 文件
		if f.IsDir() || strings.HasSuffix(name, ".zip") {
			backups = append(backups, BackupInfo{
				Name:    name,
				Path:    "/opt/backup/" + name,
				Size:    f.Size(),
				ModTime: f.ModTime(),
				IsDir:   f.IsDir(),
			})
		}
	}

	// 按修改时间排序（最新的在前）
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].ModTime.After(backups[j].ModTime)
	})

	return backups, nil
}

// RestoreBackup 恢复备份
func (s *LinuxService) RestoreBackup(merchantID, backupPath string, isZip bool) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}

	password := info.Password
	folderName := backupPath

	// 步骤1: 如果是zip，先解压
	if isZip {
		// 目标文件夹名 = zip文件名去掉 .zip
		targetFolder := strings.TrimSuffix(backupPath, ".zip")

		// 解压前先删除同名文件夹
		rmCmd := fmt.Sprintf("echo '%s' | sudo -S rm -rf %s 2>/dev/null", password, targetFolder)
		_, _ = info.Client.ExecuteCommand(rmCmd)

		// 解压zip文件
		unzipCmd := fmt.Sprintf("echo '%s' | sudo -S unzip -oq %s -d %s 2>&1", password, backupPath, targetFolder)
		_, err := info.Client.ExecuteCommand(unzipCmd)
		if err != nil {
			return "", fmt.Errorf("解压zip失败: %w", err)
		}

		// 检查解压后唯一子目录
		lsCmd := fmt.Sprintf("ls -1 %s 2>/dev/null", targetFolder)
		lsOutput, _ := info.Client.ExecuteCommand(lsCmd)
		subdirs := strings.Fields(strings.TrimSpace(lsOutput))

		if len(subdirs) == 1 {
			folderName = fmt.Sprintf("%s/%s", targetFolder, subdirs[0])
		} else {
			folderName = targetFolder
		}
	} else {
		// 文件夹恢复时自动加斜杠
		if !strings.HasSuffix(folderName, "/") {
			folderName = folderName + "/"
		}
	}

	// 步骤2: 执行dbrestore命令
	restoreCmd := fmt.Sprintf("cd /opt && dbrestore %s", folderName)
	output, err := info.Client.ExecuteCommand(restoreCmd)
	if err != nil {
		return "", fmt.Errorf("执行dbrestore失败: %w", err)
	}

	return "备份已恢复: " + strings.TrimSpace(output), nil
}

// LogInfo 日志信息
type LogInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

// ListLogs 列出日志文件
func (s *LinuxService) ListLogs(merchantID string) ([]LogInfo, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, fmt.Errorf("未连接")
	}

	var logs []LogInfo

	// 常见日志目录
	logDirs := []string{
		"/opt/menusifu/logs",
		"/opt/tomcat7/logs",
	}

	for _, dir := range logDirs {
		files, err := info.SFTPClient.ListDir(dir)
		if err != nil {
			continue
		}

		for _, f := range files {
			// 包含 .log 文件或者文件名包含 log/out 的文件
			if !f.IsDir() && (strings.HasSuffix(f.Name(), ".log") || strings.HasSuffix(f.Name(), ".out") || strings.Contains(f.Name(), "log")) {
				logs = append(logs, LogInfo{
					Name:    f.Name(),
					Path:    dir + "/" + f.Name(),
					Size:    f.Size(),
					ModTime: f.ModTime(),
				})
			}
		}
	}

	// 按修改时间排序
	sort.Slice(logs, func(i, j int) bool {
		return logs[i].ModTime.After(logs[j].ModTime)
	})

	return logs, nil
}

// DownloadLog 下载日志
func (s *LinuxService) DownloadLog(merchantID, logPath string) (io.Reader, int64, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, 0, fmt.Errorf("未连接")
	}

	return info.SFTPClient.DownloadToReader(logPath)
}

// ReadLogContent 读取日志内容
func (s *LinuxService) ReadLogContent(merchantID, logPath string, lines int) (string, error) {
	if lines <= 0 {
		lines = 100
	}

	output, err := s.ExecuteCommand(merchantID, fmt.Sprintf("tail -n %d %s", lines, logPath))
	if err != nil {
		return "", fmt.Errorf("读取日志失败: %w", err)
	}

	return output, nil
}

// GetAppVersion 获取应用版本
func (s *LinuxService) GetAppVersion(merchantID string) (map[string]string, error) {
	// 只使用 /opt/menusifu/resources/app/package.json
	versionPath := "/opt/menusifu/resources/app/package.json"
	version := "unknown"

	// 使用 grep 和 sed 直接提取版本号
	// 匹配 "version": "x.x.x" 格式
	cmd := fmt.Sprintf("grep '\"version\"' %s 2>/dev/null | head -1 | sed 's/.*\"version\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/'", versionPath)
	output, err := s.ExecuteCommand(merchantID, cmd)
	if err == nil && strings.TrimSpace(output) != "" && !strings.Contains(output, "No such file") {
		version = strings.TrimSpace(output)
	}

	// 获取其他版本信息
	javaVersion, _ := s.ExecuteCommand(merchantID, "java -version 2>&1 | head -1")
	osVersion, _ := s.ExecuteCommand(merchantID, "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2")

	return map[string]string{
		"app_version":  version,
		"java_version": strings.TrimSpace(javaVersion),
		"os_version":   strings.TrimSpace(osVersion),
	}, nil
}

// GetCloudVersion 获取 CloudDataHub 版本
func (s *LinuxService) GetCloudVersion(merchantID string) (string, error) {
	// 读取 /opt/tomcat7/webapps/cloudDatahub/WEB-INF/classes/application.properties
	// 提取 application.syncVersion 字段
	configPath := "/opt/tomcat7/webapps/cloudDatahub/WEB-INF/classes/application.properties"

	cmd := fmt.Sprintf("grep '^application\\.syncVersion' %s 2>/dev/null | head -1 | cut -d'=' -f2", configPath)
	output, err := s.ExecuteCommand(merchantID, cmd)
	if err == nil && strings.TrimSpace(output) != "" && !strings.Contains(output, "No such file") {
		return strings.TrimSpace(output), nil
	}

	return "未安装或路径未知", nil
}

// GetRemoteMD5 获取远程文件 MD5
func (s *LinuxService) GetRemoteMD5(merchantID, remotePath string) (string, error) {
	cmd := fmt.Sprintf("md5sum %s 2>/dev/null | cut -d' ' -f1", remotePath)
	log.Printf("[GetRemoteMD5] merchantID=%s, remotePath=%s, cmd=%s", merchantID, remotePath, cmd)
	output, err := s.ExecuteCommand(merchantID, cmd)
	log.Printf("[GetRemoteMD5] output=%q, err=%v", output, err)
	if err != nil {
		return "", fmt.Errorf("计算远程 MD5 失败: %w", err)
	}

	return strings.TrimSpace(output), nil
}

// CalculateLocalMD5 计算本地文件 MD5
func (s *LinuxService) CalculateLocalMD5(localPath string) (string, error) {
	file, err := os.Open(localPath)
	if err != nil {
		return "", fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("计算 MD5 失败: %w", err)
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// GetConfig 获取配置文件内容
func (s *LinuxService) GetConfig(merchantID, configPath string) (string, error) {
	output, err := s.ExecuteCommand(merchantID, fmt.Sprintf("cat %s", configPath))
	if err != nil {
		return "", fmt.Errorf("读取配置文件失败: %w", err)
	}

	return output, nil
}

// UpdateConfig 更新配置文件
func (s *LinuxService) UpdateConfig(merchantID, configPath, content string) error {
	// 使用 heredoc 写入文件
	cmd := fmt.Sprintf("cat > %s << 'EOFCONFIG'\n%s\nEOFCONFIG", configPath, content)
	_, err := s.ExecuteCommand(merchantID, cmd)
	if err != nil {
		return fmt.Errorf("更新配置文件失败: %w", err)
	}

	return nil
}

// ListConfigFiles 列出配置文件
func (s *LinuxService) ListConfigFiles(merchantID string) ([]string, error) {
	configs := []string{
		"/opt/menusifu/resources/app/config.json",
		"/opt/menusifu/config/app.properties",
		"/opt/CloudDataHub/config/application.properties",
	}

	// 检查文件是否存在
	var existingConfigs []string
	for _, config := range configs {
		_, err := s.ExecuteCommand(merchantID, fmt.Sprintf("test -f %s && echo 'exists'", config))
		if err == nil {
			existingConfigs = append(existingConfigs, config)
		}
	}

	return existingConfigs, nil
}

// OneClickUpgrade 一键升级（包含配置修改）
func (s *LinuxService) OneClickUpgrade(merchantID, warPath string, configRepo *repository.FileConfigRepository, env string) (string, error) {
	// 1. 停止 POS
	_, err := s.StopPOS(merchantID)
	if err != nil {
		return "", fmt.Errorf("停止 POS 失败: %w", err)
	}

	// 2. 替换 WAR 包
	if warPath != "" {
		// 获取连接信息（用于上传）
		info, exists := s.pool.Get(merchantID)
		if !exists {
			return "", fmt.Errorf("未连接到设备")
		}
		password := info.Password

		// 检查是否是本地 downloads 目录的文件（需要先上传到远程）
		if strings.HasPrefix(warPath, "downloads/") {
			// 将相对路径转换为绝对路径
			localPath := warPath
			if !filepath.IsAbs(localPath) {
				wd, _ := os.Getwd()
				localPath = filepath.Join(wd, warPath)
			}

			// 检查本地文件是否存在
			if _, err := os.Stat(localPath); os.IsNotExist(err) {
				return "", fmt.Errorf("WAR 包文件不存在: %s", warPath)
			}

			// 直接上传到目标路径
			targetPath := "/opt/tomcat7/webapps/kpos.war"
			log.Printf("[OneClickUpgrade] 上传 WAR 包: %s -> %s", localPath, targetPath)

			err = info.SFTPClient.UploadFile(localPath, targetPath, nil)
			if err != nil {
				return "", fmt.Errorf("上传 WAR 包失败: %w", err)
			}
			log.Printf("[OneClickUpgrade] WAR 包上传完成")
		} else {
			// 远程路径，执行 cp 命令
			_, err = s.ExecuteCommand(merchantID, fmt.Sprintf("cp %s /opt/tomcat7/webapps/kpos.war", warPath))
			if err != nil {
				return "", fmt.Errorf("替换 WAR 包失败: %w", err)
			}
		}

		// 删除旧的解压目录
		log.Printf("[OneClickUpgrade] 删除旧的 kpos 目录")
		rmCmd := fmt.Sprintf("echo '%s' | sudo -S rm -rf /opt/tomcat7/webapps/kpos 2>&1", password)
		_, err = s.ExecuteCommand(merchantID, rmCmd)
		if err != nil {
			log.Printf("[OneClickUpgrade] 删除 kpos 目录警告: %v", err)
		}

		// 解压 WAR 包
		log.Printf("[OneClickUpgrade] 解压 WAR 包")
		unzipCmd := fmt.Sprintf("echo '%s' | sudo -S unzip -o /opt/tomcat7/webapps/kpos.war -d /opt/tomcat7/webapps/kpos 2>&1", password)
		output, err := s.ExecuteCommand(merchantID, unzipCmd)
		if err != nil {
			return "", fmt.Errorf("解压 WAR 包失败: %w", err)
		}
		log.Printf("[OneClickUpgrade] 解压输出: %s", output)

		// 修正权限
		chownCmd := fmt.Sprintf("echo '%s' | sudo -S chown -R menu:menu /opt/tomcat7/webapps/kpos 2>&1", password)
		_, err = s.ExecuteCommand(merchantID, chownCmd)
		if err != nil {
			log.Printf("[OneClickUpgrade] 修正权限警告: %v", err)
		}
	}

	// 4. 执行启用的配置修改
	if configRepo != nil && env != "" {
		configs, err := configRepo.GetEnabled()
		if err == nil && len(configs) > 0 {
			for _, config := range configs {
				_, execErr := s.ExecuteFileConfig(merchantID, &config, env)
				if execErr != nil {
					// 记录错误但继续执行
					log.Printf("[OneClickUpgrade] 配置修改失败 %s: %v", config.Name, execErr)
				}
			}
		}
	}

	// 5. 重启 POS
	_, err = s.StartPOS(merchantID)
	if err != nil {
		return "", fmt.Errorf("重启 POS 失败: %w", err)
	}

	return fmt.Sprintf("升级完成！"), nil
}

// GetDiskUsage 获取磁盘使用情况
func (s *LinuxService) GetDiskUsage(merchantID string) (string, error) {
	output, err := s.ExecuteCommand(merchantID, "df -h /opt")
	if err != nil {
		return "", err
	}
	return output, nil
}

// GetMemoryUsage 获取内存使用情况
func (s *LinuxService) GetMemoryUsage(merchantID string) (string, error) {
	output, err := s.ExecuteCommand(merchantID, "free -h")
	if err != nil {
		return "", err
	}
	return output, nil
}

// ParseSize 解析大小字符串
func (s *LinuxService) ParseSize(sizeStr string) int64 {
	sizeStr = strings.TrimSpace(strings.ToUpper(sizeStr))

	multiplier := int64(1)
	if strings.HasSuffix(sizeStr, "K") {
		multiplier = 1024
		sizeStr = strings.TrimSuffix(sizeStr, "K")
	} else if strings.HasSuffix(sizeStr, "M") {
		multiplier = 1024 * 1024
		sizeStr = strings.TrimSuffix(sizeStr, "M")
	} else if strings.HasSuffix(sizeStr, "G") {
		multiplier = 1024 * 1024 * 1024
		sizeStr = strings.TrimSuffix(sizeStr, "G")
	}

	value, err := strconv.ParseInt(strings.TrimSpace(sizeStr), 10, 64)
	if err != nil {
		return 0
	}

	return value * multiplier
}

// ExecuteFileConfig 执行单个文件配置修改
func (s *LinuxService) ExecuteFileConfig(merchantID string, config *models.FileConfig, env string) (string, error) {
	remotePath := config.GetAbsoluteRemotePath()

	// 读取远程文件内容
	content, err := s.ExecuteCommand(merchantID, fmt.Sprintf("cat %s 2>/dev/null || echo ''", remotePath))
	if err != nil {
		return "", fmt.Errorf("读取远程文件失败: %w", err)
	}

	content = strings.TrimSuffix(content, "\n")
	if content == "" {
		return "", fmt.Errorf("远程文件不存在或为空: %s", remotePath)
	}

	// 根据文件类型修改内容
	var newContent string
	if strings.HasSuffix(config.FilePath, ".json") {
		newContent, err = s.modifyJSONContent(content, config, env)
	} else if strings.HasSuffix(config.FilePath, ".properties") {
		newContent, err = s.modifyPropertiesContent(content, config, env)
	} else {
		newContent, err = s.modifyTextContent(content, config, env)
	}

	if err != nil {
		return "", fmt.Errorf("修改文件内容失败: %w", err)
	}

	// 如果内容没有变化，跳过写入
	if content == newContent {
		return fmt.Sprintf("文件无需修改: %s", config.Name), nil
	}

	// 写回远程文件
	_, err = s.writeRemoteFile(merchantID, remotePath, newContent)
	if err != nil {
		return "", fmt.Errorf("写入远程文件失败: %w", err)
	}

	return fmt.Sprintf("配置已更新: %s (%s)", config.Name, remotePath), nil
}

// writeRemoteFile 写入远程文件
func (s *LinuxService) writeRemoteFile(merchantID, remotePath, content string) (string, error) {
	// 使用 heredoc 方式写入文件，避免转义问题
	cmd := fmt.Sprintf("cat > %s << 'ENDOFFILE'\n%s\nENDOFFILE", remotePath, content)
	return s.ExecuteCommand(merchantID, cmd)
}

// modifyJSONContent 修改 JSON 文件内容
func (s *LinuxService) modifyJSONContent(content string, config *models.FileConfig, env string) (string, error) {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(content), &data); err != nil {
		return "", fmt.Errorf("JSON 解析失败: %w", err)
	}

	for _, kv := range config.KeyValues {
		if kv.Key == "" {
			continue
		}
		value := kv.GetValueByEnv(env)
		if value == "" {
			continue
		}

		// 支持嵌套键路径，如 "a.b.c"
		keys := strings.Split(kv.Key, ".")
		current := data
		for i, key := range keys {
			if i == len(keys)-1 {
				// 最后一层，设置值
				current[key] = value
			} else {
				// 中间层，确保存在
				if _, ok := current[key]; !ok {
					current[key] = make(map[string]interface{})
				}
				if next, ok := current[key].(map[string]interface{}); ok {
					current = next
				}
			}
		}
	}

	result, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("JSON 序列化失败: %w", err)
	}
	return string(result), nil
}

// modifyPropertiesContent 修改 Properties 文件内容
func (s *LinuxService) modifyPropertiesContent(content string, config *models.FileConfig, env string) (string, error) {
	lines := strings.Split(content, "\n")
	modifiedKeys := make(map[string]bool)
	keyValueMap := make(map[string]string)

	// 构建键值映射
	for _, kv := range config.KeyValues {
		if kv.Key != "" {
			keyValueMap[kv.Key] = kv.GetValueByEnv(env)
		}
	}

	// 处理现有行
	var newLines []string
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" || strings.HasPrefix(trimmedLine, "#") {
			newLines = append(newLines, line)
			continue
		}

		// 解析 key=value
		parts := strings.SplitN(trimmedLine, "=", 2)
		if len(parts) != 2 {
			newLines = append(newLines, line)
			continue
		}

		key := strings.TrimSpace(parts[0])
		if newValue, ok := keyValueMap[key]; ok && newValue != "" {
			newLines = append(newLines, fmt.Sprintf("%s = %s", key, newValue))
			modifiedKeys[key] = true
		} else {
			newLines = append(newLines, line)
		}
	}

	// 添加未存在的新键
	for key, value := range keyValueMap {
		if !modifiedKeys[key] && value != "" {
			newLines = append(newLines, fmt.Sprintf("%s = %s", key, value))
		}
	}

	return strings.Join(newLines, "\n"), nil
}

// modifyTextContent 修改纯文本文件内容（简单替换）
func (s *LinuxService) modifyTextContent(content string, config *models.FileConfig, env string) (string, error) {
	result := content
	for _, kv := range config.KeyValues {
		if kv.Key == "" {
			continue
		}
		value := kv.GetValueByEnv(env)
		if value != "" && strings.Contains(result, kv.Key) {
			result = strings.ReplaceAll(result, kv.Key, value)
		}
	}
	return result, nil
}

// UpgradePackageInfo 升级包信息
type UpgradePackageInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	ModTime     string `json:"mod_time"`
	HasUpdateSh bool   `json:"has_update_sh"`
}

// ScanUpgradePackages 扫描远程升级包
func (s *LinuxService) ScanUpgradePackages(merchantID string) ([]UpgradePackageInfo, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return nil, fmt.Errorf("未连接")
	}

	// 扫描 /home/menu 目录下符合版本模式的目录
	// 版本模式：1.8.0.30.* 或类似格式
	cmd := "ls -d /home/menu/1.* 2>/dev/null | head -50"
	output, err := info.Client.ExecuteCommand(cmd)
	if err != nil {
		return nil, fmt.Errorf("扫描目录失败: %w", err)
	}

	var packages []UpgradePackageInfo
	dirs := strings.Split(strings.TrimSpace(output), "\n")

	for _, dir := range dirs {
		dir = strings.TrimSpace(dir)
		if dir == "" {
			continue
		}

		// 获取目录名
		name := filepath.Base(dir)

		// 检查 update.sh 是否存在
		checkShCmd := fmt.Sprintf("test -f %s/update.sh && echo 'exists' || echo 'not_found'", dir)
		shOutput, _ := info.Client.ExecuteCommand(checkShCmd)
		hasUpdateSh := strings.TrimSpace(shOutput) == "exists"

		// 获取修改时间
		mtimeCmd := fmt.Sprintf("stat -c '%%Y' %s 2>/dev/null || echo '0'", dir)
		mtimeOutput, _ := info.Client.ExecuteCommand(mtimeCmd)
		mtimeStr := strings.TrimSpace(mtimeOutput)

		// 转换时间戳
		if mtimeStr != "" && mtimeStr != "0" {
			timestamp, _ := strconv.ParseInt(mtimeStr, 10, 64)
			mtimeStr = time.Unix(timestamp, 0).Format("2006-01-02 15:04:05")
		}

		packages = append(packages, UpgradePackageInfo{
			Name:        name,
			Path:        dir,
			ModTime:     mtimeStr,
			HasUpdateSh: hasUpdateSh,
		})
	}

	// 按修改时间倒序排序
	sort.Slice(packages, func(i, j int) bool {
		return packages[i].ModTime > packages[j].ModTime
	})

	return packages, nil
}

// UploadAndExtractPackage 上传并解压升级包
func (s *LinuxService) UploadAndExtractPackage(merchantID, localZipPath string, progressCallback func(int)) (string, error) {
	info, exists := s.pool.Get(merchantID)
	if !exists {
		return "", fmt.Errorf("未连接")
	}

	// 获取文件名
	basename := filepath.Base(localZipPath)
	remoteZipPath := fmt.Sprintf("/home/menu/%s", basename)

	// 上传 zip 文件
	if progressCallback != nil {
		progressCallback(10)
	}

	err := info.SFTPClient.UploadFile(localZipPath, remoteZipPath, func(transferred, total int64, percentage float64) {
		if progressCallback != nil {
			// 上传进度占 10-50%
			progress := 10 + int(percentage*0.4)
			progressCallback(progress)
		}
	})
	if err != nil {
		return "", fmt.Errorf("上传文件失败: %w", err)
	}

	// 解压文件
	if progressCallback != nil {
		progressCallback(55)
	}

	password := info.Password
	unzipCmd := fmt.Sprintf("echo '%s' | sudo -S unzip -o %s -d /home/menu 2>&1", password, remoteZipPath)
	output, err := info.Client.ExecuteCommand(unzipCmd)
	if err != nil {
		return "", fmt.Errorf("解压失败: %w", err)
	}
	log.Printf("[UploadAndExtractPackage] unzip output: %s", output)

	if progressCallback != nil {
		progressCallback(85)
	}

	// 修正权限
	chownCmd := fmt.Sprintf("echo '%s' | sudo -S chown -R menu:menu /home/menu 2>&1", password)
	_, err = info.Client.ExecuteCommand(chownCmd)
	if err != nil {
		log.Printf("[UploadAndExtractPackage] chown warning: %v", err)
	}

	// 清理 zip 文件
	rmCmd := fmt.Sprintf("rm -f %s 2>/dev/null", remoteZipPath)
	_, _ = info.Client.ExecuteCommand(rmCmd)

	if progressCallback != nil {
		progressCallback(100)
	}

	// 推断解压后的目录名
	// 去掉 .zip 后缀
	extractedName := strings.TrimSuffix(basename, ".zip")
	return fmt.Sprintf("/home/menu/%s", extractedName), nil
}

// PackageUpgradeRequest 升级包升级请求
type PackageUpgradeRequest struct {
	MerchantID string `json:"merchant_id" binding:"required"`
	PackageDir string `json:"package_dir" binding:"required"`
	WarPath    string `json:"war_path"`
	WarSource  string `json:"war_source"` // "local" | "history"
	Env        string `json:"env"`
}

// PackageUpgradeProgress 升级包升级进度
type PackageUpgradeProgress struct {
	Step      string `json:"step"`
	Progress  int    `json:"progress"`
	Message   string `json:"message"`
	IsError   bool   `json:"is_error"`
	IsSuccess bool   `json:"is_success"`
}

// ExecutePackageUpgrade 执行升级包升级流程
func (s *LinuxService) ExecutePackageUpgrade(merchantID, packageDir, warPath, env string,
	configRepo *repository.FileConfigRepository,
	progressCallback func(int, string)) error {

	info, exists := s.pool.Get(merchantID)
	if !exists {
		return fmt.Errorf("未连接")
	}

	password := info.Password

	// 步骤 1: 停止 POS (0-10%)
	if progressCallback != nil {
		progressCallback(0, "停止 POS 服务...")
	}
	_, err := s.StopPOS(merchantID)
	if err != nil {
		return fmt.Errorf("停止 POS 失败: %w", err)
	}

	// 步骤 2: 复制/上传 WAR 包到升级包目录 (10-30%)
	if progressCallback != nil {
		progressCallback(10, "复制 WAR 包...")
	}
	if warPath != "" {
		targetWarPath := fmt.Sprintf("%s/kpos.war", packageDir)

		// 检查是否是本地 downloads 目录的文件（需要先上传到远程）
		if strings.HasPrefix(warPath, "downloads/") {
			// 将相对路径转换为绝对路径
			localPath := warPath
			if !filepath.IsAbs(localPath) {
				wd, _ := os.Getwd()
				localPath = filepath.Join(wd, warPath)
			}

			// 检查本地文件是否存在
			if _, err := os.Stat(localPath); os.IsNotExist(err) {
				return fmt.Errorf("WAR 包文件不存在: %s", warPath)
			}

			// 上传到升级包目录
			log.Printf("[ExecutePackageUpgrade] 上传 WAR 包: %s -> %s", localPath, targetWarPath)
			err = info.SFTPClient.UploadFile(localPath, targetWarPath, nil)
			if err != nil {
				return fmt.Errorf("上传 WAR 包失败: %w", err)
			}
			log.Printf("[ExecutePackageUpgrade] WAR 包上传完成")
		} else {
			// 远程路径，执行 cp 命令
			copyCmd := fmt.Sprintf("cp %s %s 2>&1", warPath, targetWarPath)
			_, err = info.Client.ExecuteCommand(copyCmd)
			if err != nil {
				return fmt.Errorf("复制 WAR 包失败: %w", err)
			}
		}
	}

	// 步骤 4: 执行 update.sh (40-70%)
	if progressCallback != nil {
		progressCallback(40, "执行升级脚本...")
	}
	updateShPath := fmt.Sprintf("%s/update.sh", packageDir)

	// 检查 update.sh 是否存在
	checkCmd := fmt.Sprintf("test -f %s && echo 'exists' || echo 'not_found'", updateShPath)
	checkOutput, _ := info.Client.ExecuteCommand(checkCmd)

	if strings.TrimSpace(checkOutput) == "exists" {
		// 赋予执行权限
		chmodCmd := fmt.Sprintf("echo '%s' | sudo -S chmod +x %s 2>&1", password, updateShPath)
		_, _ = info.Client.ExecuteCommand(chmodCmd)

		// 执行 update.sh
		runCmd := fmt.Sprintf("cd %s && echo '%s' | sudo -S ./update.sh 2>&1", packageDir, password)
		output, err := info.Client.ExecuteCommand(runCmd)
		if err != nil {
			log.Printf("[ExecutePackageUpgrade] update.sh 输出: %s", output)
			return fmt.Errorf("执行 update.sh 失败: %w", err)
		}
		log.Printf("[ExecutePackageUpgrade] update.sh 输出: %s", output)
	} else {
		log.Printf("[ExecutePackageUpgrade] update.sh 不存在，跳过")
	}

	// 步骤 5: 执行配置修改 (70-85%)
	if progressCallback != nil {
		progressCallback(70, "执行配置修改...")
	}
	if configRepo != nil && env != "" {
		configs, err := configRepo.GetEnabled()
		if err == nil && len(configs) > 0 {
			for _, config := range configs {
				_, execErr := s.ExecuteFileConfig(merchantID, &config, env)
				if execErr != nil {
					log.Printf("[ExecutePackageUpgrade] 配置修改失败 %s: %v", config.Name, execErr)
				}
			}
		}
	}

	// 步骤 6: 重启 POS (85-100%)
	if progressCallback != nil {
		progressCallback(85, "重启 POS 服务...")
	}
	_, err = s.StartPOS(merchantID)
	if err != nil {
		return fmt.Errorf("重启 POS 失败: %w", err)
	}

	if progressCallback != nil {
		progressCallback(100, "升级完成")
	}

	return nil
}
