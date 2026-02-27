package handlers

import (
	"strconv"

	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

// WarPackageHandler WAR包元数据处理器
type WarPackageHandler struct {
	metadataRepo *repository.WarPackageRepository
}

func NewWarPackageHandler(metadataRepo *repository.WarPackageRepository) *WarPackageHandler {
	return &WarPackageHandler{
		metadataRepo: metadataRepo,
	}
}

// ListMetadata 列出所有包元数据
func (h *WarPackageHandler) ListMetadata(c *gin.Context) {
	list, err := h.metadataRepo.List()
	if err != nil {
		response.InternalError(c, "获取包列表失败: "+err.Error())
		return
	}

	// 添加类型标签
	result := make([]map[string]interface{}, len(list))
	for i, item := range list {
		result[i] = map[string]interface{}{
			"id":                item.ID,
			"package_name":       item.PackageName,
			"package_type":       item.PackageType,
			"type_label":         models.PackageTypeLabels[item.PackageType],
			"version":           item.Version,
			"original_file_name": item.OriginalFileName,
			"is_release":        item.IsRelease,
			"description":       item.Description,
			"created_at":        item.CreatedAt,
			"updated_at":        item.UpdatedAt,
		}
	}

	response.SuccessWithMessage(c, "获取成功", gin.H{
		"packages": result,
		"types":    models.PackageTypeLabels,
	})
}

// GetMetadata 获取指定包的元数据
func (h *WarPackageHandler) GetMetadata(c *gin.Context) {
	packageName := c.Query("package_name")
	if packageName == "" {
		response.BadRequest(c, "请提供包名称")
		return
	}

	metadata, err := h.metadataRepo.GetByPackageName(packageName)
	if err != nil {
		response.InternalError(c, "获取元数据失败: "+err.Error())
		return
	}
	if metadata == nil {
		response.NotFound(c, "元数据不存在")
		return
	}

	// 添加类型标签
	result := map[string]interface{}{
		"id":                metadata.ID,
		"package_name":       metadata.PackageName,
		"package_type":       metadata.PackageType,
		"type_label":         models.PackageTypeLabels[metadata.PackageType],
		"version":           metadata.Version,
		"original_file_name": metadata.OriginalFileName,
		"is_release":        metadata.IsRelease,
		"description":       metadata.Description,
		"created_at":        metadata.CreatedAt,
		"updated_at":        metadata.UpdatedAt,
	}

	response.SuccessWithMessage(c, "获取成功", result)
}

// UpdateMetadataRequest 更新元数据请求
type UpdateMetadataRequest struct {
	PackageName string `json:"package_name" binding:"required"`
	PackageType string `json:"package_type" binding:"required,oneof=upgrade install war"`
	Version     string `json:"version" binding:"required"`
	IsRelease   bool   `json:"is_release"`
	Description string `json:"description"`
}

// UpdateMetadata 更新包元数据
func (h *WarPackageHandler) UpdateMetadata(c *gin.Context) {
	var req UpdateMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效: "+err.Error())
		return
	}

	metadata := &models.WarPackageMetadata{
		PackageName: req.PackageName,
		PackageType: req.PackageType,
		Version:     req.Version,
		IsRelease:   req.IsRelease,
		Description: req.Description,
	}

	if err := h.metadataRepo.CreateOrUpdate(metadata); err != nil {
		response.InternalError(c, "更新元数据失败: "+err.Error())
		return
	}

	response.SuccessWithMessage(c, "更新成功", nil)
}

// DeleteMetadata 删除包元数据
func (h *WarPackageHandler) DeleteMetadata(c *gin.Context) {
	packageName := c.Query("package_name")
	if packageName == "" {
		response.BadRequest(c, "请提供包名称")
		return
	}

	if err := h.metadataRepo.Delete(packageName); err != nil {
		response.InternalError(c, "删除元数据失败: "+err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// BatchUpdateMetadata 批量更新元数据
func (h *WarPackageHandler) BatchUpdateMetadata(c *gin.Context) {
	var req struct {
		Packages []UpdateMetadataRequest `json:"packages" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效: "+err.Error())
		return
	}

	for _, pkgReq := range req.Packages {
		metadata := &models.WarPackageMetadata{
			PackageName: pkgReq.PackageName,
			PackageType: pkgReq.PackageType,
			Version:     pkgReq.Version,
			IsRelease:   pkgReq.IsRelease,
			Description: pkgReq.Description,
		}
		if err := h.metadataRepo.CreateOrUpdate(metadata); err != nil {
			response.InternalError(c, "更新失败: "+pkgReq.PackageName+" - "+err.Error())
			return
		}
	}

	response.SuccessWithMessage(c, "批量更新成功", nil)
}

// SetRelease 设置包为发版版本
func (h *WarPackageHandler) SetRelease(c *gin.Context) {
	packageName := c.Query("package_name")
	if packageName == "" {
		response.BadRequest(c, "请提供包名称")
		return
	}

	// 取消其他发版版本（同一类型下只能有一个发版）
	isReleaseStr := c.DefaultQuery("is_release", "true")
	isRelease, _ := strconv.ParseBool(isReleaseStr)

	// 获取当前包的元数据
	metadata, err := h.metadataRepo.GetByPackageName(packageName)
	if err != nil {
		response.InternalError(c, "获取元数据失败: "+err.Error())
		return
	}
	if metadata == nil {
		response.NotFound(c, "元数据不存在")
		return
	}

	// 如果设置为发版，需要先取消同类型的其他发版
	if isRelease {
		allMetadata, err := h.metadataRepo.List()
		if err != nil {
			response.InternalError(c, "获取包列表失败: "+err.Error())
			return
		}
		for _, m := range allMetadata {
			if m.PackageType == metadata.PackageType && m.PackageName != packageName && m.IsRelease {
				m.IsRelease = false
				_ = h.metadataRepo.CreateOrUpdate(&m)
			}
		}
	}

	// 更新当前包的发版状态
	metadata.IsRelease = isRelease
	if err := h.metadataRepo.CreateOrUpdate(metadata); err != nil {
		response.InternalError(c, "更新发版状态失败: "+err.Error())
		return
	}

	response.SuccessWithMessage(c, "设置成功", nil)
}
