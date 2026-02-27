package services

import (
	"archive/zip"
	"bufio"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"device-management/internal/config"
	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/google/uuid"
)

type DownloadTask struct {
	ID          string
	Status      string // "downloading", "completed", "failed"
	Percentage  float64
	Downloaded  int64
	Total       int64
	Speed       string
	Error       string
	Name        string
	FileName    string
	PackageType string // "war", "upgrade", "install"
	cancelled   bool
}

type WarDownloadService struct {
	configRepo   *repository.SystemConfigRepository
	metadataRepo *repository.WarPackageRepository
	tasks        map[string]*DownloadTask
	mu           sync.RWMutex
}

func NewWarDownloadService(configRepo *repository.SystemConfigRepository, metadataRepo *repository.WarPackageRepository) *WarDownloadService {
	return &WarDownloadService{
		configRepo:   configRepo,
		metadataRepo: metadataRepo,
		tasks:        make(map[string]*DownloadTask),
	}
}

func (s *WarDownloadService) GetDownloadsDir() string {
	dir := config.AppConfig.Download.DownloadsDir
	if dir == "" {
		dir = "downloads"
	}
	os.MkdirAll(dir, 0755)
	return dir
}

func (s *WarDownloadService) ListPackages() ([]map[string]interface{}, error) {
	return s.ListPackagesWithFilter("")
}

// ListPackagesWithFilter 获取包列表，支持按类型过滤
// filterType: "war" 只返回 .war 文件，"zip" 只返回 .zip 文件，"" 返回所有
func (s *WarDownloadService) ListPackagesWithFilter(filterType string) ([]map[string]interface{}, error) {
	dir := s.GetDownloadsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var packages []map[string]interface{}
	for _, entry := range entries {
		if entry.IsDir() {
			pkgPath := filepath.Join(dir, entry.Name())
			files, err := os.ReadDir(pkgPath)
			if err != nil {
				continue
			}
			for _, f := range files {
				fileName := f.Name()
				isWar := strings.HasSuffix(fileName, ".war")
				isZip := strings.HasSuffix(fileName, ".zip")

				// 根据过滤类型决定是否包含
				shouldInclude := false
				switch filterType {
				case "war":
					shouldInclude = isWar
				case "zip":
					shouldInclude = isZip
				default:
					shouldInclude = isWar || isZip
				}

				if shouldInclude {
					info, _ := f.Info()
					packages = append(packages, map[string]interface{}{
						"name":       entry.Name(),
						"file_name":  fileName,
						"size":       info.Size(),
						"created_at": info.ModTime().Format(time.RFC3339),
					})
					break
				}
			}
		}
	}
	return packages, nil
}

func (s *WarDownloadService) GetPackagePath(name string) string {
	return filepath.Join(s.GetDownloadsDir(), name)
}

func (s *WarDownloadService) DeletePackage(name string) error {
	return os.RemoveAll(filepath.Join(s.GetDownloadsDir(), name))
}

func (s *WarDownloadService) GetTask(taskID string) *DownloadTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.tasks[taskID]
}

func (s *WarDownloadService) CancelTask(taskID string) {
	s.mu.Lock()
	if task, ok := s.tasks[taskID]; ok {
		task.cancelled = true
	}
	s.mu.Unlock()
}

// ExtractVersionFromURL 从 URL 中预提取版本号（不实际下载）
func (s *WarDownloadService) ExtractVersionFromURL(downloadURL string) string {
	// 先进行 URL 转换
	transformedURL := s.transformURL(downloadURL)

	// 从转换后的 URL 路径中提取构建号
	parsedURL, _ := url.Parse(transformedURL)
	pathParts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")

	// 查找构建号部分，如 /repository/downloadAll/xxx/42904:id/artifacts.zip
	for i, part := range pathParts {
		if part == "downloadAll" && i+2 < len(pathParts) {
			// 构建号在 downloadAll 后面的第二部分
			buildPart := pathParts[i+2]
			// 去掉 :id 后缀
			buildPart = strings.TrimSuffix(buildPart, ":id")
			return buildPart
		}
	}

	return ""
}

func (s *WarDownloadService) transformURL(originalURL string) string {
	parsedURL, _ := url.Parse(originalURL)
	pathParts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")

	// buildConfiguration 类型
	for i, part := range pathParts {
		if part == "buildConfiguration" && i+2 < len(pathParts) {
			projectBuild := fmt.Sprintf("%s/%s", pathParts[i+1], pathParts[i+2])
			return fmt.Sprintf("https://%s/repository/downloadAll/%s:id/artifacts.zip", parsedURL.Host, projectBuild)
		}
	}

	// kpos.war 类型
	for i, part := range pathParts {
		if part == "repository" && i+3 < len(pathParts) && pathParts[i+1] == "download" {
			projectBuild := fmt.Sprintf("%s/%s", pathParts[i+2], pathParts[i+3])
			return fmt.Sprintf("https://%s/repository/downloadAll/%s/artifacts.zip", parsedURL.Host, projectBuild)
		}
	}

	return originalURL
}

func (s *WarDownloadService) StartDownload(downloadURL string, overwrite bool, packageType string) (*DownloadTask, error) {
	// 获取 Cookie
	cookie := ""
	config, err := s.configRepo.GetByKey("download_cookie")
	if err == nil {
		cookie = config.Value
	}

	// 默认包类型为 war
	if packageType == "" {
		packageType = "war"
	}

	taskID := uuid.New().String()
	task := &DownloadTask{
		ID:          taskID,
		Status:      "downloading",
		PackageType: packageType,
	}

	s.mu.Lock()
	s.tasks[taskID] = task
	s.mu.Unlock()

	go s.doDownload(task, downloadURL, cookie, overwrite)

	return task, nil
}

func (s *WarDownloadService) doDownload(task *DownloadTask, downloadURL, cookie string, overwrite bool) {
	// URL 转换
	finalURL := s.transformURL(downloadURL)
	if finalURL != downloadURL {
		fmt.Printf("URL 转换: %s -> %s\n", downloadURL, finalURL)
	}

	fmt.Printf("开始下载，Cookie 长度: %d\n", len(cookie))

	// 第一次请求获取重定向
	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}

	req, _ := http.NewRequest("GET", finalURL, nil)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")
	req.Header.Set("Upgrade-Insecure-Requests", "1")

	resp, err := client.Do(req)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("请求失败: %v", err)
		return
	}
	defer resp.Body.Close()

	fmt.Printf("第一次请求状态码: %d\n", resp.StatusCode)

	var downloadURL2 string
	if resp.StatusCode == 302 || resp.StatusCode == 301 {
		downloadURL2 = resp.Header.Get("Location")
		if downloadURL2 == "" {
			task.Status = "failed"
			task.Error = "未找到重定向 URL"
			return
		}
		fmt.Printf("重定向到: %s\n", downloadURL2)
	} else {
		downloadURL2 = finalURL
	}

	// 第二次请求下载文件 - 注意：不能带 Cookie
	req2, _ := http.NewRequest("GET", downloadURL2, nil)
	// 第二次请求不带 Cookie（预签名 URL 自带认证信息）
	req2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
	req2.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req2.Header.Set("Accept-Language", "zh-CN,zh;q=0.9")

	fmt.Printf("开始第二次请求: %s\n", downloadURL2)

	httpClient := &http.Client{
		Timeout: 5 * time.Minute,
	}

	resp2, err := httpClient.Do(req2)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("下载失败: %v", err)
		fmt.Printf("第二次请求失败: %v\n", err)
		return
	}
	defer resp2.Body.Close()

	fmt.Printf("第二次请求完成，状态码: %d\n", resp2.StatusCode)

	if resp2.StatusCode != 200 {
		task.Status = "failed"
		task.Error = fmt.Sprintf("下载失败，状态码: %d", resp2.StatusCode)
		return
	}

	// 获取文件名
	filename := "artifacts.zip"
	contentDisp := resp2.Header.Get("Content-Disposition")
	if contentDisp != "" {
		re := regexp.MustCompile(`filename\*=UTF-8''([^;]+)`)
		if match := re.FindStringSubmatch(contentDisp); len(match) > 1 {
			filename = strings.TrimSuffix(match[1], ";")
		}
	}
	fmt.Printf("原始文件名: %s\n", filename)

	// 从文件名提取版本号：
	// 1) 优先匹配 Pos_-_Package_-_War_18.0.30.16.7.1-supreme_712_artifacts.zip 格式
	//    提取: 18.0.30.16.7.1-supreme_712
	// 2) 匹配数字形式，如 18.0.30.16.7.1_729
	// 3) 其次匹配包含 _build 的形式，例如 Installer_-_updater_build30.16.7.1_300
	version := ""

	// 新增：匹配格式 Pos_-_Package_-_War_18.0.30.16.7.1-supreme_712_artifacts.zip
	// 版本号格式：X.X.X.X.X[-build]_artifacts 或 X.X.X.X.X.X[-build]_artifacts
	// 支持 4 到 7 组数字的版本号格式
	posWarPattern := regexp.MustCompile(`(\d+(?:\.\d+){4,6}(?:-[a-zA-Z0-9_]+)?)_artifacts`)
	if m := posWarPattern.FindStringSubmatch(filename); len(m) > 1 {
		version = m[1] // 提取第一个分组，即版本号部分
	}

	// 原有逻辑：优先匹配数字形式，如 18.0.30.16.7.1_729
	if version == "" {
		numericPattern := regexp.MustCompile(`\d+\.\d+\.\d+\.\d+\.\d+\.\d+_\d+`)
		if m := numericPattern.FindString(filename); m != "" {
			version = m
		} else {
			buildPattern := regexp.MustCompile(`([A-Za-z0-9\-_]+_build\d+(?:\.\d+)*_\d+)`)
			if m := buildPattern.FindString(filename); m != "" {
				version = m
			} else {
				// 更宽松匹配：支持没有下划线分割的 build 字样
				buildPattern2 := regexp.MustCompile(`([A-Za-z0-9\-_]+build\d+(?:\.\d+)*_\d+)`)
				if m := buildPattern2.FindString(filename); m != "" {
					version = m
				}
			}
		}
	}

	if version == "" {
		version = "unknown_" + time.Now().Format("20060102_150405")
	}
	fmt.Printf("原始文件名: %s\n", filename)
	fmt.Printf("提取版本号: %s\n", version)

	// 检查是否被取消（在开始解压前再次检查）
	s.mu.RLock()
	cancelled := task.cancelled
	s.mu.RUnlock()
	if cancelled {
		task.Status = "cancelled"
		task.Error = "用户取消下载"
		fmt.Println("下载已取消")
		return
	}

	task.Name = version

	// 检查版本是否已存在
	downloadsDir := s.GetDownloadsDir()
	existingPath := filepath.Join(downloadsDir, version)
	if _, err := os.Stat(existingPath); err == nil {
		// 版本已存在
		if overwrite {
			// 删除旧版本
			fmt.Printf("覆盖模式：删除旧版本 %s\n", version)
			os.RemoveAll(existingPath)
		} else {
			// 返回重复状态
			task.Status = "duplicate"
			task.Error = fmt.Sprintf("版本 %s 已存在", version)
			fmt.Printf("版本已存在: %s\n", version)
			return
		}
	}

	// 创建临时文件保存 zip
	tempDir, err := os.MkdirTemp("", "war_download_*")
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("创建临时目录失败: %v", err)
		return
	}
	defer os.RemoveAll(tempDir) // 完成后删除临时目录

	tempZipPath := filepath.Join(tempDir, filename)
	tempFile, err := os.Create(tempZipPath)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("创建临时文件失败: %v", err)
		return
	}

	// 下载
	total := resp2.ContentLength
	task.Total = total
	fmt.Printf("文件大小: %d bytes\n", total)

	reader := bufio.NewReaderSize(resp2.Body, 256*1024)
	buf := make([]byte, 256*1024)
	var downloaded int64
	startTime := time.Now()
	lastPrint := startTime
	lastDownloaded := int64(0)

	for {
		// 检查是否被取消
		s.mu.RLock()
		cancelled := task.cancelled
		s.mu.RUnlock()
		if cancelled {
			tempFile.Close()
			task.Status = "cancelled"
			task.Error = "用户取消下载"
			fmt.Println("下载已取消")
			return
		}

		n, err := reader.Read(buf)
		if n > 0 {
			_, writeErr := tempFile.Write(buf[:n])
			if writeErr != nil {
				tempFile.Close()
				task.Status = "failed"
				task.Error = fmt.Sprintf("写入文件失败: %v", writeErr)
				return
			}
			downloaded += int64(n)
			task.Downloaded = downloaded

			now := time.Now()
			if now.Sub(lastPrint) > 500*time.Millisecond {
				if total > 0 {
					task.Percentage = float64(downloaded) * 100 / float64(total)
				}
				elapsed := now.Sub(lastPrint).Seconds()
				if elapsed > 0 {
					speed := float64(downloaded-lastDownloaded) / elapsed
					if speed > 1024*1024 {
						task.Speed = fmt.Sprintf("%.2f MB/s", speed/1024/1024)
					} else {
						task.Speed = fmt.Sprintf("%.2f KB/s", speed/1024)
					}
				}
				fmt.Printf("已下载: %.2f MB, 速度: %s\n", float64(downloaded)/1024/1024, task.Speed)
				lastPrint = now
				lastDownloaded = downloaded
			}
		}

		if err != nil {
			if err == io.EOF {
				break
			}
			tempFile.Close()
			task.Status = "failed"
			task.Error = fmt.Sprintf("下载错误: %v", err)
			return
		}
	}
	tempFile.Close()

	elapsed := time.Since(startTime).Seconds()
	speed := float64(downloaded) / elapsed
	fmt.Printf("下载完成: %.2f MB, 耗时: %.2fs, 速度: %.2f MB/s\n", float64(downloaded)/1024/1024, elapsed, speed/1024/1024)

	// 根据文件名判断 packageType（不打开 zip 文件）
	lf := strings.ToLower(filename)
	detectedType := task.PackageType
	if strings.Contains(lf, "war") {
		detectedType = "war"
	} else {
		// installer/updater/install/upgrade/patch 统一为 upgrade（安装升级包）
		detectedType = "upgrade"
	}
	task.PackageType = detectedType

	if task.PackageType == "war" {
		// WAR 包：解压出 .war 文件
		fmt.Printf("开始解压 WAR 包...\n")
		warFileName, err := s.extractZip(tempZipPath, version)
		if err != nil {
			task.Status = "failed"
			task.Error = fmt.Sprintf("解压失败: %v", err)
			return
		}
		task.FileName = warFileName
		fmt.Printf("解压完成: %s/%s\n", version, warFileName)
	} else {
		// 安装/升级包：创建同名文件夹并复制 zip 文件到其中
		fmt.Printf("创建文件夹并复制 zip 文件（安装包/升级包）...\n")

		// 创建版本命名的目录
		targetDir := s.GetDownloadsDir()
		versionDir := filepath.Join(targetDir, version)
		if err := os.MkdirAll(versionDir, 0755); err != nil {
			task.Status = "failed"
			task.Error = fmt.Sprintf("创建目录失败: %v", err)
			return
		}

		// 复制 zip 文件到版本目录中
		targetPath := filepath.Join(versionDir, filename) // 保持原始文件名
		if err := copyFile(tempZipPath, targetPath); err != nil {
			task.Status = "failed"
			task.Error = fmt.Sprintf("复制失败: %v", err)
			return
		}
		task.FileName = filepath.Join(version, filename)
		fmt.Printf("复制完成: %s\n", targetPath)
	}

	task.Status = "completed"
	task.Percentage = 100
	task.Downloaded = downloaded

	// 自动创建元数据（使用选择的包类型）
	metadata := &models.WarPackageMetadata{
		PackageName:      version,
		PackageType:      task.PackageType,
		Version:          version,
		OriginalFileName: &filename, // 保存原始文件名
		IsRelease:        false,
		Description:      "",
	}
	if s.metadataRepo != nil {
		err = s.metadataRepo.CreateOrUpdate(metadata)
		if err != nil {
			fmt.Printf("创建元数据失败: %v\n", err)
		} else {
			fmt.Printf("创建元数据成功: %s (%s)\n", version, task.PackageType)
		}
	}
}

// copyFile 复制文件
func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

// extractZip 解压 zip 文件，返回 war 文件名（仅用于 WAR 包）
func (s *WarDownloadService) extractZip(zipPath, version string) (string, error) {
	downloadsDir := s.GetDownloadsDir()

	// 打开 zip 文件
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", fmt.Errorf("打开 zip 失败: %v", err)
	}
	defer r.Close()

	var warFileName string

	for _, f := range r.File {
		// 只解压 .war 文件
		if !strings.HasSuffix(f.Name, ".war") {
			continue
		}

		// 创建目标目录
		targetDir := filepath.Join(downloadsDir, version)
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			return "", fmt.Errorf("创建目录失败: %v", err)
		}

		// 获取文件名（不含路径）
		warFileName = filepath.Base(f.Name)
		targetPath := filepath.Join(targetDir, warFileName)

		// 解压文件
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("打开 zip 内文件失败: %v", err)
		}

		targetFile, err := os.Create(targetPath)
		if err != nil {
			rc.Close()
			return "", fmt.Errorf("创建目标文件失败: %v", err)
		}

		_, err = io.Copy(targetFile, rc)
		targetFile.Close()
		rc.Close()

		if err != nil {
			return "", fmt.Errorf("解压文件失败: %v", err)
		}

		fmt.Printf("解压文件: %s -> %s\n", f.Name, targetPath)
		break // 只取第一个 war 文件
	}

	if warFileName == "" {
		return "", fmt.Errorf("zip 中未找到 .war 文件")
	}

	return warFileName, nil
}
