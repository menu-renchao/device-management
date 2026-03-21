package handlers

import (
	"fmt"
	"strings"

	"device-management/internal/middleware"
	"device-management/internal/repository"
	"device-management/internal/services"
	"device-management/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService        *services.AuthService
	userRepo           *repository.UserRepository
	notificationService *services.NotificationService
}

func NewAuthHandler(authService *services.AuthService, userRepo *repository.UserRepository, notificationService *services.NotificationService) *AuthHandler {
	return &AuthHandler{
		authService:        authService,
		userRepo:           userRepo,
		notificationService: notificationService,
	}
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Email    string `json:"email"`
	Name     string `json:"name" binding:"required"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

type UpdateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Name = strings.TrimSpace(req.Name)

	if req.Username == "" || req.Password == "" || req.Name == "" {
		response.BadRequest(c, "用户名、密码和姓名为必填项")
		return
	}

	input := services.RegisterInput{
		Username: req.Username,
		Password: req.Password,
		Email:    req.Email,
		Name:     req.Name,
	}

	err := h.authService.Register(input)
	if err != nil {
		switch err {
		case services.ErrUsernameExists:
			response.BadRequest(c, "用户名已存在")
		case services.ErrEmailExists:
			response.BadRequest(c, "邮箱已被注册")
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}

	// 发送通知给所有管理员
	if h.notificationService != nil {
		admins, _ := h.userRepo.GetAdmins()
		for _, admin := range admins {
			if err := h.notificationService.SendNewUserRegister(admin.ID, req.Username, req.Name); err != nil {
				fmt.Printf("[WARN] 发送新用户注册通知给管理员失败: %v\n", err)
			}
		}
	}

	response.CreatedWithMessage(c, "注册成功，请等待管理员审核", nil)
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	req.Username = strings.TrimSpace(req.Username)

	if req.Username == "" || req.Password == "" {
		response.BadRequest(c, "用户名和密码为必填项")
		return
	}

	result, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		switch err {
		case services.ErrUserNotFound, services.ErrInvalidPassword:
			response.Error(c, 401, "用户名或密码错误")
		case services.ErrUserNotApproved:
			response.Forbidden(c, "账号尚未通过审核")
		default:
			response.InternalError(c, "登录失败")
		}
		return
	}

response.Success(c, gin.H{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"user":          result.User,
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if req.RefreshToken == "" {
		response.BadRequest(c, "刷新令牌不能为空")
		return
	}

	result, err := h.authService.Refresh(req.RefreshToken)
	if err != nil {
		switch err {
		case services.ErrInvalidToken:
			response.Unauthorized(c, "刷新令牌无效")
		case services.ErrUserNotFound:
			response.Unauthorized(c, "用户不存在")
		case services.ErrUserNotApproved:
			response.Forbidden(c, "账号尚未通过审核")
		default:
			response.InternalError(c, "刷新令牌失败")
		}
		return
	}

	response.Success(c, gin.H{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"user":          result.User,
	})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	response.SuccessWithMessage(c, "退出成功", nil)
}

// Profile returns the current user's profile
func (h *AuthHandler) Profile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "未授权")
		return
	}

	user, err := h.authService.GetProfile(userID)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	response.Success(c, gin.H{"user": user.ToDict()})
}

// ChangePassword handles password change
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "未授权")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		response.BadRequest(c, "旧密码和新密码为必填项")
		return
	}

	err := h.authService.ChangePassword(userID, req.OldPassword, req.NewPassword)
	if err != nil {
		switch err {
		case services.ErrInvalidPassword:
			response.BadRequest(c, "旧密码不正确")
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}

	response.SuccessWithMessage(c, "密码修改成功", nil)
}

// UpdateProfile handles user profile update
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.Unauthorized(c, "未授权")
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求格式无效")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)

	if req.Name == "" {
		response.BadRequest(c, "姓名不能为空")
		return
	}

	user, err := h.authService.UpdateProfile(userID, req.Name, req.Email)
	if err != nil {
		response.InternalError(c, "更新失败")
		return
	}

	response.SuccessWithMessage(c, "个人信息更新成功", gin.H{"user": user.ToDict()})
}
