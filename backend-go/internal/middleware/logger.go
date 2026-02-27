package middleware

import (
	"time"

	"device-management/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	// RequestIDHeader 请求ID在HTTP头中的字段名
	RequestIDHeader = "X-Request-ID"
	// RequestIDContextKey 请求ID在 Gin 上下文中的键
	RequestIDContextKey = "request_id"
)

// RequestIDMiddleware 生成并设置请求ID
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试从请求头获取 request_id
		requestID := c.GetHeader(RequestIDHeader)

		// 如果没有，生成一个新的
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// 设置到 Gin 上下文
		c.Set(RequestIDContextKey, requestID)

		// 设置响应头
		c.Header(RequestIDHeader, requestID)

		c.Next()
	}
}

// GetRequestID 从 Gin 上下文中获取请求ID
func GetRequestID(c *gin.Context) string {
	if requestID, exists := c.Get(RequestIDContextKey); exists {
		if id, ok := requestID.(string); ok {
			return id
		}
	}
	return ""
}

// LoggerMiddleware 自定义请求日志中间件
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 计算请求耗时
		duration := time.Since(startTime)

		// 记录请求日志
		requestID := GetRequestID(c)
		logger.LogRequest(
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			duration,
			c.Writer.Status(),
			requestID,
		)

		// 如果有错误，记录错误日志
		if len(c.Errors) > 0 {
			logger.Error("request errors",
				"request_id", requestID,
				"errors", c.Errors.String(),
			)
		}
	}
}

// RecoveryMiddleware 自定义恢复中间件，记录 panic
func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				requestID := GetRequestID(c)
				logger.Error("panic recovered",
					"request_id", requestID,
					"error", err,
					"path", c.Request.URL.Path,
					"method", c.Request.Method,
				)
				c.JSON(500, gin.H{
					"error":   "Internal Server Error",
					"code":    500,
					"message": "服务器内部错误",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
