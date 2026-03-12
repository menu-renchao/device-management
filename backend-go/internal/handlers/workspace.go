package handlers

import (
	"device-management/internal/middleware"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type WorkspaceHandler struct {
	workspaceService *services.WorkspaceService
}

func NewWorkspaceHandler(workspaceService *services.WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{
		workspaceService: workspaceService,
	}
}

func (h *WorkspaceHandler) GetMyRequests(c *gin.Context) {
	data, err := h.workspaceService.GetMyRequests(middleware.GetUserID(c))
	if err != nil {
		response.InternalError(c, "failed to load my borrow requests")
		return
	}
	response.Success(c, data)
}

func (h *WorkspaceHandler) GetMyBorrows(c *gin.Context) {
	data, err := h.workspaceService.GetMyBorrows(middleware.GetUserID(c))
	if err != nil {
		response.InternalError(c, "failed to load my borrowed devices")
		return
	}
	response.Success(c, data)
}

func (h *WorkspaceHandler) GetMyDevices(c *gin.Context) {
	data, err := h.workspaceService.GetMyDevices(middleware.GetUserID(c))
	if err != nil {
		response.InternalError(c, "failed to load my managed devices")
		return
	}
	response.Success(c, data)
}
