package logger

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	// Default logger instance
	defaultLogger *slog.Logger
)

// Config 日志配置
type Config struct {
	Level      string // debug, info, warn, error
	Format     string // json, text
	Output     string // stdout, file, both
	FilePath   string // 日志文件路径
	MaxSize    int    // 单个日志文件最大大小(MB)
	MaxBackups int    // 保留的旧日志文件最大数量
	MaxAge     int    // 保留旧日志文件的最大天数
	Compress   bool   // 是否压缩旧日志文件
}

// DefaultConfig 返回默认配置
func DefaultConfig() Config {
	return Config{
		Level:      "info",
		Format:     "json",
		Output:     "both",
		FilePath:   "logs/app.log",
		MaxSize:    100,
		MaxBackups: 10,
		MaxAge:     30,
		Compress:   true,
	}
}

// Init 初始化日志系统
func Init(cfg Config) error {
	// 解析日志级别
	level := parseLevel(cfg.Level)

	// 创建日志输出
	var writers []io.Writer

	switch cfg.Output {
	case "stdout":
		writers = append(writers, os.Stdout)
	case "file":
		fileWriter, err := createFileWriter(cfg)
		if err != nil {
			return err
		}
		writers = append(writers, fileWriter)
	case "both":
		writers = append(writers, os.Stdout)
		fileWriter, err := createFileWriter(cfg)
		if err != nil {
			return err
		}
		writers = append(writers, fileWriter)
	}

	// 创建多输出 writer
	multiWriter := io.MultiWriter(writers...)

	// 创建 logger
	opts := &slog.HandlerOptions{
		Level: level,
	}

	var handler slog.Handler
	if cfg.Format == "json" {
		handler = slog.NewJSONHandler(multiWriter, opts)
	} else {
		handler = slog.NewTextHandler(multiWriter, opts)
	}

	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)

	Info("logger initialized",
		"level", cfg.Level,
		"format", cfg.Format,
		"output", cfg.Output,
	)

	return nil
}

// createFileWriter 创建文件写入器（带日志轮转）
func createFileWriter(cfg Config) (io.Writer, error) {
	// 确保日志目录存在
	logDir := filepath.Dir(cfg.FilePath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, err
	}

	return &lumberjack.Logger{
		Filename:   cfg.FilePath,
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
		LocalTime:  true,
	}, nil
}

// parseLevel 解析日志级别
func parseLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// ============ 便捷日志函数 ============

// Debug debug 级别日志
func Debug(msg string, args ...any) {
	slog.Debug(msg, args...)
}

// Info info 级别日志
func Info(msg string, args ...any) {
	slog.Info(msg, args...)
}

// Warn warn 级别日志
func Warn(msg string, args ...any) {
	slog.Warn(msg, args...)
}

// Error error 级别日志
func Error(msg string, args ...any) {
	slog.Error(msg, args...)
}

// Fatal fatal 级别日志，打印后退出
func Fatal(msg string, args ...any) {
	slog.Error(msg, args...)
	os.Exit(1)
}

// ============ 请求追踪相关 ============

// RequestIDKey 请求ID上下文键
type contextKey string

const RequestIDKey contextKey = "request_id"

// WithRequestID 添加请求ID到日志参数
func WithRequestID(requestID string) any {
	return slog.String(string(RequestIDKey), requestID)
}

// ============ 预定义的日志消息 ============

// LogRequest 记录HTTP请求
func LogRequest(method, path, ip string, duration time.Duration, status int, requestID string) {
	args := []any{
		"method", method,
		"path", path,
		"ip", ip,
		"status", status,
		"duration_ms", duration.Milliseconds(),
	}
	if requestID != "" {
		args = append(args, WithRequestID(requestID))
	}
	Info("http request", args...)
}

// LogDBError 记录数据库错误
func LogDBError(operation string, err error, args ...any) {
	allArgs := append([]any{"operation", operation, "error", err.Error()}, args...)
	Error("database error", allArgs...)
}

// LogDBQuery 记录数据库查询（debug级别）
func LogDBQuery(query string, args ...any) {
	allArgs := append([]any{"query", query}, args...)
	Debug("database query", allArgs...)
}
