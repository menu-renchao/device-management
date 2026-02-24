package handlers

import (
	"strconv"

	"device-management/internal/middleware"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	notificationService *services.NotificationService
}

func NewNotificationHandler(notificationService *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
	}
}

// GetNotifications 获取当前用户的系统通知
func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userID := middleware.GetUserID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	notifications, err := h.notificationService.GetNotifications(userID, limit)
	if err != nil {
		response.InternalError(c, "获取通知列表失败")
		return
	}

	result := make([]map[string]interface{}, len(notifications))
	for i, n := range notifications {
		result[i] = n.ToDict()
	}

	response.Success(c, gin.H{"notifications": result})
}

// GetUnreadCount 获取未读通知数量
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := middleware.GetUserID(c)

	count, err := h.notificationService.GetUnreadCount(userID)
	if err != nil {
		response.InternalError(c, "获取未读数量失败")
		return
	}

	response.Success(c, gin.H{"unreadCount": count})
}

// MarkAsRead 标记通知为已读
func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	userID := middleware.GetUserID(c)
	notificationID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "通知ID无效")
		return
	}

	if err := h.notificationService.MarkAsRead(uint(notificationID), userID); err != nil {
		response.InternalError(c, "标记已读失败")
		return
	}

	response.SuccessWithMessage(c, "已标记为已读", nil)
}

// MarkAllAsRead 标记所有通知为已读
func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID := middleware.GetUserID(c)

	if err := h.notificationService.MarkAllAsRead(userID); err != nil {
		response.InternalError(c, "标记已读失败")
		return
	}

	response.SuccessWithMessage(c, "所有通知已标记为已读", nil)
}
