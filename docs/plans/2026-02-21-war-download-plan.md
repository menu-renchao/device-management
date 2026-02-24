# WAR 包网络下载功能 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在升级部署模块中集成 WAR 包网络下载功能，支持从 URL 下载、本地存储管理、历史包选择

**Architecture:** 后端使用 Go 下载文件到本地 downloads 目录，Cookie 存储在 SQLite 数据库，前端提供三种选择模式（本地上传/网络下载/历史包）

**Tech Stack:** Go, Gin, GORM, SQLite, React, Axios

---

## Task 1: 后端 - 添加下载配置到 Config

**Files:**
- Modify: `backend-go/internal/config/config.go`

**Step 1: 添加 DownloadConfig 结构体**

在 `config.go` 中添加：

```go
type DownloadConfig struct {
    DownloadsDir string
}

// 在 Config struct 中添加
type Config struct {
    Server   ServerConfig
    JWT      JWTConfig
    Database DatabaseConfig
    CORS     CORSConfig
    Upload   UploadConfig
    Download DownloadConfig  // 新增
}
```

**Step 2: 在 Init() 中添加默认值**

```go
viper.SetDefault("DOWNLOADS_DIR", "downloads")

// 在 AppConfig 初始化中添加
Download: DownloadConfig{
    DownloadsDir: viper.GetString("DOWNLOADS_DIR"),
},
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

**Step 4: Commit**

```bash
git add backend-go/internal/config/config.go
git commit -m "feat: add DownloadConfig to config"
```

---

## Task 2: 后端 - 创建 SystemConfig 模型（存储 Cookie）

**Files:**
- Create: `backend-go/internal/models/system_config.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: 创建 SystemConfig 模型**

```go
package models

import (
	"time"

	"gorm.io/gorm"
)

type SystemConfig struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Key       string         `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value     string         `gorm:"type:text" json:"value"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (SystemConfig) TableName() string {
	return "system_configs"
}
```

**Step 2: 在 main.go 的 AutoMigrate 中添加**

```go
&models.SystemConfig{},
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

**Step 4: Commit**

```bash
git add backend-go/internal/models/system_config.go backend-go/cmd/server/main.go
git commit -m "feat: add SystemConfig model for storing cookies"
```

---

## Task 3: 后端 - 创建 SystemConfig Repository

**Files:**
- Create: `backend-go/internal/repository/system_config_repo.go`

**Step 1: 创建 Repository**

```go
package repository

import (
	"pos-scanner-backend/internal/models"

	"gorm.io/gorm"
)

type SystemConfigRepository struct {
	db *gorm.DB
}

func NewSystemConfigRepository(db *gorm.DB) *SystemConfigRepository {
	return &SystemConfigRepository{db: db}
}

func (r *SystemConfigRepository) GetByKey(key string) (*models.SystemConfig, error) {
	var config models.SystemConfig
	err := r.db.Where("key = ?", key).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *SystemConfigRepository) Upsert(key, value string) error {
	var config models.SystemConfig
	result := r.db.Where("key = ?", key).First(&config)
	if result.Error == gorm.ErrRecordNotFound {
		config = models.SystemConfig{Key: key, Value: value}
		return r.db.Create(&config).Error
	}
	config.Value = value
	return r.db.Save(&config).Error
}

func (r *SystemConfigRepository) GetAll() ([]models.SystemConfig, error) {
	var configs []models.SystemConfig
	err := r.db.Find(&configs).Error
	return configs, err
}
```

**Step 2: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

**Step 3: Commit**

```bash
git add backend-go/internal/repository/system_config_repo.go
git commit -m "feat: add SystemConfigRepository"
```

---

## Task 4: 后端 - 创建 WAR 下载服务

**Files:**
- Create: `backend-go/internal/services/war_download_service.go`

**Step 1: 创建下载服务**

```go
package services

import (
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

	"pos-scanner-backend/internal/config"
	"pos-scanner-backend/internal/repository"

	"github.com/google/uuid"
)

type DownloadTask struct {
	ID            string
	Status        string // "downloading", "completed", "failed"
	Percentage    float64
	Downloaded    int64
	Total         int64
	Speed         string
	Error         string
	Name          string
	FileName      string
	cancelled     bool
}

type WarDownloadService struct {
	configRepo *repository.SystemConfigRepository
	tasks      map[string]*DownloadTask
	mu         sync.RWMutex
}

func NewWarDownloadService(configRepo *repository.SystemConfigRepository) *WarDownloadService {
	return &WarDownloadService{
		configRepo: configRepo,
		tasks:      make(map[string]*DownloadTask),
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
				if strings.HasSuffix(f.Name(), ".war") || strings.HasSuffix(f.Name(), ".zip") {
					info, _ := f.Info()
					packages = append(packages, map[string]interface{}{
						"name":       entry.Name(),
						"file_name":  f.Name(),
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

func (s *WarDownloadService) StartDownload(downloadURL string) (*DownloadTask, error) {
	// 获取 Cookie
	cookie := ""
	config, err := s.configRepo.GetByKey("download_cookie")
	if err == nil {
		cookie = config.Value
	}

	taskID := uuid.New().String()
	task := &DownloadTask{
		ID:     taskID,
		Status: "downloading",
	}

	s.mu.Lock()
	s.tasks[taskID] = task
	s.mu.Unlock()

	go s.doDownload(task, downloadURL, cookie)

	return task, nil
}

func (s *WarDownloadService) doDownload(task *DownloadTask, downloadURL, cookie string) {
	// URL 转换
	finalURL := s.transformURL(downloadURL)
	if finalURL != downloadURL {
		fmt.Printf("URL 转换: %s -> %s\n", downloadURL, finalURL)
	}

	// 第一次请求获取重定向
	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}

	req, _ := http.NewRequest("GET", finalURL, nil)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("请求失败: %v", err)
		return
	}
	defer resp.Body.Close()

	var downloadURL2 string
	if resp.StatusCode == 302 || resp.StatusCode == 301 {
		downloadURL2 = resp.Header.Get("Location")
		if downloadURL2 == "" {
			task.Status = "failed"
			task.Error = "未找到重定向 URL"
			return
		}
	} else {
		downloadURL2 = finalURL
	}

	// 第二次请求下载文件
	req2, _ := http.NewRequest("GET", downloadURL2, nil)
	if cookie != "" {
		req2.Header.Set("Cookie", cookie)
	}
	req2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("下载失败: %v", err)
		return
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != 200 {
		task.Status = "failed"
		task.Error = fmt.Sprintf("下载失败，状态码: %d", resp2.StatusCode)
		return
	}

	// 获取文件名
	filename := "artifacts.zip"
	contentDisp := resp2.Header.Get("Content-Disposition")
	if contentDisp != "" {
		re := regexp.MustCompile(`filename\*=UTF-8''(.+)`)
		if match := re.FindStringSubmatch(contentDisp); len(match) > 1 {
			filename = match[1]
		}
	}

	// 去掉 .zip 后缀作为文件夹名
	pkgName := strings.TrimSuffix(filename, ".zip")
	if pkgName == filename {
		pkgName = strings.TrimSuffix(filename, ".war")
	}

	task.Name = pkgName
	task.FileName = filename

	// 创建目录
	pkgDir := filepath.Join(s.GetDownloadsDir(), pkgName)
	os.MkdirAll(pkgDir, 0755)

	filePath := filepath.Join(pkgDir, filename)
	file, err := os.Create(filePath)
	if err != nil {
		task.Status = "failed"
		task.Error = fmt.Sprintf("创建文件失败: %v", err)
		return
	}
	defer file.Close()

	// 下载
	total := resp2.ContentLength
	task.Total = total

	buf := make([]byte, 8192)
	var downloaded int64
	startTime := time.Now()
	lastTime := startTime
	lastDownloaded := int64(0)

	for {
		if task.cancelled {
			task.Status = "failed"
			task.Error = "下载已取消"
			file.Close()
			os.Remove(filePath)
			os.Remove(pkgDir)
			return
		}

		n, err := resp2.Body.Read(buf)
		if n > 0 {
			file.Write(buf[:n])
			downloaded += int64(n)
			task.Downloaded = downloaded

			now := time.Now()
			if now.Sub(lastTime) > 500*time.Millisecond {
				if total > 0 {
					task.Percentage = float64(downloaded) * 100 / float64(total)
				}
				elapsed := now.Sub(lastTime).Seconds()
				if elapsed > 0 {
					speed := float64(downloaded-lastDownloaded) / elapsed
					if speed > 1024*1024 {
						task.Speed = fmt.Sprintf("%.2f MB/s", speed/1024/1024)
					} else {
						task.Speed = fmt.Sprintf("%.2f KB/s", speed/1024)
					}
				}
				lastTime = now
				lastDownloaded = downloaded
			}
		}

		if err != nil {
			if err == io.EOF {
				break
			}
			task.Status = "failed"
			task.Error = fmt.Sprintf("下载错误: %v", err)
			return
		}
	}

	task.Status = "completed"
	task.Percentage = 100
	fmt.Printf("下载完成: %s\n", filePath)
}
```

**Step 2: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

**Step 3: Commit**

```bash
git add backend-go/internal/services/war_download_service.go
git commit -m "feat: add WarDownloadService with progress tracking"
```

---

## Task 5: 后端 - 创建 WAR 下载 Handler

**Files:**
- Create: `backend-go/internal/handlers/war_download.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: 创建 Handler**

```go
package handlers

import (
	"pos-scanner-backend/internal/repository"
	"pos-scanner-backend/internal/services"
	"pos-scanner-backend/pkg/response"

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
	packages, err := h.service.ListPackages()
	if err != nil {
		response.InternalError(c, "获取包列表失败")
		return
	}
	response.Success(c, gin.H{"packages": packages})
}

// StartDownload 开始下载
func (h *WarDownloadHandler) StartDownload(c *gin.Context) {
	var req struct {
		URL string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	task, err := h.service.StartDownload(req.URL)
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
		response.NotFound(c, "任务不存在")
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
```

**Step 2: 在 main.go 中注册**

添加 repository:
```go
systemConfigRepo := repository.NewSystemConfigRepository(db)
```

创建 service 和 handler:
```go
warDownloadService := services.NewWarDownloadService(systemConfigRepo)
warDownloadHandler := handlers.NewWarDownloadHandler(warDownloadService, systemConfigRepo)
```

添加路由:
```go
// WAR download routes
linux.GET("/war/list", warDownloadHandler.ListPackages)
linux.POST("/war/download", warDownloadHandler.StartDownload)
linux.GET("/war/download/progress/:taskId", warDownloadHandler.GetDownloadProgress)
linux.DELETE("/war/:name", warDownloadHandler.DeletePackage)
linux.GET("/war/config", warDownloadHandler.GetDownloadConfig)
linux.PUT("/war/config", middleware.AdminOnly(userRepo), warDownloadHandler.UpdateDownloadConfig)
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

**Step 4: Commit**

```bash
git add backend-go/internal/handlers/war_download.go backend-go/cmd/server/main.go
git commit -m "feat: add WarDownloadHandler and routes"
```

---

## Task 6: 前端 - 添加下载 API 方法

**Files:**
- Modify: `frontend/src/services/api.js`

**Step 1: 添加 WAR 下载相关 API**

在 `linuxAPI` 对象中添加：

```javascript
// WAR 包下载管理
getWarPackages: async () => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get('/linux/war/list');
  return response.data;
},

startWarDownload: async (url) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post('/linux/war/download', { url });
  return response.data;
},

getWarDownloadProgress: async (taskId) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get(`/linux/war/download/progress/${taskId}`);
  return response.data;
},

deleteWarPackage: async (name) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.delete(`/linux/war/${encodeURIComponent(name)}`);
  return response.data;
},

getDownloadConfig: async () => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get('/linux/war/config');
  return response.data;
},

updateDownloadConfig: async (cookie) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.put('/linux/war/config', { cookie });
  return response.data;
},
```

**Step 2: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add WAR download API methods"
```

---

## Task 7: 前端 - 重构 UpgradeTab 添加下载功能

**Files:**
- Modify: `frontend/src/components/linux/UpgradeTab.jsx`

**主要修改：**

1. **添加状态变量**：
```javascript
const [selectMode, setSelectMode] = useState('local'); // 'local', 'download', 'history'
const [downloadUrl, setDownloadUrl] = useState('');
const [downloading, setDownloading] = useState(false);
const [downloadTaskId, setDownloadTaskId] = useState(null);
const [downloadProgress, setDownloadProgress] = useState(null);
const [historyPackages, setHistoryPackages] = useState([]);
const [selectedHistoryPackage, setSelectedHistoryPackage] = useState(null);
```

2. **添加加载历史包函数**：
```javascript
const loadHistoryPackages = async () => {
  try {
    const result = await linuxAPI.getWarPackages();
    setHistoryPackages(result.data?.packages || []);
  } catch (error) {
    console.error('加载历史包列表失败:', error);
  }
};

useEffect(() => {
  loadHistoryPackages();
}, []);
```

3. **添加下载函数**：
```javascript
const handleStartDownload = async () => {
  if (!downloadUrl.trim()) {
    alert('请输入下载 URL');
    return;
  }

  setDownloading(true);
  setDownloadProgress(null);

  try {
    const result = await linuxAPI.startWarDownload(downloadUrl);
    setDownloadTaskId(result.data?.task_id);
    pollDownloadProgress(result.data?.task_id);
  } catch (error) {
    alert('开始下载失败：' + (error.response?.data?.message || error.message));
    setDownloading(false);
  }
};

const pollDownloadProgress = (taskId) => {
  const interval = setInterval(async () => {
    try {
      const result = await linuxAPI.getWarDownloadProgress(taskId);
      setDownloadProgress(result.data);

      if (result.data?.status === 'completed') {
        clearInterval(interval);
        setDownloading(false);
        loadHistoryPackages();
        setSelectedHistoryPackage(result.data?.name);
        setSelectMode('history');
        alert('下载完成！');
      } else if (result.data?.status === 'failed') {
        clearInterval(interval);
        setDownloading(false);
        alert('下载失败：' + (result.data?.error || '未知错误'));
      }
    } catch (error) {
      console.error('获取进度失败:', error);
    }
  }, 1000);
};
```

4. **修改 UI 布局**（替换现有的"选择 WAR 包"部分）

**Step 2: Commit**

```bash
git add frontend/src/components/linux/UpgradeTab.jsx
git commit -m "feat: integrate WAR download and history selection in UpgradeTab"
```

---

## Task 8: 前端 - 添加 Cookie 配置入口（管理员）

**Files:**
- Create: `frontend/src/components/linux/DownloadConfigModal.jsx`
- Modify: `frontend/src/components/linux/UpgradeTab.jsx`

**Step 1: 创建 DownloadConfigModal 组件**

```jsx
import React, { useState, useEffect } from 'react';
import { linuxAPI } from '../../services/api';

const DownloadConfigModal = ({ isOpen, onClose }) => {
  const [cookie, setCookie] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const result = await linuxAPI.getDownloadConfig();
      setCookie(result.data?.cookie || '');
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await linuxAPI.updateDownloadConfig(cookie);
      onClose();
    } catch (error) {
      alert('保存失败：' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>下载配置</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <div style={styles.body}>
          <div style={styles.formGroup}>
            <label style={styles.label}>下载 Cookie</label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="粘贴 Cookie 字符串..."
              style={styles.textarea}
            />
            <p style={styles.hint}>从浏览器开发者工具中复制 Cookie</p>
          </div>
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>取消</button>
          <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '500px',
    maxWidth: '90vw',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E5EA',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#86868B',
  },
  body: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    height: '100px',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '11px',
    color: '#86868B',
    marginTop: '6px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid #E5E5EA',
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default DownloadConfigModal;
```

**Step 2: 在 UpgradeTab 中添加配置按钮和弹窗**

```jsx
import DownloadConfigModal from './DownloadConfigModal';

// 添加状态
const [showDownloadConfig, setShowDownloadConfig] = useState(false);

// 在下载 URL 输入框旁边添加按钮
<button onClick={() => setShowDownloadConfig(true)} style={styles.configBtn}>
  配置
</button>

// 添加弹窗
<DownloadConfigModal
  isOpen={showDownloadConfig}
  onClose={() => setShowDownloadConfig(false)}
/>
```

**Step 3: Commit**

```bash
git add frontend/src/components/linux/DownloadConfigModal.jsx frontend/src/components/linux/UpgradeTab.jsx
git commit -m "feat: add DownloadConfigModal for admin cookie config"
```

---

## Task 9: 构建和测试

**Step 1: 构建前端**

```bash
cd frontend && npm run build
```

**Step 2: 重启后端测试**

测试 API:
```bash
# 获取包列表
curl http://localhost:5000/api/linux/war/list -H "Authorization: Bearer <token>"

# 开始下载
curl -X POST http://localhost:5000/api/linux/war/download \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://..."}'
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: complete WAR download integration"
```

---

## 执行顺序总结

1. Task 1: 后端 - 添加下载配置
2. Task 2: 后端 - 创建 SystemConfig 模型
3. Task 3: 后端 - 创建 SystemConfig Repository
4. Task 4: 后端 - 创建 WAR 下载服务
5. Task 5: 后端 - 创建 WAR 下载 Handler 和路由
6. Task 6: 前端 - 添加下载 API 方法
7. Task 7: 前端 - 重构 UpgradeTab
8. Task 8: 前端 - 添加 Cookie 配置弹窗
9. Task 9: 构建和测试
