# 文件配置集成到升级部署 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 linux_file_config 模块功能集成到升级部署 Tab 中，支持三环境配置管理，管理员权限控制

**Architecture:** 后端使用 Go Gin + GORM + SQLite，前端使用 React + Ant Design。配置数据存储在 SQLite，通过 REST API 提供增删改查和执行接口

**Tech Stack:** Go, Gin, GORM, SQLite, React, Ant Design

---

## Task 1: 后端 - 创建 FileConfig 数据模型

**Files:**
- Create: `backend-go/internal/models/file_config.go`

**Step 1: 创建 FileConfig 模型文件**

```go
package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// KeyValueItem 键值对配置项
type KeyValueItem struct {
	Key       string `json:"key"`
	QAValue   string `json:"qa_value"`
	ProdValue string `json:"prod_value"`
	DevValue  string `json:"dev_value"`
}

// KeyValueList 键值对列表（用于 GORM 存储）
type KeyValueList []KeyValueItem

// Value 实现 driver.Valuer 接口
func (k KeyValueList) Value() (driver.Value, error) {
	return json.Marshal(k)
}

// Scan 实现 sql.Scanner 接口
func (k *KeyValueList) Scan(value interface{}) error {
	if value == nil {
		*k = []KeyValueItem{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, k)
}

// FileConfig 文件配置模型
type FileConfig struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Name       string         `gorm:"size:100;uniqueIndex;not null" json:"name"`
	FilePath   string         `gorm:"size:500;not null" json:"file_path"`
	KeyValues  KeyValueList   `gorm:"type:text;not null" json:"key_values"`
	Enabled    bool           `gorm:"default:true" json:"enabled"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (FileConfig) TableName() string {
	return "file_configs"
}

// GetAbsoluteRemotePath 获取远程绝对路径
func (f *FileConfig) GetAbsoluteRemotePath() string {
	return "/opt/tomcat7/webapps/" + f.FilePath
}

// GetValueByEnv 根据环境获取键值
func (k *KeyValueItem) GetValueByEnv(env string) string {
	switch env {
	case "QA":
		return k.QAValue
	case "PROD":
		return k.ProdValue
	case "DEV":
		return k.DevValue
	default:
		return k.QAValue
	}
}
```

**Step 2: 在 main.go 中注册模型迁移**

修改文件: `backend-go/cmd/server/main.go:35-43`

在 AutoMigrate 中添加 `&models.FileConfig{}`:

```go
// Auto migrate
if err := db.AutoMigrate(
	&models.User{},
	&models.ScanResult{},
	&models.DeviceProperty{},
	&models.DeviceOccupancy{},
	&models.DeviceClaim{},
	&models.MobileDevice{},
	&models.ScanSession{},
	&models.FileConfig{}, // 新增
); err != nil {
	log.Fatalf("Failed to migrate database: %v", err)
}
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

Expected: 编译成功，无错误

**Step 4: Commit**

```bash
git add backend-go/internal/models/file_config.go backend-go/cmd/server/main.go
git commit -m "feat: add FileConfig model for file configuration management"
```

---

## Task 2: 后端 - 创建文件配置 Repository

**Files:**
- Create: `backend-go/internal/repository/file_config_repo.go`

**Step 1: 创建 Repository 文件**

```go
package repository

import (
	"pos-scanner-backend/internal/models"

	"gorm.io/gorm"
)

type FileConfigRepository struct {
	db *gorm.DB
}

func NewFileConfigRepository(db *gorm.DB) *FileConfigRepository {
	return &FileConfigRepository{db: db}
}

// GetAll 获取所有配置
func (r *FileConfigRepository) GetAll() ([]models.FileConfig, error) {
	var configs []models.FileConfig
	err := r.db.Order("id ASC").Find(&configs).Error
	return configs, err
}

// GetByID 根据ID获取配置
func (r *FileConfigRepository) GetByID(id uint) (*models.FileConfig, error) {
	var config models.FileConfig
	err := r.db.First(&config, id).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// GetEnabled 获取所有启用的配置
func (r *FileConfigRepository) GetEnabled() ([]models.FileConfig, error) {
	var configs []models.FileConfig
	err := r.db.Where("enabled = ?", true).Order("id ASC").Find(&configs).Error
	return configs, err
}

// Create 创建配置
func (r *FileConfigRepository) Create(config *models.FileConfig) error {
	return r.db.Create(config).Error
}

// Update 更新配置
func (r *FileConfigRepository) Update(config *models.FileConfig) error {
	return r.db.Save(config).Error
}

// Delete 删除配置
func (r *FileConfigRepository) Delete(id uint) error {
	return r.db.Delete(&models.FileConfig{}, id).Error
}

// ExistsByName 检查名称是否存在
func (r *FileConfigRepository) ExistsByName(name string, excludeID uint) bool {
	var count int64
	query := r.db.Model(&models.FileConfig{}).Where("name = ?", name)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	query.Count(&count)
	return count > 0
}
```

**Step 2: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

Expected: 编译成功

**Step 3: Commit**

```bash
git add backend-go/internal/repository/file_config_repo.go
git commit -m "feat: add FileConfigRepository for database operations"
```

---

## Task 3: 后端 - 在 LinuxService 中添加配置执行逻辑

**Files:**
- Modify: `backend-go/internal/services/linux_service.go`

**Step 1: 添加文件配置执行方法**

在 `linux_service.go` 末尾添加:

```go
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
	escapedContent := strings.ReplaceAll(content, "'", "'\\''")
	cmd := fmt.Sprintf("cat > %s << 'ENDOFFILE'\n%s\nENDOFFILE", remotePath, escapedContent)
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
```

**Step 2: 在文件顶部添加 encoding/json 导入**

```go
import (
	"encoding/json"
	// ... 其他导入
)
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

Expected: 编译成功

**Step 4: Commit**

```bash
git add backend-go/internal/services/linux_service.go
git commit -m "feat: add file config execution methods to LinuxService"
```

---

## Task 4: 后端 - 创建 FileConfig Handler 和 API 路由

**Files:**
- Create: `backend-go/internal/handlers/file_config.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: 创建 Handler 文件**

```go
package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"pos-scanner-backend/internal/models"
	"pos-scanner-backend/internal/repository"
	"pos-scanner-backend/internal/services"
	"pos-scanner-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type FileConfigHandler struct {
	repo          *repository.FileConfigRepository
	linuxService  *services.LinuxService
}

func NewFileConfigHandler(repo *repository.FileConfigRepository, linuxService *services.LinuxService) *FileConfigHandler {
	return &FileConfigHandler{
		repo:         repo,
		linuxService: linuxService,
	}
}

// GetFileConfigs 获取所有文件配置
func (h *FileConfigHandler) GetFileConfigs(c *gin.Context) {
	configs, err := h.repo.GetAll()
	if err != nil {
		response.InternalError(c, "获取配置列表失败")
		return
	}
	response.Success(c, gin.H{"configs": configs})
}

// GetFileConfig 获取单个配置
func (h *FileConfigHandler) GetFileConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的配置ID")
		return
	}

	config, err := h.repo.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "配置不存在")
		return
	}
	response.Success(c, gin.H{"config": config})
}

// CreateFileConfig 创建文件配置（管理员）
func (h *FileConfigHandler) CreateFileConfig(c *gin.Context) {
	var req struct {
		Name      string               `json:"name" binding:"required"`
		FilePath  string               `json:"file_path" binding:"required"`
		KeyValues models.KeyValueList  `json:"key_values" binding:"required"`
		Enabled   bool                 `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 检查名称是否重复
	if h.repo.ExistsByName(req.Name, 0) {
		response.BadRequest(c, "配置名称已存在")
		return
	}

	config := &models.FileConfig{
		Name:      req.Name,
		FilePath:  req.FilePath,
		KeyValues: req.KeyValues,
		Enabled:   req.Enabled,
	}

	if err := h.repo.Create(config); err != nil {
		response.InternalError(c, "创建配置失败")
		return
	}

	response.SuccessWithMessage(c, "配置创建成功", gin.H{"config": config})
}

// UpdateFileConfig 更新文件配置（管理员）
func (h *FileConfigHandler) UpdateFileConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的配置ID")
		return
	}

	var req struct {
		Name      string              `json:"name" binding:"required"`
		FilePath  string              `json:"file_path" binding:"required"`
		KeyValues models.KeyValueList `json:"key_values" binding:"required"`
		Enabled   bool                `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 检查名称是否重复
	if h.repo.ExistsByName(req.Name, uint(id)) {
		response.BadRequest(c, "配置名称已存在")
		return
	}

	config, err := h.repo.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	config.Name = req.Name
	config.FilePath = req.FilePath
	config.KeyValues = req.KeyValues
	config.Enabled = req.Enabled

	if err := h.repo.Update(config); err != nil {
		response.InternalError(c, "更新配置失败")
		return
	}

	response.SuccessWithMessage(c, "配置更新成功", gin.H{"config": config})
}

// DeleteFileConfig 删除文件配置（管理员）
func (h *FileConfigHandler) DeleteFileConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的配置ID")
		return
	}

	if err := h.repo.Delete(uint(id)); err != nil {
		response.InternalError(c, "删除配置失败")
		return
	}

	response.SuccessWithMessage(c, "配置删除成功", nil)
}

// ToggleFileConfig 切换配置启用状态（管理员）
func (h *FileConfigHandler) ToggleFileConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的配置ID")
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	config, err := h.repo.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	config.Enabled = req.Enabled
	if err := h.repo.Update(config); err != nil {
		response.InternalError(c, "更新配置失败")
		return
	}

	status := "禁用"
	if req.Enabled {
		status = "启用"
	}
	response.SuccessWithMessage(c, fmt.Sprintf("配置已%s", status), nil)
}

// ExecuteFileConfigs 执行文件配置修改
func (h *FileConfigHandler) ExecuteFileConfigs(c *gin.Context) {
	var req struct {
		MerchantID string  `json:"merchant_id" binding:"required"`
		ConfigIDs  []uint  `json:"config_ids"`
		Env        string  `json:"env"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	// 默认环境为 QA
	if req.Env == "" {
		req.Env = "QA"
	}

	// 验证环境值
	if req.Env != "QA" && req.Env != "PROD" && req.Env != "DEV" {
		response.BadRequest(c, "无效的环境值，必须是 QA、PROD 或 DEV")
		return
	}

	// 检查连接状态
	if !h.linuxService.IsConnected(req.MerchantID) {
		response.BadRequest(c, "未连接到设备")
		return
	}

	// 获取要执行的配置
	var configs []models.FileConfig
	var err error
	if len(req.ConfigIDs) > 0 {
		// 执行指定的配置
		for _, id := range req.ConfigIDs {
			config, err := h.repo.GetByID(id)
			if err == nil {
				configs = append(configs, *config)
			}
		}
	} else {
		// 执行所有启用的配置
		configs, err = h.repo.GetEnabled()
		if err != nil {
			response.InternalError(c, "获取配置列表失败")
			return
		}
	}

	if len(configs) == 0 {
		response.Success(c, gin.H{
			"success": 0,
			"failed":  0,
			"results": []string{},
		})
		return
	}

	// 执行配置修改
	var results []string
	successCount := 0
	failedCount := 0

	for _, config := range configs {
		msg, err := h.linuxService.ExecuteFileConfig(req.MerchantID, &config, req.Env)
		if err != nil {
			results = append(results, fmt.Sprintf("[失败] %s: %s", config.Name, err.Error()))
			failedCount++
		} else {
			results = append(results, fmt.Sprintf("[成功] %s", msg))
			successCount++
		}
	}

	response.Success(c, gin.H{
		"success": successCount,
		"failed":  failedCount,
		"results": results,
	})
}
```

**Step 2: 在 main.go 中注册路由**

在 `backend-go/cmd/server/main.go` 中:

1. 初始化 repository:
```go
fileConfigRepo := repository.NewFileConfigRepository(db)
```

2. 初始化 handler:
```go
fileConfigHandler := handlers.NewFileConfigHandler(fileConfigRepo, linuxService)
```

3. 在 linux 路由组中添加路由（在现有 linux 路由后面）:
```go
// File config management
linux.GET("/file-configs", fileConfigHandler.GetFileConfigs)
linux.GET("/file-configs/:id", fileConfigHandler.GetFileConfig)
linux.POST("/file-configs", middleware.AdminOnly(userRepo), fileConfigHandler.CreateFileConfig)
linux.PUT("/file-configs/:id", middleware.AdminOnly(userRepo), fileConfigHandler.UpdateFileConfig)
linux.DELETE("/file-configs/:id", middleware.AdminOnly(userRepo), fileConfigHandler.DeleteFileConfig)
linux.PUT("/file-configs/:id/toggle", middleware.AdminOnly(userRepo), fileConfigHandler.ToggleFileConfig)
linux.POST("/file-configs/execute", fileConfigHandler.ExecuteFileConfigs)
```

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

Expected: 编译成功

**Step 4: Commit**

```bash
git add backend-go/internal/handlers/file_config.go backend-go/cmd/server/main.go
git commit -m "feat: add FileConfigHandler and API routes"
```

---

## Task 5: 后端 - 修改一键升级流程集成配置执行

**Files:**
- Modify: `backend-go/internal/services/linux_service.go`

**Step 1: 修改 OneClickUpgrade 方法**

找到 `OneClickUpgrade` 方法（约第 596 行），修改为包含配置执行：

```go
// OneClickUpgrade 一键升级（包含配置修改）
func (s *LinuxService) OneClickUpgrade(merchantID, warPath string, configRepo *repository.FileConfigRepository, env string) (string, error) {
	// 1. 停止 POS
	_, err := s.StopPOS(merchantID)
	if err != nil {
		return "", fmt.Errorf("停止 POS 失败: %w", err)
	}

	// 2. 创建备份
	backupPath, err := s.CreateBackup(merchantID)
	if err != nil {
		return "", fmt.Errorf("创建备份失败: %w", err)
	}

	// 3. 替换 WAR 包
	if warPath != "" {
		_, err = s.ExecuteCommand(merchantID, fmt.Sprintf("cp %s /opt/tomcat7/webapps/ROOT.war", warPath))
		if err != nil {
			return "", fmt.Errorf("替换 WAR 包失败: %w", err)
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

	return fmt.Sprintf("升级完成！备份路径: %s", backupPath), nil
}
```

**Step 2: 修改 Handler 调用**

修改 `backend-go/internal/handlers/linux.go` 中的 `OneClickUpgrade` handler:

需要注入 FileConfigRepository，修改 handler 结构和初始化。

**Step 3: 编译验证**

```bash
cd backend-go && go build -o server.exe ./cmd/server
```

Expected: 编译成功

**Step 4: Commit**

```bash
git add backend-go/internal/services/linux_service.go backend-go/internal/handlers/linux.go
git commit -m "feat: integrate file config execution into one-click upgrade"
```

---

## Task 6: 前端 - 添加文件配置 API

**Files:**
- Modify: `frontend/src/services/api.js`

**Step 1: 在 linuxAPI 对象中添加配置相关 API**

```javascript
// 文件配置管理
getFileConfigs: async () => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get('/linux/file-configs');
  return response.data;
},

getFileConfig: async (id) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get(`/linux/file-configs/${id}`);
  return response.data;
},

createFileConfig: async (config) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post('/linux/file-configs', config);
  return response.data;
},

updateFileConfig: async (id, config) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.put(`/linux/file-configs/${id}`, config);
  return response.data;
},

deleteFileConfig: async (id) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.delete(`/linux/file-configs/${id}`);
  return response.data;
},

toggleFileConfig: async (id, enabled) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.put(`/linux/file-configs/${id}/toggle`, { enabled });
  return response.data;
},

executeFileConfigs: async (merchantId, configIds, env) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post('/linux/file-configs/execute', {
    merchant_id: merchantId,
    config_ids: configIds,
    env: env
  });
  return response.data;
},

// 修改 oneClickUpgrade 支持环境参数
oneClickUpgrade: async (merchantId, warPath, env = 'QA') => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post('/linux/upgrade', {
    merchant_id: merchantId,
    war_path: warPath,
    env: env
  });
  return response.data;
},
```

**Step 2: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add file config API methods"
```

---

## Task 7: 前端 - 创建文件配置管理弹窗组件

**Files:**
- Create: `frontend/src/components/linux/FileConfigModal.jsx`

**Step 1: 创建组件**

```jsx
import React, { useState, useEffect } from 'react';
import { linuxAPI } from '../../services/api';

const FileConfigModal = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    file_path: '',
    key_values: [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
    enabled: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name,
        file_path: config.file_path,
        key_values: config.key_values.length > 0 ? config.key_values : [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
        enabled: config.enabled
      });
    } else {
      setFormData({
        name: '',
        file_path: '',
        key_values: [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
        enabled: true
      });
    }
  }, [config, isOpen]);

  const handleAddKeyValue = () => {
    setFormData({
      ...formData,
      key_values: [...formData.key_values, { key: '', qa_value: '', prod_value: '', dev_value: '' }]
    });
  };

  const handleRemoveKeyValue = (index) => {
    const newKeyValues = formData.key_values.filter((_, i) => i !== index);
    setFormData({ ...formData, key_values: newKeyValues });
  };

  const handleKeyValueChange = (index, field, value) => {
    const newKeyValues = [...formData.key_values];
    newKeyValues[index] = { ...newKeyValues[index], [field]: value };
    setFormData({ ...formData, key_values: newKeyValues });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.file_path) {
      alert('请填写配置名称和文件路径');
      return;
    }

    setSaving(true);
    try {
      if (config) {
        await linuxAPI.updateFileConfig(config.id, formData);
      } else {
        await linuxAPI.createFileConfig(formData);
      }
      onSave();
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
          <h3 style={styles.title}>{config ? '编辑配置' : '新增配置'}</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          <div style={styles.formGroup}>
            <label style={styles.label}>配置名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: cloudUrlConfig"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>文件路径 * (相对于 /opt/tomcat7/webapps/)</label>
            <input
              type="text"
              value={formData.file_path}
              onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
              placeholder="例如: kpos/front/js/cloudUrlConfig.json"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              键值对配置
              <button onClick={handleAddKeyValue} style={styles.addBtn}>+ 添加</button>
            </label>
            <div style={styles.kvList}>
              {formData.key_values.map((kv, index) => (
                <div key={index} style={styles.kvItem}>
                  <input
                    type="text"
                    value={kv.key}
                    onChange={(e) => handleKeyValueChange(index, 'key', e.target.value)}
                    placeholder="键名 (如: api.url)"
                    style={styles.kvKey}
                  />
                  <input
                    type="text"
                    value={kv.qa_value}
                    onChange={(e) => handleKeyValueChange(index, 'qa_value', e.target.value)}
                    placeholder="QA 值"
                    style={styles.kvValue}
                  />
                  <input
                    type="text"
                    value={kv.prod_value}
                    onChange={(e) => handleKeyValueChange(index, 'prod_value', e.target.value)}
                    placeholder="PROD 值"
                    style={styles.kvValue}
                  />
                  <input
                    type="text"
                    value={kv.dev_value}
                    onChange={(e) => handleKeyValueChange(index, 'dev_value', e.target.value)}
                    placeholder="DEV 值"
                    style={styles.kvValue}
                  />
                  {formData.key_values.length > 1 && (
                    <button onClick={() => handleRemoveKeyValue(index)} style={styles.removeBtn}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              启用此配置
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={styles.saveBtn}>
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
    width: '700px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
    overflowY: 'auto',
    flex: 1,
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  addBtn: {
    marginLeft: '10px',
    padding: '4px 10px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  kvList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kvItem: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  kvKey: {
    flex: '0 0 150px',
    padding: '8px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  kvValue: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  removeBtn: {
    padding: '4px 8px',
    backgroundColor: '#FF3B30',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    cursor: 'pointer',
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
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default FileConfigModal;
```

**Step 2: Commit**

```bash
git add frontend/src/components/linux/FileConfigModal.jsx
git commit -m "feat: add FileConfigModal component for admin config management"
```

---

## Task 8: 前端 - 重构 UpgradeTab 集成配置管理

**Files:**
- Modify: `frontend/src/components/linux/UpgradeTab.jsx`

**Step 1: 重构组件，添加配置管理功能**

主要修改：
1. 添加环境选择（默认 QA）
2. 添加配置列表展示
3. 添加配置执行按钮
4. 管理员可见配置管理按钮
5. 修改一键升级传递环境参数

需要添加：
- 获取当前用户角色（从 localStorage）
- 加载配置列表
- 配置选择状态
- 执行配置修改
- 打开配置管理弹窗

**Step 2: Commit**

```bash
git add frontend/src/components/linux/UpgradeTab.jsx
git commit -m "feat: integrate file config management into UpgradeTab"
```

---

## Task 9: 前端 - 移除 ConfigTab

**Files:**
- Delete: `frontend/src/components/linux/ConfigTab.jsx`
- Modify: `frontend/src/pages/LinuxConfigPage.jsx`

**Step 1: 删除 ConfigTab.jsx**

```bash
rm frontend/src/components/linux/ConfigTab.jsx
```

**Step 2: 从 LinuxConfigPage 中移除 ConfigTab 引用**

1. 移除 import: `import ConfigTab from '../components/linux/ConfigTab';`
2. 移除 tabs 数组中的 config 项
3. 移除渲染 ConfigTab 的代码

**Step 3: Commit**

```bash
git add frontend/src/components/linux/ConfigTab.jsx frontend/src/pages/LinuxConfigPage.jsx
git commit -m "refactor: remove legacy ConfigTab component"
```

---

## Task 10: 前端 - 构建和测试

**Step 1: 构建前端**

```bash
cd frontend && npm run build
```

Expected: 构建成功

**Step 2: 重启后端服务**

```bash
cd backend-go && ./server.exe
```

**Step 3: 手动测试功能**

1. 管理员登录
2. 连接 Linux 设备
3. 进入升级部署 Tab
4. 测试环境选择
5. 测试配置列表加载
6. 测试新增/编辑/删除配置（管理员）
7. 测试执行配置修改
8. 测试一键升级（包含配置修改）

**Step 4: 最终 Commit**

```bash
git add .
git commit -m "feat: complete file config integration"
```

---

## 执行顺序总结

1. Task 1: 后端 - FileConfig 模型
2. Task 2: 后端 - FileConfigRepository
3. Task 3: 后端 - LinuxService 配置执行逻辑
4. Task 4: 后端 - FileConfigHandler 和路由
5. Task 5: 后端 - 一键升级集成配置
6. Task 6: 前端 - API 方法
7. Task 7: 前端 - FileConfigModal 组件
8. Task 8: 前端 - UpgradeTab 重构
9. Task 9: 前端 - 移除 ConfigTab
10. Task 10: 构建和测试
