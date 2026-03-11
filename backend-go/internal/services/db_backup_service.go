package services

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"device-management/internal/config"
)

const (
	defaultDBBackupPort     = 22108
	defaultDBBackupUser     = "root"
	defaultDBBackupPassword = "N0mur@4$99!"
	defaultDBBackupDatabase = "kpos"
)

var (
	safePathSegmentPattern   = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
	backupFileVersionPattern = regexp.MustCompile(`^(.*)_\d{8}_\d{6}(?:_\d{2})?\.sql$`)
)

type DBBackupService struct {
	dbPort     int
	dbUser     string
	dbPassword string
	dbName     string
}

type DBBackupFileInfo struct {
	Name    string    `json:"name"`
	Version string    `json:"version"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

func NewDBBackupService() *DBBackupService {
	return &DBBackupService{
		dbPort:     defaultDBBackupPort,
		dbUser:     defaultDBBackupUser,
		dbPassword: defaultDBBackupPassword,
		dbName:     defaultDBBackupDatabase,
	}
}

func (s *DBBackupService) CreateBackup(host, merchantID, version string) (*DBBackupFileInfo, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("设备IP为空，无法备份数据库")
	}

	merchantFolder := sanitizePathSegment(merchantID, "unknown-mid")
	versionSegment := sanitizePathSegment(version, "v_unknown")
	merchantDir, err := s.ensureMerchantDir(merchantFolder)
	if err != nil {
		return nil, err
	}

	filePath, fileName, err := nextBackupFilePath(merchantDir, versionSegment)
	if err != nil {
		return nil, err
	}

	if err := s.requireCommand("mysqldump"); err != nil {
		return nil, err
	}

	backupFile, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("创建备份文件失败: %w", err)
	}
	defer backupFile.Close()

	var stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(
		ctx,
		"mysqldump",
		"-h", host,
		"--port", strconv.Itoa(s.dbPort),
		"-u", s.dbUser,
		"-p"+s.dbPassword,
		"--default-character-set=utf8",
		"--single-transaction",
		"--routines",
		"--events",
		"--triggers",
		s.dbName,
	)
	cmd.Stdout = backupFile
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		_ = os.Remove(filePath)
		return nil, wrapCommandError("数据库备份失败", err, stderr.String())
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取备份文件信息失败: %w", err)
	}
	if info.Size() <= 0 {
		_ = os.Remove(filePath)
		return nil, fmt.Errorf("备份失败：生成的SQL文件为空")
	}

	return &DBBackupFileInfo{
		Name:    fileName,
		Version: extractVersionFromBackupFileName(fileName),
		Size:    info.Size(),
		ModTime: info.ModTime(),
	}, nil
}

func (s *DBBackupService) ListBackups(merchantID string) ([]DBBackupFileInfo, error) {
	merchantFolder := sanitizePathSegment(merchantID, "unknown-mid")
	merchantDir := filepath.Join(s.backupsRootDir(), merchantFolder)
	if _, err := os.Stat(merchantDir); os.IsNotExist(err) {
		return []DBBackupFileInfo{}, nil
	}

	entries, err := os.ReadDir(merchantDir)
	if err != nil {
		return nil, fmt.Errorf("读取备份目录失败: %w", err)
	}

	items := make([]DBBackupFileInfo, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".sql") {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		items = append(items, DBBackupFileInfo{
			Name:    name,
			Version: extractVersionFromBackupFileName(name),
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})
	return items, nil
}

func (s *DBBackupService) DeleteBackup(merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}
	if removeErr := os.Remove(filePath); removeErr != nil {
		return fmt.Errorf("删除备份文件失败: %w", removeErr)
	}
	return nil
}

func (s *DBBackupService) OpenBackupFile(merchantID, fileName string) (*os.File, int64, error) {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return nil, 0, err
	}
	file, err := os.Open(filePath)
	if err != nil {
		return nil, 0, fmt.Errorf("打开备份文件失败: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, 0, fmt.Errorf("读取备份文件信息失败: %w", err)
	}
	return file, info.Size(), nil
}

func (s *DBBackupService) RestoreFromServerFile(host, merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}
	return s.restoreFromFile(host, filePath)
}

func (s *DBBackupService) RestoreFromUploadFile(host, filePath string) error {
	if strings.TrimSpace(filePath) == "" {
		return fmt.Errorf("上传文件路径不能为空")
	}
	return s.restoreFromFile(host, filePath)
}

func (s *DBBackupService) restoreFromFile(host, filePath string) error {
	host = strings.TrimSpace(host)
	if host == "" {
		return fmt.Errorf("设备IP为空，无法恢复数据库")
	}
	if err := s.requireCommand("mysql"); err != nil {
		return err
	}

	restoreFile, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("打开恢复文件失败: %w", err)
	}
	defer restoreFile.Close()

	var stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(
		ctx,
		"mysql",
		"-h", host,
		"--port", strconv.Itoa(s.dbPort),
		"-u", s.dbUser,
		"-p"+s.dbPassword,
		s.dbName,
	)
	cmd.Stdin = restoreFile
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return wrapCommandError("数据库恢复失败", err, stderr.String())
	}
	return nil
}

func (s *DBBackupService) backupsRootDir() string {
	downloadsDir := "downloads"
	if config.AppConfig != nil && strings.TrimSpace(config.AppConfig.Download.DownloadsDir) != "" {
		downloadsDir = strings.TrimSpace(config.AppConfig.Download.DownloadsDir)
	}
	// db-backups 与 downloads 并列，放在同一父目录下
	parentDir := filepath.Dir(downloadsDir)
	return filepath.Join(parentDir, "db-backups")
}

func (s *DBBackupService) ensureMerchantDir(merchantFolder string) (string, error) {
	rootDir := s.backupsRootDir()
	merchantDir := filepath.Join(rootDir, merchantFolder)
	if err := os.MkdirAll(merchantDir, 0755); err != nil {
		return "", fmt.Errorf("创建备份目录失败: %w", err)
	}
	return merchantDir, nil
}

func (s *DBBackupService) resolveBackupPath(merchantID, fileName string) (string, error) {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		return "", fmt.Errorf("备份文件名不能为空")
	}
	if filepath.Base(fileName) != fileName || strings.Contains(fileName, "..") {
		return "", fmt.Errorf("备份文件名不合法")
	}
	if strings.ToLower(filepath.Ext(fileName)) != ".sql" {
		return "", fmt.Errorf("仅支持 .sql 备份文件")
	}

	merchantFolder := sanitizePathSegment(merchantID, "unknown-mid")
	merchantDir := filepath.Join(s.backupsRootDir(), merchantFolder)
	return filepath.Join(merchantDir, fileName), nil
}

func (s *DBBackupService) requireCommand(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("服务端未找到 %s 命令，请先安装 MySQL 客户端", name)
	}
	return nil
}

func nextBackupFilePath(merchantDir, version string) (string, string, error) {
	timestamp := time.Now().Format("20060102_150405")
	baseName := fmt.Sprintf("%s_%s", version, timestamp)
	fileName := baseName + ".sql"
	filePath := filepath.Join(merchantDir, fileName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return filePath, fileName, nil
	}

	for i := 1; i <= 99; i++ {
		suffix := fmt.Sprintf("_%02d", i)
		fileName = baseName + suffix + ".sql"
		filePath = filepath.Join(merchantDir, fileName)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return filePath, fileName, nil
		}
	}
	return "", "", fmt.Errorf("生成备份文件名失败，请重试")
}

func extractVersionFromBackupFileName(fileName string) string {
	matches := backupFileVersionPattern.FindStringSubmatch(fileName)
	if len(matches) >= 2 {
		version := strings.TrimSpace(matches[1])
		if version != "" {
			return version
		}
	}
	base := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	if strings.TrimSpace(base) == "" {
		return "v_unknown"
	}
	return base
}

func sanitizePathSegment(input, fallback string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return fallback
	}
	sanitized := safePathSegmentPattern.ReplaceAllString(input, "_")
	sanitized = strings.Trim(sanitized, "._-")
	if sanitized == "" {
		return fallback
	}
	return sanitized
}

func wrapCommandError(prefix string, execErr error, stderrText string) error {
	stderrText = strings.TrimSpace(stderrText)
	if stderrText == "" {
		return fmt.Errorf("%s: %w", prefix, execErr)
	}
	if len(stderrText) > 600 {
		stderrText = stderrText[:600] + "..."
	}
	return fmt.Errorf("%s: %s", prefix, stderrText)
}
