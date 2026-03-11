package main

import (
	"context"
	"fmt"
	"time"

	"device-management/internal/config"
	"device-management/internal/handlers"
	"device-management/internal/logger"
	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func main() {
	// Initialize config
	if err := config.Init(); err != nil {
		fmt.Printf("Failed to initialize config: %v\n", err)
		return
	}

	// Initialize logger
	logConfig := logger.Config{
		Level:      config.AppConfig.Log.Level,
		Format:     config.AppConfig.Log.Format,
		Output:     config.AppConfig.Log.Output,
		FilePath:   config.AppConfig.Log.FilePath,
		MaxSize:    config.AppConfig.Log.MaxSize,
		MaxBackups: config.AppConfig.Log.MaxBackups,
		MaxAge:     config.AppConfig.Log.MaxAge,
		Compress:   config.AppConfig.Log.Compress,
	}
	if err := logger.Init(logConfig); err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		return
	}

	// Set Gin mode
	gin.SetMode(config.AppConfig.Server.Mode)

	// Initialize database with custom logger
	dbLogger := logger.NewGormLogger(gormlogger.Silent)
	if config.AppConfig.Log.Level == "debug" {
		dbLogger = logger.NewGormLogger(gormlogger.Info)
	}
	db, err := gorm.Open(sqlite.Open(config.AppConfig.Database.Path), &gorm.Config{
		Logger: dbLogger,
	})
	if err != nil {
		logger.Fatal("Failed to connect to database", "error", err)
	}

	// Auto migrate
	if err := db.AutoMigrate(
		&models.User{},
		&models.ScanResult{},
		&models.DeviceProperty{},
		&models.DeviceOccupancy{},
		&models.DeviceClaim{},
		&models.DeviceBorrowRequest{},
		&models.MobileDevice{},
		&models.MobileBorrowRequest{},
		&models.ScanSession{},
		&models.AutoScanConfig{},
		&models.ScanJobLog{},
		&models.FileConfig{},
		&models.DeviceDBConnection{},
		&models.DBSQLTemplate{},
		&models.DBSQLExecuteTask{},
		&models.DBSQLExecuteTaskItem{},
		&models.SystemConfig{},
		&models.SystemNotification{},
		&models.WarPackageMetadata{},
	); err != nil {
		logger.Fatal("Failed to migrate database", "error", err)
	}
	backfillTemplateNeedRestart(db)

	// Create default admin if not exists
	var adminCount int64
	db.Model(&models.User{}).Where("username = ?", "admin").Count(&adminCount)
	if adminCount == 0 {
		adminName := "admin"
		adminEmail := "admin@example.com"
		admin := &models.User{
			Username: "admin",
			Email:    &adminEmail,
			Name:     &adminName,
			Role:     "admin",
			Status:   "approved",
		}
		if err := admin.SetPassword("admin123"); err != nil {
			logger.Fatal("Failed to set admin password", "error", err)
		}
		if err := db.Create(admin).Error; err != nil {
			logger.Fatal("Failed to create admin", "error", err)
		}
		logger.Info("Default admin user created")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	mobileRepo := repository.NewMobileRepository(db)
	fileConfigRepo := repository.NewFileConfigRepository(db)
	systemConfigRepo := repository.NewSystemConfigRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	warPackageRepo := repository.NewWarPackageRepository(db)
	dbConnectionRepo := repository.NewDeviceDBConnectionRepository(db)
	dbSQLTemplateRepo := repository.NewDBSQLTemplateRepository(db)
	dbSQLTaskRepo := repository.NewDBSQLExecuteTaskRepository(db)
	autoScanConfigRepo := repository.NewAutoScanConfigRepository(db)
	scanJobLogRepo := repository.NewScanJobLogRepository(db)

	// Initialize services
	authService := services.NewAuthService(userRepo)
	scanService := services.NewScanService()
	linuxService := services.NewLinuxService()
	licenseService := services.NewLicenseService()
	dbBackupService := services.NewDBBackupService()
	warDownloadService := services.NewWarDownloadService(systemConfigRepo, warPackageRepo)
	notificationService := services.NewNotificationService(notificationRepo)
	dbConfigService := services.NewDBConfigService(dbConnectionRepo, dbSQLTemplateRepo, dbSQLTaskRepo)
	autoScanScheduler := services.NewAutoScanScheduler(scanService, autoScanConfigRepo, scanJobLogRepo, deviceRepo, time.Minute)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, userRepo, notificationService)
	adminHandler := handlers.NewAdminHandler(userRepo, deviceRepo)
	deviceHandler := handlers.NewDeviceHandler(deviceRepo, userRepo, notificationService, licenseService, dbBackupService, linuxService)
	mobileHandler := handlers.NewMobileHandler(mobileRepo, userRepo, notificationService)
	scanHandler := handlers.NewScanHandler(scanService, deviceRepo, autoScanConfigRepo, scanJobLogRepo, autoScanScheduler)
	linuxHandler := handlers.NewLinuxHandler(linuxService, fileConfigRepo, deviceRepo, userRepo)
	fileConfigHandler := handlers.NewFileConfigHandler(fileConfigRepo, linuxService)
	warDownloadHandler := handlers.NewWarDownloadHandler(warDownloadService, systemConfigRepo, warPackageRepo)
	warPackageHandler := handlers.NewWarPackageHandler(warPackageRepo)
	workspaceHandler := handlers.NewWorkspaceHandler(deviceRepo, mobileRepo, userRepo)
	notificationHandler := handlers.NewNotificationHandler(notificationService)
	dbConfigHandler := handlers.NewDBConfigHandler(dbConfigService, dbSQLTemplateRepo, deviceRepo, userRepo)

	// Create Gin router
	router := gin.New()
	router.Use(middleware.CORS())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.LoggerMiddleware())
	router.Use(middleware.RecoveryMiddleware())

	// API routes
	api := router.Group("/api")
	{
		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/logout", middleware.Auth(), authHandler.Logout)
			auth.GET("/profile", middleware.Auth(), authHandler.Profile)
			auth.PUT("/profile", middleware.Auth(), authHandler.UpdateProfile)
			auth.PUT("/password", middleware.Auth(), authHandler.ChangePassword)
		}

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(middleware.Auth())
		admin.Use(middleware.AdminOnly(userRepo))
		{
			admin.GET("/users", adminHandler.GetUsers)
			admin.POST("/users", adminHandler.CreateUser)
			admin.PUT("/users/:id", adminHandler.UpdateUser)
			admin.PUT("/users/:id/approve", adminHandler.ApproveUser)
			admin.PUT("/users/:id/reject", adminHandler.RejectUser)
			admin.PUT("/users/:id/reset-password", adminHandler.ResetUserPassword)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.GET("/device-properties", adminHandler.GetDeviceProperties)
			admin.PUT("/device-properties", adminHandler.SetDeviceProperty)
			admin.DELETE("/device-properties/:merchant_id", adminHandler.DeleteDeviceProperty)
		}

		// Device routes
		device := api.Group("/device")
		device.Use(middleware.Auth())
		{
			device.GET("/occupancy", deviceHandler.GetOccupancies)
			device.PUT("/occupancy", middleware.AdminOnly(userRepo), deviceHandler.SetOccupancy) // 管理员直接借用
			device.DELETE("/occupancy/:merchant_id", deviceHandler.ReleaseOccupancy)
			device.POST("/claim", deviceHandler.SubmitClaim)
			device.GET("/claims", deviceHandler.GetClaims)
			device.POST("/claim/:id/approve", middleware.AdminOnly(userRepo), deviceHandler.ApproveClaim)
			device.POST("/claim/:id/reject", middleware.AdminOnly(userRepo), deviceHandler.RejectClaim)
			device.DELETE("/:merchant_id/owner", middleware.AdminOnly(userRepo), deviceHandler.ResetOwner)
			device.DELETE("/:merchant_id", middleware.AdminOnly(userRepo), deviceHandler.DeleteDevice)
			device.POST("/license/backup", deviceHandler.BackupLicense)
			device.POST("/license/import", deviceHandler.ImportLicense)
			device.POST("/db/backup", deviceHandler.BackupDatabase)
			device.GET("/db/backups", deviceHandler.ListDatabaseBackups)
			device.GET("/db/backups/download", deviceHandler.DownloadDatabaseBackup)
			device.DELETE("/db/backups", deviceHandler.DeleteDatabaseBackup)
			device.POST("/db/restore/server", deviceHandler.RestoreDatabaseFromServer)
			device.POST("/db/restore/upload", deviceHandler.RestoreDatabaseFromUpload)

			// POS设备借用申请
			device.POST("/borrow-requests", deviceHandler.SubmitBorrowRequest)
			device.GET("/borrow-requests", deviceHandler.GetBorrowRequests)
			device.POST("/borrow-requests/:id/approve", deviceHandler.ApproveBorrowRequest)
			device.POST("/borrow-requests/:id/reject", deviceHandler.RejectBorrowRequest)
		}

		// Mobile device routes
		mobile := api.Group("/mobile")
		mobile.Use(middleware.Auth())
		{
			mobile.GET("/devices", mobileHandler.GetDevices)
			mobile.POST("/devices", middleware.AdminOnly(userRepo), mobileHandler.CreateDevice)
			mobile.PUT("/devices/:id", middleware.AdminOnly(userRepo), mobileHandler.UpdateDevice)
			mobile.DELETE("/devices/:id", middleware.AdminOnly(userRepo), mobileHandler.DeleteDevice)
			mobile.POST("/devices/:id/upload", middleware.AdminOnly(userRepo), mobileHandler.UploadImage)
			mobile.PUT("/devices/:id/occupy", middleware.AdminOnly(userRepo), mobileHandler.OccupyDevice) // 管理员直接借用
			mobile.PUT("/devices/:id/release", mobileHandler.ReleaseDevice)
			mobile.PUT("/devices/:id/owner", middleware.AdminOnly(userRepo), mobileHandler.SetDeviceOwner) // 设置负责人

			// 借用申请
			mobile.POST("/borrow-requests", mobileHandler.SubmitBorrowRequest)              // 提交借用申请
			mobile.GET("/borrow-requests", mobileHandler.GetBorrowRequests)                 // 获取借用申请列表
			mobile.POST("/borrow-requests/:id/approve", mobileHandler.ApproveBorrowRequest) // 审核通过
			mobile.POST("/borrow-requests/:id/reject", mobileHandler.RejectBorrowRequest)   // 审核拒绝
		}

		// Scan routes (no auth required for basic scanning)
		scan := api.Group("/scan")
		{
			scan.GET("/ips", scanHandler.GetLocalIPs)
			scan.POST("/start", scanHandler.StartScan)
			scan.GET("/status", scanHandler.GetScanStatus)
			scan.POST("/stop", scanHandler.StopScan)
			scan.GET("/device/:ip/details", scanHandler.GetDeviceDetails)
			scan.GET("/auto-config", scanHandler.GetAutoScanConfig)
			scan.PUT("/auto-config", scanHandler.UpdateAutoScanConfig)
			scan.GET("/jobs", scanHandler.ListScanJobs)
			scan.POST("/auto-run", scanHandler.RunAutoScanNow)
		}

		// Linux device management routes
		linux := api.Group("/linux")
		linux.Use(middleware.Auth())
		{
			// Connection management
			linux.POST("/connect", linuxHandler.Connect)
			linux.POST("/disconnect", linuxHandler.Disconnect)
			linux.GET("/status", linuxHandler.GetStatus)
			linux.POST("/test-connection", linuxHandler.TestConnection)

			// POS control
			linux.POST("/pos/stop", linuxHandler.StopPOS)
			linux.POST("/pos/start", linuxHandler.StartPOS)
			linux.POST("/pos/restart", linuxHandler.RestartPOS)
			linux.POST("/tomcat/restart", linuxHandler.RestartTomcat)

			// File upload
			linux.POST("/upload/war", linuxHandler.UploadWAR)
			linux.GET("/upload/progress/:taskId", linuxHandler.GetUploadProgress)

			// Backup management
			linux.POST("/backup/create", linuxHandler.CreateBackup)
			linux.GET("/backup/list", linuxHandler.ListBackups)
			linux.POST("/backup/restore", linuxHandler.RestoreBackup)

			// Log management
			linux.GET("/logs/list", linuxHandler.ListLogs)
			linux.GET("/logs/download", linuxHandler.DownloadLog)
			linux.GET("/logs/content", linuxHandler.ReadLogContent)

			// Version info
			linux.GET("/version/app", linuxHandler.GetAppVersion)
			linux.GET("/version/cloud", linuxHandler.GetCloudVersion)

			// MD5 checksum
			linux.POST("/md5/remote", linuxHandler.GetRemoteMD5)
			linux.POST("/md5/local", linuxHandler.CalculateLocalMD5)

			// Config management
			linux.GET("/config", linuxHandler.GetConfig)
			linux.GET("/config/list", linuxHandler.ListConfigFiles)
			linux.POST("/config", linuxHandler.UpdateConfig)

			// Upgrade package management
			linux.GET("/upgrade/package/scan", linuxHandler.ScanUpgradePackages)
			linux.POST("/upgrade/package/upload", linuxHandler.UploadUpgradePackage)

			// SSE upgrade progress
			linux.POST("/upgrade/task", linuxHandler.StartUpgradeTask)
			linux.GET("/upgrade/stream/:taskId", linuxHandler.StreamUpgradeProgress)
			linux.GET("/upgrade/status/:taskId", linuxHandler.GetUpgradeTaskStatus)

			// System info
			linux.GET("/system/info", linuxHandler.GetSystemInfo)

			// File config management
			linux.GET("/file-configs", fileConfigHandler.GetFileConfigs)
			linux.GET("/file-configs/:id", fileConfigHandler.GetFileConfig)
			linux.POST("/file-configs", middleware.AdminOnly(userRepo), fileConfigHandler.CreateFileConfig)
			linux.PUT("/file-configs/:id", middleware.AdminOnly(userRepo), fileConfigHandler.UpdateFileConfig)
			linux.DELETE("/file-configs/:id", middleware.AdminOnly(userRepo), fileConfigHandler.DeleteFileConfig)
			linux.PUT("/file-configs/:id/toggle", middleware.AdminOnly(userRepo), fileConfigHandler.ToggleFileConfig)
			linux.POST("/file-configs/execute", fileConfigHandler.ExecuteFileConfigs)

			// WAR download management
			linux.GET("/war/list", warDownloadHandler.ListPackages)
			linux.POST("/war/download", warDownloadHandler.StartDownload)
			linux.GET("/war/download/progress/:taskId", warDownloadHandler.GetDownloadProgress)
			linux.POST("/war/download/cancel/:taskId", warDownloadHandler.CancelDownload)
			linux.POST("/war/upload-local", warDownloadHandler.UploadLocalFile)
			linux.GET("/war/file/:name", warDownloadHandler.DownloadPackage)
			linux.GET("/war/md5/:name", warDownloadHandler.GetPackageMD5)
			linux.DELETE("/war/:name", warDownloadHandler.DeletePackage)
			linux.GET("/war/config", warDownloadHandler.GetDownloadConfig)
			linux.PUT("/war/config", middleware.AdminOnly(userRepo), warDownloadHandler.UpdateDownloadConfig)

			// WAR package metadata management
			linux.GET("/war/metadata/list", warPackageHandler.ListMetadata)
			linux.GET("/war/metadata", warPackageHandler.GetMetadata)
			linux.PUT("/war/metadata", warPackageHandler.UpdateMetadata)
			linux.POST("/war/metadata/batch", warPackageHandler.BatchUpdateMetadata)
			linux.POST("/war/metadata/release", warPackageHandler.SetRelease)
			linux.DELETE("/war/metadata", warPackageHandler.DeleteMetadata)
		}

		// Database config routes
		dbConfig := api.Group("/db-config")
		dbConfig.Use(middleware.Auth())
		{
			dbConfig.GET("/connections/:merchantId", dbConfigHandler.GetConnection)
			dbConfig.PUT("/connections/:merchantId", dbConfigHandler.UpsertConnection)
			dbConfig.POST("/connections/:merchantId/test", dbConfigHandler.TestConnection)

			dbConfig.GET("/templates", dbConfigHandler.ListTemplates)
			dbConfig.GET("/templates/:id", dbConfigHandler.GetTemplate)
			dbConfig.POST("/templates", dbConfigHandler.CreateTemplate)
			dbConfig.PUT("/templates/:id", dbConfigHandler.UpdateTemplate)
			dbConfig.DELETE("/templates/:id", dbConfigHandler.DeleteTemplate)

			dbConfig.POST("/execute", dbConfigHandler.Execute)
			dbConfig.GET("/execute/history", dbConfigHandler.ListExecuteHistory)
			dbConfig.GET("/execute/:taskId", dbConfigHandler.GetExecuteTask)
		}

		// WebSocket routes
		router.GET("/ws/linux/logs", middleware.Auth(), linuxHandler.RealtimeLog)

		// Devices list (main endpoint for frontend)
		api.GET("/devices", middleware.Auth(), deviceHandler.GetDevices)
		api.GET("/devices/filter-options", middleware.Auth(), deviceHandler.GetFilterOptions)

		// Workspace routes
		workspace := api.Group("/workspace")
		workspace.Use(middleware.Auth())
		{
			workspace.GET("/my-requests", workspaceHandler.GetMyRequests)
			workspace.GET("/my-borrows", workspaceHandler.GetMyBorrows)
			workspace.GET("/my-devices", workspaceHandler.GetMyDevices)
		}

		// Notification routes
		notifications := api.Group("/notifications")
		notifications.Use(middleware.Auth())
		{
			notifications.GET("", notificationHandler.GetNotifications)
			notifications.GET("/unread-count", notificationHandler.GetUnreadCount)
			notifications.POST("/:id/read", notificationHandler.MarkAsRead)
			notifications.POST("/read-all", notificationHandler.MarkAllAsRead)
		}
	}

	// Static files for uploads
	router.Static("/uploads", config.AppConfig.Upload.Path)

	// Start server
	port := config.AppConfig.Server.Port
	if port == "" {
		port = "5000"
	}

	logger.Info("Server starting", "port", port)
	go autoScanScheduler.Start(context.Background())
	if err := router.Run(":" + port); err != nil {
		logger.Fatal("Failed to start server", "error", err)
	}
}

func backfillTemplateNeedRestart(db *gorm.DB) {
	// 兼容历史数据：早期将是否重启写在 remark('true'/'false')，迁移为独立字段 need_restart。
	trueResult := db.Model(&models.DBSQLTemplate{}).
		Where("LOWER(TRIM(remark)) = ?", "true").
		Updates(map[string]interface{}{
			"need_restart": true,
			"remark":       "",
		})
	if trueResult.Error != nil {
		logger.Warn("Backfill need_restart(true) failed", "error", trueResult.Error)
		return
	}

	falseResult := db.Model(&models.DBSQLTemplate{}).
		Where("LOWER(TRIM(remark)) = ?", "false").
		Updates(map[string]interface{}{
			"need_restart": false,
			"remark":       "",
		})
	if falseResult.Error != nil {
		logger.Warn("Backfill need_restart(false) failed", "error", falseResult.Error)
		return
	}

	affected := trueResult.RowsAffected + falseResult.RowsAffected
	if affected > 0 {
		logger.Info("Backfilled template need_restart from remark", "affected", affected)
	}
}
