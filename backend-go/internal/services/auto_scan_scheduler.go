package services

import (
	"context"
	"encoding/json"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"
)

type AutoScanScheduler struct {
	scanService *ScanService
	configRepo  *repository.AutoScanConfigRepository
	jobRepo     *repository.ScanJobLogRepository
	deviceRepo  *repository.DeviceRepository
	tickInterval time.Duration
}

func NewAutoScanScheduler(
	scanService *ScanService,
	configRepo *repository.AutoScanConfigRepository,
	jobRepo *repository.ScanJobLogRepository,
	deviceRepo *repository.DeviceRepository,
	tickInterval time.Duration,
) *AutoScanScheduler {
	if tickInterval <= 0 {
		tickInterval = time.Minute
	}

	return &AutoScanScheduler{
		scanService:  scanService,
		configRepo:   configRepo,
		jobRepo:      jobRepo,
		deviceRepo:   deviceRepo,
		tickInterval: tickInterval,
	}
}

func (s *AutoScanScheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(s.tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = s.RunOnce(ctx)
		}
	}
}

func (s *AutoScanScheduler) RunOnce(ctx context.Context) error {
	config, err := s.configRepo.GetOrCreateDefault()
	if err != nil {
		return err
	}

	now := time.Now()
	if !shouldRunAutoScan(config, now) {
		return nil
	}

	return s.runConfig(ctx, config, now)
}

func (s *AutoScanScheduler) RunNow(ctx context.Context) error {
	config, err := s.configRepo.GetOrCreateDefault()
	if err != nil {
		return err
	}
	return s.runConfig(ctx, config, time.Now())
}

func (s *AutoScanScheduler) runConfig(ctx context.Context, config *models.AutoScanConfig, now time.Time) error {
	status := s.scanService.GetStatus()
	if status.IsScanning {
		return s.createSkippedJob(config)
	}

	cidrBlocks, err := config.GetCIDRBlocks()
	if err != nil {
		return err
	}

	job := &models.ScanJobLog{
		TriggerType: "auto",
		Status:      "running",
		StartedAt:   now,
		TriggeredBy: "system",
		Port:        config.Port,
	}
	if err := job.SetCIDRBlocks(cidrBlocks); err != nil {
		return err
	}
	if err := s.jobRepo.Create(job); err != nil {
		return err
	}

	config.LastAutoScanStartedAt = &now
	if err := s.configRepo.Update(config); err != nil {
		return err
	}

	runCfg := withScanDefaults(ScanRunConfig{
		TriggerType:           "auto",
		CIDRBlocks:            cidrBlocks,
		Port:                  config.Port,
		ConnectTimeoutSeconds: config.ConnectTimeoutSeconds,
		RequestTimeoutSeconds: config.RequestTimeoutSeconds,
		MaxProbeWorkers:       config.MaxProbeWorkers,
		MaxFetchWorkers:       config.MaxFetchWorkers,
		TriggeredBy:           "system",
	})

	if err := s.scanService.RunScanWithConfig(runCfg, func(result map[string]interface{}) {
		s.saveScanResult(result)
	}); err != nil {
		job.Status = "failed"
		job.ErrorMessage = err.Error()
		finishedAt := time.Now()
		job.FinishedAt = &finishedAt
		_ = s.jobRepo.Update(job)
		return err
	}

	go s.awaitCompletion(ctx, config.ID, job.ID)
	return nil
}

func shouldRunAutoScan(config *models.AutoScanConfig, now time.Time) bool {
	if config == nil || !config.Enabled {
		return false
	}
	if config.LastAutoScanStartedAt == nil {
		return true
	}
	return now.Sub(*config.LastAutoScanStartedAt) >= time.Duration(config.IntervalMinutes)*time.Minute
}

func (s *AutoScanScheduler) createSkippedJob(config *models.AutoScanConfig) error {
	blocks, err := config.GetCIDRBlocks()
	if err != nil {
		return err
	}

	job := &models.ScanJobLog{
		TriggerType: "auto",
		Status:      "skipped",
		StartedAt:   time.Now(),
		TriggeredBy: "system",
		Port:        config.Port,
		ErrorMessage: "scan already in progress",
	}
	if err := job.SetCIDRBlocks(blocks); err != nil {
		return err
	}
	return s.jobRepo.Create(job)
}

func (s *AutoScanScheduler) awaitCompletion(ctx context.Context, configID, jobID uint) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			status := s.scanService.GetStatus()
			if status.IsScanning {
				continue
			}

			s.finalizeRun(configID, jobID, status)
			return
		}
	}
}

func (s *AutoScanScheduler) finalizeRun(configID, jobID uint, status *ScanStatus) {
	finishedAt := time.Now()

	if !status.WasCancelled && len(status.MerchantIDs) > 0 {
		_ = s.deviceRepo.SetOfflineNotInMerchantIDs(status.MerchantIDs)
	}

	session, err := s.deviceRepo.GetScanSession()
	if err == nil {
		session.LastScanAt = finishedAt
		_ = s.deviceRepo.UpdateScanSession(session)
	}

	config, err := s.configRepo.GetOrCreateDefault()
	if err == nil && config.ID == configID {
		config.LastAutoScanFinishedAt = &finishedAt
		_ = s.configRepo.Update(config)
	}

	job, err := s.jobRepo.GetByID(jobID)
	if err != nil {
		return
	}
	job.FinishedAt = &finishedAt
	job.DevicesFound = len(status.Results)
	job.MerchantIDsFound = len(status.MerchantIDs)
	if status.WasCancelled {
		job.Status = "cancelled"
	} else if status.Error != "" {
		job.Status = "failed"
		job.ErrorMessage = status.Error
	} else {
		job.Status = "success"
	}
	_ = s.jobRepo.Update(job)
}

func (s *AutoScanScheduler) saveScanResult(result map[string]interface{}) {
	merchantID, _ := result["merchantId"].(string)
	if merchantID == "" {
		ip, _ := result["ip"].(string)
		existing, err := s.deviceRepo.GetScanResultByIPAndEmptyMerchant(ip)
		if err == nil && existing != nil {
			updateScanResultFromMap(existing, result)
			_ = s.deviceRepo.UpdateScanResult(existing)
		} else {
			_ = s.deviceRepo.CreateScanResult(createScanResultFromMap(result))
		}
		return
	}

	existing, err := s.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err == nil && existing != nil {
		updateScanResultFromMap(existing, result)
		_ = s.deviceRepo.UpdateScanResult(existing)
		return
	}

	_ = s.deviceRepo.CreateScanResult(createScanResultFromMap(result))
}

func createScanResultFromMap(result map[string]interface{}) *models.ScanResult {
	now := time.Now()
	scanResult := &models.ScanResult{
		IsOnline:       true,
		LastOnlineTime: now,
		ScannedAt:      now,
	}

	if ip, ok := result["ip"].(string); ok {
		scanResult.IP = ip
	}
	if merchantID, ok := result["merchantId"].(string); ok && merchantID != "" {
		scanResult.MerchantID = &merchantID
	}
	if name, ok := result["name"].(string); ok && name != "" {
		scanResult.Name = &name
	}
	if version, ok := result["version"].(string); ok && version != "" {
		scanResult.Version = &version
	}
	if deviceType, ok := result["type"].(string); ok && deviceType != "" {
		scanResult.Type = &deviceType
	}
	if fullData, ok := result["fullData"].(map[string]interface{}); ok {
		if jsonData, err := json.Marshal(fullData); err == nil {
			jsonStr := string(jsonData)
			scanResult.FullData = &jsonStr
		}
	}

	return scanResult
}

func updateScanResultFromMap(scanResult *models.ScanResult, result map[string]interface{}) {
	now := time.Now()
	scanResult.LastOnlineTime = now
	scanResult.ScannedAt = now
	scanResult.IsOnline = true

	if ip, ok := result["ip"].(string); ok {
		scanResult.IP = ip
	}
	if name, ok := result["name"].(string); ok {
		scanResult.Name = &name
	}
	if version, ok := result["version"].(string); ok {
		scanResult.Version = &version
	}
	if deviceType, ok := result["type"].(string); ok {
		scanResult.Type = &deviceType
	}
	if fullData, ok := result["fullData"].(map[string]interface{}); ok {
		if jsonData, err := json.Marshal(fullData); err == nil {
			jsonStr := string(jsonData)
			scanResult.FullData = &jsonStr
		}
	}
}
