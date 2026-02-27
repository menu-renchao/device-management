package logger

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm/logger"
)

// GormLogger GORM 日志适配器
type GormLogger struct {
	LogLevel logger.LogLevel
}

// NewGormLogger 创建 GORM 日志实例
func NewGormLogger(level logger.LogLevel) logger.Interface {
	return &GormLogger{
		LogLevel: level,
	}
}

// LogMode 设置日志级别
func (l *GormLogger) LogMode(level logger.LogLevel) logger.Interface {
	return &GormLogger{
		LogLevel: level,
	}
}

// Info 记录 info 级别日志
func (l *GormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Info {
		slog.Info(msg, "data", data)
	}
}

// Warn 记录 warn 级别日志
func (l *GormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Warn {
		slog.Warn(msg, "data", data)
	}
}

// Error 记录 error 级别日志
func (l *GormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Error {
		slog.Error(msg, "data", data)
	}
}

// Trace 记录 SQL 查询
func (l *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.LogLevel <= logger.Silent {
		return
	}

	// 获取查询耗时
	elapsed := time.Since(begin)

	// 获取 SQL 和行数
	sql, rows := fc()

	// 根据错误和耗时选择日志级别
	switch {
	case err != nil && l.LogLevel >= logger.Error:
		// 有错误
		slog.Error("gorm query error",
			"error", err.Error(),
			"sql", sql,
			"rows", rows,
			"duration_ms", elapsed.Milliseconds(),
		)
	case elapsed > 200*time.Millisecond && l.LogLevel >= logger.Warn:
		// 慢查询 (>200ms)
		slog.Warn("gorm slow query",
			"sql", sql,
			"rows", rows,
			"duration_ms", elapsed.Milliseconds(),
		)
	case l.LogLevel >= logger.Info:
		// 正常查询
		slog.Debug("gorm query",
			"sql", sql,
			"rows", rows,
			"duration_ms", elapsed.Milliseconds(),
		)
	}
}
