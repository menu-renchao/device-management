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

type BorrowHandler struct {
	borrowService *services.BorrowService
	userRepo      *repository.UserRepository
}

func NewBorrowHandler(borrowService *services.BorrowService, userRepo *repository.UserRepository) *BorrowHandler {
	return &BorrowHandler{
		borrowService: borrowService,
		userRepo:      userRepo,
	}
}

func (h *BorrowHandler) Submit(c *gin.Context) {
	var req struct {
		AssetType  string `json:"asset_type" binding:"required"`
		AssetID    uint   `json:"asset_id"`
		MerchantID string `json:"merchant_id"`
		Purpose    string `json:"purpose"`
		EndTime    string `json:"end_time" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "request body is invalid")
		return
	}

	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		response.BadRequest(c, "end_time must be RFC3339")
		return
	}

	request, err := h.borrowService.Submit(services.BorrowSubmitInput{
		AssetType:   strings.TrimSpace(req.AssetType),
		AssetID:     req.AssetID,
		MerchantID:  strings.TrimSpace(req.MerchantID),
		RequesterID: middleware.GetUserID(c),
		Purpose:     strings.TrimSpace(req.Purpose),
		EndTime:     endTime,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrBorrowAssetUnavailable):
			response.BadRequest(c, "asset is unavailable")
		case errors.Is(err, services.ErrBorrowRequestExists):
			response.BadRequest(c, "pending borrow request already exists")
		default:
			response.InternalError(c, err.Error())
		}
		return
	}

	response.SuccessWithMessage(c, "borrow request submitted", gin.H{
		"request": serializeBorrowRequest(request),
	})
}

func (h *BorrowHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.userRepo.GetByID(userID)
	if err != nil || user == nil {
		response.Unauthorized(c, "user not found")
		return
	}

	scope := strings.TrimSpace(c.DefaultQuery("scope", "mine"))
	status := strings.TrimSpace(c.DefaultQuery("status", "all"))

	var requests []models.BorrowRequest
	switch scope {
	case "mine":
		requests, err = h.borrowService.ListByRequester(userID)
	case "approvals":
		if user.Role == "admin" {
			requests, err = h.borrowService.List(repository.BorrowRequestListOptions{Status: status})
		} else {
			requests, err = h.borrowService.ListPendingByApprover(userID)
			if err == nil && status != "" && status != "all" {
				filtered := make([]models.BorrowRequest, 0, len(requests))
				for _, item := range requests {
					if item.Status == status {
						filtered = append(filtered, item)
					}
				}
				requests = filtered
			}
		}
	case "all":
		if user.Role != "admin" {
			response.Forbidden(c, "permission denied")
			return
		}
		requests, err = h.borrowService.List(repository.BorrowRequestListOptions{Status: status})
	default:
		response.BadRequest(c, "unsupported scope")
		return
	}
	if err != nil {
		response.InternalError(c, "failed to load borrow requests")
		return
	}

	items := make([]gin.H, 0, len(requests))
	for _, item := range requests {
		items = append(items, serializeBorrowRequest(&item))
	}

	response.Success(c, gin.H{"requests": items})
}

func (h *BorrowHandler) Approve(c *gin.Context) {
	requestID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid request id")
		return
	}

	request, err := h.borrowService.Approve(uint(requestID), middleware.GetUserID(c))
	if err != nil {
		switch {
		case errors.Is(err, services.ErrBorrowPermissionDenied):
			response.Forbidden(c, "permission denied")
		case errors.Is(err, services.ErrBorrowRequestProcessed), errors.Is(err, services.ErrBorrowAssetUnavailable):
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, err.Error())
		}
		return
	}

	response.SuccessWithMessage(c, "borrow request approved", gin.H{
		"request": serializeBorrowRequest(request),
	})
}

func (h *BorrowHandler) Reject(c *gin.Context) {
	requestID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "invalid request id")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	request, err := h.borrowService.Reject(uint(requestID), middleware.GetUserID(c), strings.TrimSpace(req.Reason))
	if err != nil {
		switch {
		case errors.Is(err, services.ErrBorrowPermissionDenied):
			response.Forbidden(c, "permission denied")
		case errors.Is(err, services.ErrBorrowRequestProcessed):
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, err.Error())
		}
		return
	}

	response.SuccessWithMessage(c, "borrow request rejected", gin.H{
		"request": serializeBorrowRequest(request),
	})
}

func serializeBorrowRequest(req *models.BorrowRequest) gin.H {
	requesterName := ""
	if req.Requester != nil {
		requesterName = req.Requester.Username
		if req.Requester.Name != nil && strings.TrimSpace(*req.Requester.Name) != "" {
			requesterName = strings.TrimSpace(*req.Requester.Name)
		}
	}

	approverName := ""
	if req.Approver != nil {
		approverName = req.Approver.Username
		if req.Approver.Name != nil && strings.TrimSpace(*req.Approver.Name) != "" {
			approverName = strings.TrimSpace(*req.Approver.Name)
		}
	}

	deviceName := "unknown"
	ip := ""
	if req.AssetType == models.BorrowAssetTypePOS && req.ScanResult != nil {
		ip = req.ScanResult.IP
		if req.ScanResult.Name != nil && strings.TrimSpace(*req.ScanResult.Name) != "" {
			deviceName = strings.TrimSpace(*req.ScanResult.Name)
		}
	}
	if req.AssetType == models.BorrowAssetTypeMobile && req.Device != nil {
		deviceName = req.Device.Name
	}

	item := gin.H{
		"id":               req.ID,
		"asset_type":       req.AssetType,
		"asset_id":         req.AssetID,
		"merchant_id":      req.MerchantID,
		"requester_id":     req.RequesterID,
		"requester_name":   requesterName,
		"approver_user_id": req.ApproverUserID,
		"approver_name":    approverName,
		"status":           req.Status,
		"purpose":          req.Purpose,
		"rejection_reason": req.RejectionReason,
		"device_name":      deviceName,
		"ip":               ip,
		"end_time":         req.EndTime.Format(time.RFC3339),
		"created_at":       req.CreatedAt.Format(time.RFC3339),
		"processed_at":     nil,
	}
	if req.ProcessedAt != nil {
		item["processed_at"] = req.ProcessedAt.Format(time.RFC3339)
	}
	return item
}
