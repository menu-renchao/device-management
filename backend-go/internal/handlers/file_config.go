package handlers

import (
	"fmt"
	"log"
	"strconv"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type FileConfigHandler struct {
	repo         *repository.FileConfigRepository
	linuxService *services.LinuxService
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
		log.Printf("[GetFileConfigs] Error: %v", err)
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
		MerchantID string `json:"merchant_id" binding:"required"`
		ConfigIDs  []uint `json:"config_ids"`
		Env        string `json:"env"`
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
		var err error
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
