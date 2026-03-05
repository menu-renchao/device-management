package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type DBConfigHandler struct {
	dbConfigService *services.DBConfigService
	templateRepo    *repository.DBSQLTemplateRepository
	deviceRepo      *repository.DeviceRepository
	userRepo        *repository.UserRepository
}

func NewDBConfigHandler(
	dbConfigService *services.DBConfigService,
	templateRepo *repository.DBSQLTemplateRepository,
	deviceRepo *repository.DeviceRepository,
	userRepo *repository.UserRepository,
) *DBConfigHandler {
	return &DBConfigHandler{
		dbConfigService: dbConfigService,
		templateRepo:    templateRepo,
		deviceRepo:      deviceRepo,
		userRepo:        userRepo,
	}
}

func (h *DBConfigHandler) GetConnection(c *gin.Context) {
	merchantID := strings.TrimSpace(c.Param("merchantId"))
	if merchantID == "" {
		response.BadRequest(c, "merchantId 不能为空")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if !h.checkDevicePermission(c, merchantID, user) {
		return
	}

	conn, err := h.dbConfigService.GetConnection(merchantID)
	if err != nil {
		response.InternalError(c, "获取连接信息失败")
		return
	}
	if conn == nil {
		response.Success(c, gin.H{"connection": nil})
		return
	}
	response.Success(c, gin.H{"connection": sanitizeConnection(conn)})
}

func (h *DBConfigHandler) UpsertConnection(c *gin.Context) {
	merchantID := strings.TrimSpace(c.Param("merchantId"))
	if merchantID == "" {
		response.BadRequest(c, "merchantId 不能为空")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if !h.checkDevicePermission(c, merchantID, user) {
		return
	}

	var req services.DBConnectionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	conn, err := h.dbConfigService.UpsertConnection(merchantID, req, user.ID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "连接信息保存成功", gin.H{"connection": sanitizeConnection(conn)})
}

func (h *DBConfigHandler) TestConnection(c *gin.Context) {
	merchantID := strings.TrimSpace(c.Param("merchantId"))
	if merchantID == "" {
		response.BadRequest(c, "merchantId 不能为空")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if !h.checkDevicePermission(c, merchantID, user) {
		return
	}

	var req services.DBConnectionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}
	if req.DBType == "" {
		req.DBType = "mysql"
	}
	if err := h.dbConfigService.TestConnectionForMerchant(merchantID, req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "数据库连接测试成功", nil)
}

func (h *DBConfigHandler) ListTemplates(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}

	templates, total, totalPages, err := h.templateRepo.List(page, pageSize, keyword)
	if err != nil {
		response.InternalError(c, "获取模板列表失败")
		return
	}

	userMap := h.loadUserNames(collectTemplateUserIDs(templates))
	items := make([]gin.H, 0, len(templates))
	for _, t := range templates {
		items = append(items, gin.H{
			"id":              t.ID,
			"name":            t.Name,
			"sql_content":     t.SQLContent,
			"need_restart":    t.NeedRestart,
			"remark":          t.Remark,
			"created_by":      t.CreatedBy,
			"updated_by":      t.UpdatedBy,
			"created_at":      t.CreatedAt,
			"updated_at":      t.UpdatedAt,
			"created_by_name": userMap[t.CreatedBy],
			"updated_by_name": userMap[t.UpdatedBy],
			"is_owner":        t.CreatedBy == user.ID,
			"can_edit":        user.Role == "admin" || t.CreatedBy == user.ID,
		})
	}

	response.Success(c, gin.H{
		"items":      items,
		"total":      total,
		"totalPages": totalPages,
		"page":       page,
		"pageSize":   pageSize,
	})
}

func (h *DBConfigHandler) GetTemplate(c *gin.Context) {
	id64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的模板ID")
		return
	}
	template, err := h.templateRepo.GetByID(uint(id64))
	if err != nil {
		response.InternalError(c, "获取模板失败")
		return
	}
	if template == nil {
		response.NotFound(c, "模板不存在")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}

	userMap := h.loadUserNames([]uint{template.CreatedBy, template.UpdatedBy})
	response.Success(c, gin.H{
		"template": gin.H{
			"id":              template.ID,
			"name":            template.Name,
			"sql_content":     template.SQLContent,
			"need_restart":    template.NeedRestart,
			"remark":          template.Remark,
			"created_by":      template.CreatedBy,
			"updated_by":      template.UpdatedBy,
			"created_at":      template.CreatedAt,
			"updated_at":      template.UpdatedAt,
			"created_by_name": userMap[template.CreatedBy],
			"updated_by_name": userMap[template.UpdatedBy],
			"is_owner":        template.CreatedBy == user.ID,
			"can_edit":        user.Role == "admin" || template.CreatedBy == user.ID,
		},
	})
}

func (h *DBConfigHandler) CreateTemplate(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		SQLContent  string `json:"sql_content" binding:"required"`
		NeedRestart bool   `json:"need_restart"`
		Remark      string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.SQLContent = strings.TrimSpace(req.SQLContent)
	if req.Name == "" || req.SQLContent == "" {
		response.BadRequest(c, "模板名称和 SQL 内容不能为空")
		return
	}
	if h.templateRepo.ExistsByName(req.Name, 0) {
		response.BadRequest(c, "模板名称已存在")
		return
	}
	if len(services.SplitSQLStatements(req.SQLContent)) == 0 {
		response.BadRequest(c, "SQL 内容不能为空")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}

	template := &models.DBSQLTemplate{
		Name:        req.Name,
		SQLContent:  req.SQLContent,
		NeedRestart: req.NeedRestart,
		Remark:      strings.TrimSpace(req.Remark),
		CreatedBy:   user.ID,
		UpdatedBy:   user.ID,
	}
	if err := h.templateRepo.Create(template); err != nil {
		response.InternalError(c, "创建模板失败")
		return
	}
	response.SuccessWithMessage(c, "模板创建成功", gin.H{"template": template})
}

func (h *DBConfigHandler) UpdateTemplate(c *gin.Context) {
	id64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的模板ID")
		return
	}

	var req struct {
		Name        string `json:"name" binding:"required"`
		SQLContent  string `json:"sql_content" binding:"required"`
		NeedRestart bool   `json:"need_restart"`
		Remark      string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.SQLContent = strings.TrimSpace(req.SQLContent)
	if req.Name == "" || req.SQLContent == "" {
		response.BadRequest(c, "模板名称和 SQL 内容不能为空")
		return
	}
	if len(services.SplitSQLStatements(req.SQLContent)) == 0 {
		response.BadRequest(c, "SQL 内容不能为空")
		return
	}

	template, err := h.templateRepo.GetByID(uint(id64))
	if err != nil {
		response.InternalError(c, "查询模板失败")
		return
	}
	if template == nil {
		response.NotFound(c, "模板不存在")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if user.Role != "admin" && template.CreatedBy != user.ID {
		response.Forbidden(c, "仅创建者或管理员可编辑模板")
		return
	}
	if h.templateRepo.ExistsByName(req.Name, uint(id64)) {
		response.BadRequest(c, "模板名称已存在")
		return
	}

	template.Name = req.Name
	template.SQLContent = req.SQLContent
	template.NeedRestart = req.NeedRestart
	template.Remark = strings.TrimSpace(req.Remark)
	template.UpdatedBy = user.ID
	if err := h.templateRepo.Update(template); err != nil {
		response.InternalError(c, "更新模板失败")
		return
	}
	response.SuccessWithMessage(c, "模板更新成功", gin.H{"template": template})
}

func (h *DBConfigHandler) DeleteTemplate(c *gin.Context) {
	id64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的模板ID")
		return
	}
	template, err := h.templateRepo.GetByID(uint(id64))
	if err != nil {
		response.InternalError(c, "查询模板失败")
		return
	}
	if template == nil {
		response.NotFound(c, "模板不存在")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if user.Role != "admin" && template.CreatedBy != user.ID {
		response.Forbidden(c, "仅创建者或管理员可删除模板")
		return
	}

	if err := h.templateRepo.Delete(uint(id64)); err != nil {
		response.InternalError(c, "删除模板失败")
		return
	}
	response.SuccessWithMessage(c, "模板删除成功", nil)
}

func (h *DBConfigHandler) Execute(c *gin.Context) {
	var req struct {
		MerchantID   string `json:"merchant_id" binding:"required"`
		TemplateIDs  []uint `json:"template_ids" binding:"required"`
		ForceExecute bool   `json:"force_execute"`
		ForceReason  string `json:"force_reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	req.MerchantID = strings.TrimSpace(req.MerchantID)
	if !h.checkDevicePermission(c, req.MerchantID, user) {
		return
	}

	device, _ := h.deviceRepo.GetScanResultByMerchantID(req.MerchantID)
	deviceType := ""
	if device != nil && device.Type != nil {
		deviceType = *device.Type
	}

	task, items, err := h.dbConfigService.ExecuteTemplates(services.ExecuteTemplatesInput{
		MerchantID:     req.MerchantID,
		TemplateIDs:    req.TemplateIDs,
		ForceExecute:   req.ForceExecute,
		ForceReason:    strings.TrimSpace(req.ForceReason),
		DeviceType:     deviceType,
		ExecutorUserID: user.ID,
		ExecutorRole:   user.Role,
		ClientIP:       c.ClientIP(),
		UserAgent:      c.GetHeader("User-Agent"),
	})
	if err != nil {
		var riskErr *services.RiskSQLBlockedError
		if errors.As(err, &riskErr) {
			c.JSON(400, response.Response{
				Success: false,
				Error:   riskErr.Error(),
				Data: gin.H{
					"risk_detected": true,
					"risks":         riskErr.Risks,
				},
			})
			return
		}
		c.JSON(400, response.Response{
			Success: false,
			Error:   err.Error(),
			Data: gin.H{
				"task": task,
			},
		})
		return
	}

	response.SuccessWithMessage(c, "执行完成", gin.H{
		"task":  task,
		"items": items,
	})
}

func (h *DBConfigHandler) GetExecuteTask(c *gin.Context) {
	taskID := strings.TrimSpace(c.Param("taskId"))
	if taskID == "" {
		response.BadRequest(c, "taskId 不能为空")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}

	task, items, err := h.dbConfigService.GetTaskDetail(taskID)
	if err != nil {
		response.InternalError(c, "查询执行任务失败")
		return
	}
	if task == nil {
		response.NotFound(c, "执行任务不存在")
		return
	}
	if user.Role != "admin" && task.ExecutorUserID != user.ID {
		response.Forbidden(c, "无权查看该任务")
		return
	}

	response.Success(c, gin.H{
		"task":  task,
		"items": items,
	})
}

func (h *DBConfigHandler) ListExecuteHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}

	tasks, total, totalPages, err := h.dbConfigService.ListHistory(page, pageSize, user.ID, user.Role == "admin")
	if err != nil {
		response.InternalError(c, "获取执行历史失败")
		return
	}

	userIDs := make([]uint, 0)
	for _, t := range tasks {
		userIDs = append(userIDs, t.ExecutorUserID)
	}
	userMap := h.loadUserNames(uniqueUserIDs(userIDs))

	items := make([]gin.H, 0, len(tasks))
	for _, t := range tasks {
		items = append(items, gin.H{
			"task_id":          t.TaskID,
			"merchant_id":      t.MerchantID,
			"device_type":      t.DeviceType,
			"executor_user_id": t.ExecutorUserID,
			"executor_name":    userMap[t.ExecutorUserID],
			"executor_role":    t.ExecutorRole,
			"is_forced":        t.IsForced,
			"force_reason":     t.ForceReason,
			"status":           t.Status,
			"total_count":      t.TotalCount,
			"success_count":    t.SuccessCount,
			"failed_count":     t.FailedCount,
			"started_at":       t.StartedAt,
			"finished_at":      t.FinishedAt,
			"duration_ms":      t.DurationMS,
			"created_at":       t.CreatedAt,
		})
	}

	response.Success(c, gin.H{
		"items":      items,
		"total":      total,
		"totalPages": totalPages,
		"page":       page,
		"pageSize":   pageSize,
	})
}

func (h *DBConfigHandler) getCurrentUser(c *gin.Context) (*models.User, bool) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "未授权")
		return nil, false
	}
	user, err := h.userRepo.GetByID(userID)
	if err != nil || user == nil {
		response.Unauthorized(c, "用户不存在")
		return nil, false
	}
	return user, true
}

// checkDevicePermission 返回 true 表示有权限（管理员、负责人、借用人）
func (h *DBConfigHandler) checkDevicePermission(c *gin.Context, merchantID string, user *models.User) bool {
	if user.Role == "admin" {
		return true
	}

	device, err := h.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil || device == nil {
		response.NotFound(c, "设备不存在")
		return false
	}
	if device.OwnerID != nil && *device.OwnerID == user.ID {
		return true
	}

	occupancy, err := h.deviceRepo.GetOccupancyByMerchantID(merchantID)
	if err == nil && occupancy != nil && occupancy.UserID == user.ID && occupancy.EndTime.After(time.Now()) {
		return true
	}

	response.Forbidden(c, "您没有权限操作此设备，只有管理员、负责人或借用人才能访问")
	return false
}

func sanitizeConnection(conn *models.DeviceDBConnection) gin.H {
	return gin.H{
		"id":            conn.ID,
		"merchant_id":   conn.MerchantID,
		"db_type":       conn.DBType,
		"host":          conn.Host,
		"port":          conn.Port,
		"database_name": conn.DatabaseName,
		"username":      conn.Username,
		"password_set":  conn.PasswordEncrypted != "",
		"updated_by":    conn.UpdatedBy,
		"created_at":    conn.CreatedAt,
		"updated_at":    conn.UpdatedAt,
	}
}

func collectTemplateUserIDs(templates []models.DBSQLTemplate) []uint {
	ids := make([]uint, 0, len(templates)*2)
	for _, t := range templates {
		ids = append(ids, t.CreatedBy, t.UpdatedBy)
	}
	return uniqueUserIDs(ids)
}

func uniqueUserIDs(ids []uint) []uint {
	seen := make(map[uint]struct{}, len(ids))
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func (h *DBConfigHandler) loadUserNames(userIDs []uint) map[uint]string {
	result := make(map[uint]string)
	if len(userIDs) == 0 {
		return result
	}
	users, err := h.userRepo.GetUsersByIDs(userIDs)
	if err != nil {
		return result
	}
	for _, u := range users {
		if u.Name != nil && strings.TrimSpace(*u.Name) != "" {
			result[u.ID] = strings.TrimSpace(*u.Name)
		} else {
			result[u.ID] = u.Username
		}
	}
	return result
}
