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
	dbPort              int
	dbUser              string
	dbPassword          string
	dbName              string
	backupsRootDirFunc  func() string
	restoreFromFileFunc func(host, filePath string) error
}

type DBBackupFileInfo struct {
	Name    string    `json:"name"`
	Version string    `json:"version"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

type DBBackupGroup struct {
	SourceMerchantID string             `json:"source_merchant_id"`
	Items            []DBBackupFileInfo `json:"items"`
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
		return nil, fmt.Errorf("database backup host is empty")
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
		return nil, fmt.Errorf("create backup file: %w", err)
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
		return nil, wrapCommandError("database backup failed", err, stderr.String())
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("stat backup file: %w", err)
	}
	if info.Size() <= 0 {
		_ = os.Remove(filePath)
		return nil, fmt.Errorf("generated SQL file is empty")
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
	merchantDir := filepath.Join(s.getBackupsRootDir(), merchantFolder)
	if _, err := os.Stat(merchantDir); os.IsNotExist(err) {
		return []DBBackupFileInfo{}, nil
	}

	entries, err := os.ReadDir(merchantDir)
	if err != nil {
		return nil, fmt.Errorf("read backup directory: %w", err)
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

func (s *DBBackupService) ListBackupGroups(merchantIDs []string, excludeMerchantID string) ([]DBBackupGroup, error) {
	normalizedExclude := strings.TrimSpace(excludeMerchantID)
	groups := make([]DBBackupGroup, 0, len(merchantIDs))

	for _, merchantID := range merchantIDs {
		merchantID = strings.TrimSpace(merchantID)
		if merchantID == "" || merchantID == normalizedExclude {
			continue
		}

		items, err := s.ListBackups(merchantID)
		if err != nil {
			return nil, err
		}
		if len(items) == 0 {
			continue
		}

		groups = append(groups, DBBackupGroup{
			SourceMerchantID: merchantID,
			Items:            items,
		})
	}

	sort.Slice(groups, func(i, j int) bool {
		return groups[i].SourceMerchantID < groups[j].SourceMerchantID
	})
	return groups, nil
}

func (s *DBBackupService) DeleteBackup(merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}
	if removeErr := os.Remove(filePath); removeErr != nil {
		return fmt.Errorf("delete backup file: %w", removeErr)
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
		return nil, 0, fmt.Errorf("open backup file: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, 0, fmt.Errorf("stat backup file: %w", err)
	}
	return file, info.Size(), nil
}

func (s *DBBackupService) RestoreFromServerFile(host, merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}
	return s.runRestoreFromFile(host, filePath)
}

func (s *DBBackupService) RestoreFromMerchantBackupFile(host, sourceMerchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(sourceMerchantID, fileName)
	if err != nil {
		return err
	}
	return s.runRestoreFromFile(host, filePath)
}

func (s *DBBackupService) RestoreFromUploadFile(host, filePath string) error {
	if strings.TrimSpace(filePath) == "" {
		return fmt.Errorf("upload file path is empty")
	}
	return s.runRestoreFromFile(host, filePath)
}

func (s *DBBackupService) runRestoreFromFile(host, filePath string) error {
	if s.restoreFromFileFunc != nil {
		return s.restoreFromFileFunc(host, filePath)
	}
	return s.restoreFromFile(host, filePath)
}

func (s *DBBackupService) restoreFromFile(host, filePath string) error {
	host = strings.TrimSpace(host)
	if host == "" {
		return fmt.Errorf("database restore host is empty")
	}
	if err := s.requireCommand("mysql"); err != nil {
		return err
	}

	restoreFile, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open restore file: %w", err)
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
		return wrapCommandError("database restore failed", err, stderr.String())
	}
	return nil
}

func (s *DBBackupService) backupsRootDir() string {
	downloadsDir := "downloads"
	if config.AppConfig != nil && strings.TrimSpace(config.AppConfig.Download.DownloadsDir) != "" {
		downloadsDir = strings.TrimSpace(config.AppConfig.Download.DownloadsDir)
	}
	parentDir := filepath.Dir(downloadsDir)
	return filepath.Join(parentDir, "db-backups")
}

func (s *DBBackupService) getBackupsRootDir() string {
	if s.backupsRootDirFunc != nil {
		return s.backupsRootDirFunc()
	}
	return s.backupsRootDir()
}

func (s *DBBackupService) ensureMerchantDir(merchantFolder string) (string, error) {
	rootDir := s.getBackupsRootDir()
	merchantDir := filepath.Join(rootDir, merchantFolder)
	if err := os.MkdirAll(merchantDir, 0755); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	return merchantDir, nil
}

func (s *DBBackupService) resolveBackupPath(merchantID, fileName string) (string, error) {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		return "", fmt.Errorf("backup file name is empty")
	}
	if filepath.Base(fileName) != fileName || strings.Contains(fileName, "..") {
		return "", fmt.Errorf("backup file name is invalid")
	}
	if strings.ToLower(filepath.Ext(fileName)) != ".sql" {
		return "", fmt.Errorf("only .sql backup files are supported")
	}

	merchantFolder := sanitizePathSegment(merchantID, "unknown-mid")
	merchantDir := filepath.Join(s.getBackupsRootDir(), merchantFolder)
	return filepath.Join(merchantDir, fileName), nil
}

func (s *DBBackupService) requireCommand(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("required command not found: %s", name)
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
	return "", "", fmt.Errorf("failed to generate unique backup file name")
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
