package handlers

import (
	"errors"
	"strconv"
	"strings"

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FeatureRequestHandler struct {
	featureRepo *repository.FeatureRequestRepository
	userRepo    *repository.UserRepository
}

func NewFeatureRequestHandler(featureRepo *repository.FeatureRequestRepository, userRepo *repository.UserRepository) *FeatureRequestHandler {
	return &FeatureRequestHandler{
		featureRepo: featureRepo,
		userRepo:    userRepo,
	}
}

type createFeatureRequestInput struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type updateFeatureRequestStatusInput struct {
	Status string `json:"status"`
}

func (h *FeatureRequestHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sort := c.DefaultQuery("sort", repository.FeatureRequestSortHot)
	status := c.DefaultQuery("status", "all")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	requests, total, err := h.featureRepo.List(repository.FeatureRequestListOptions{
		Status:   status,
		Sort:     sort,
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.InternalError(c, "获取意见列表失败")
		return
	}

	items, err := h.buildResponseItems(userID, requests)
	if err != nil {
		response.InternalError(c, "组装意见列表失败")
		return
	}

	totalPages := int64(0)
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
	}

	response.Success(c, response.PagedData{
		Items:      items,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	})
}

func (h *FeatureRequestHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var input createFeatureRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "请求参数无效")
		return
	}
	if strings.TrimSpace(input.Title) == "" {
		response.BadRequest(c, "标题不能为空")
		return
	}
	if strings.TrimSpace(input.Content) == "" {
		response.BadRequest(c, "内容不能为空")
		return
	}

	request := &models.FeatureRequest{
		Title:     strings.TrimSpace(input.Title),
		Content:   strings.TrimSpace(input.Content),
		CreatedBy: userID,
	}
	if err := h.featureRepo.Create(request); err != nil {
		response.InternalError(c, "创建意见失败")
		return
	}

	items, err := h.buildResponseItems(userID, []models.FeatureRequest{*request})
	if err != nil || len(items) == 0 {
		response.InternalError(c, "组装意见响应失败")
		return
	}

	response.Created(c, items[0])
}

func (h *FeatureRequestHandler) Like(c *gin.Context) {
	userID := middleware.GetUserID(c)
	requestID, ok := parseFeatureRequestID(c)
	if !ok {
		return
	}

	if _, err := h.featureRepo.GetByID(requestID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "意见不存在")
			return
		}
		response.InternalError(c, "获取意见失败")
		return
	}

	if err := h.featureRepo.AddLike(requestID, userID); err != nil {
		if isDuplicateConstraintError(err) {
			response.SuccessWithMessage(c, "已点赞", nil)
			return
		}
		response.InternalError(c, "点赞失败")
		return
	}

	response.SuccessWithMessage(c, "点赞成功", nil)
}

func (h *FeatureRequestHandler) Unlike(c *gin.Context) {
	userID := middleware.GetUserID(c)
	requestID, ok := parseFeatureRequestID(c)
	if !ok {
		return
	}

	if _, err := h.featureRepo.GetByID(requestID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "意见不存在")
			return
		}
		response.InternalError(c, "获取意见失败")
		return
	}

	if err := h.featureRepo.RemoveLike(requestID, userID); err != nil {
		response.InternalError(c, "取消点赞失败")
		return
	}

	response.SuccessWithMessage(c, "已取消点赞", nil)
}

func (h *FeatureRequestHandler) UpdateStatus(c *gin.Context) {
	requestID, ok := parseFeatureRequestID(c)
	if !ok {
		return
	}

	var input updateFeatureRequestStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "请求参数无效")
		return
	}
	if !isValidFeatureRequestStatus(input.Status) {
		response.BadRequest(c, "状态无效")
		return
	}

	request, err := h.featureRepo.GetByID(requestID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFound(c, "意见不存在")
			return
		}
		response.InternalError(c, "获取意见失败")
		return
	}

	if err := h.featureRepo.UpdateStatus(requestID, input.Status); err != nil {
		response.InternalError(c, "更新状态失败")
		return
	}
	request.Status = input.Status

	items, err := h.buildResponseItems(middleware.GetUserID(c), []models.FeatureRequest{*request})
	if err != nil || len(items) == 0 {
		response.InternalError(c, "组装意见响应失败")
		return
	}

	response.Success(c, items[0])
}

func (h *FeatureRequestHandler) buildResponseItems(userID uint, requests []models.FeatureRequest) ([]map[string]interface{}, error) {
	items := make([]map[string]interface{}, 0, len(requests))
	if len(requests) == 0 {
		return items, nil
	}

	authorIDs := make([]uint, 0, len(requests))
	requestIDs := make([]uint, 0, len(requests))
	for _, request := range requests {
		authorIDs = append(authorIDs, request.CreatedBy)
		requestIDs = append(requestIDs, request.ID)
	}

	users, err := h.userRepo.GetUsersByIDs(authorIDs)
	if err != nil {
		return nil, err
	}
	userByID := make(map[uint]models.User, len(users))
	for _, user := range users {
		userByID[user.ID] = user
	}

	likedByMe, err := h.featureRepo.GetLikedRequestIDs(userID, requestIDs)
	if err != nil {
		return nil, err
	}

	for _, request := range requests {
		author := userByID[request.CreatedBy]
		displayName := author.Username
		if author.Name != nil && strings.TrimSpace(*author.Name) != "" {
			displayName = strings.TrimSpace(*author.Name)
		}

		items = append(items, map[string]interface{}{
			"id":          request.ID,
			"title":       request.Title,
			"content":     request.Content,
			"status":      request.Status,
			"created_by":  request.CreatedBy,
			"created_at":  request.CreatedAt,
			"updated_at":  request.UpdatedAt,
			"like_count":  request.LikeCount,
			"liked_by_me": likedByMe[request.ID],
			"author": map[string]interface{}{
				"id":       author.ID,
				"username": author.Username,
				"name":     author.Name,
				"display":  displayName,
			},
		})
	}

	return items, nil
}

func parseFeatureRequestID(c *gin.Context) (uint, bool) {
	requestID64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "意见ID无效")
		return 0, false
	}
	return uint(requestID64), true
}

func isValidFeatureRequestStatus(status string) bool {
	switch status {
	case models.FeatureRequestStatusPending,
		models.FeatureRequestStatusPlanned,
		models.FeatureRequestStatusCompleted,
		models.FeatureRequestStatusRejected:
		return true
	default:
		return false
	}
}

func isDuplicateConstraintError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
