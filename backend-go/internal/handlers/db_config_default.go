package handlers

import (
	"strings"

	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

func (h *DBConfigHandler) GetDefaultConnection(c *gin.Context) {
	merchantID := strings.TrimSpace(c.Query("merchant_id"))
	if merchantID == "" {
		response.BadRequest(c, "merchant_id is required")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if !h.authorizeDeviceAction(c, merchantID, user, services.ActionDBRead) {
		return
	}

	conn, err := h.dbConfigService.GetDefaultConnectionInfo(merchantID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"connection": conn})
}

func (h *DBConfigHandler) TestDefaultConnection(c *gin.Context) {
	var req struct {
		MerchantID string `json:"merchant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request body")
		return
	}

	merchantID := strings.TrimSpace(req.MerchantID)
	if merchantID == "" {
		response.BadRequest(c, "merchant_id is required")
		return
	}

	user, ok := h.getCurrentUser(c)
	if !ok {
		return
	}
	if !h.authorizeDeviceAction(c, merchantID, user, services.ActionDBWrite) {
		return
	}

	if err := h.dbConfigService.TestConnectionForMerchant(merchantID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "default database connection test succeeded", nil)
}
