package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"device-management/internal/config"
	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

type DBConnectionInput struct {
	DBType       string `json:"db_type"`
	Host         string `json:"host"`
	Port         int    `json:"port"`
	DatabaseName string `json:"database_name"`
	Username     string `json:"username"`
	Password     string `json:"password"`
}

type ExecuteTemplatesInput struct {
	MerchantID     string `json:"merchant_id"`
	TemplateIDs    []uint `json:"template_ids"`
	ForceExecute   bool   `json:"force_execute"`
	ForceReason    string `json:"force_reason"`
	DeviceType     string
	ExecutorUserID uint
	ExecutorRole   string
	ClientIP       string
	UserAgent      string
}

type RiskSQLBlockedError struct {
	Risks []SQLRiskResult
}

func (e *RiskSQLBlockedError) Error() string {
	return "检测到高风险 SQL，默认禁止执行"
}

type DBConfigService struct {
	deviceRepo  *repository.DeviceRepository
	templateRepo *repository.DBSQLTemplateRepository
	taskRepo    *repository.DBSQLExecuteTaskRepository
	lockMap     sync.Map
}

func NewDBConfigService(
	deviceRepo *repository.DeviceRepository,
	templateRepo *repository.DBSQLTemplateRepository,
	taskRepo *repository.DBSQLExecuteTaskRepository,
) *DBConfigService {
	return &DBConfigService{
		deviceRepo:   deviceRepo,
		templateRepo: templateRepo,
		taskRepo:     taskRepo,
	}
}

// ConnectionInfo represents runtime-derived connection information (without password)
type ConnectionInfo struct {
	DBType       string `json:"db_type"`
	Host         string `json:"host"`
	Port         int    `json:"port"`
	DatabaseName string `json:"database_name"`
	Username     string `json:"username"`
	HasPassword  bool   `json:"has_password"`
}

// GetConnection returns runtime-derived connection info for a merchant
func (s *DBConfigService) GetConnection(merchantID string) (*ConnectionInfo, error) {
	if merchantID == "" {
		return nil, errors.New("merchant_id is required")
	}

	device, err := s.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil {
		return nil, err
	}
	if device == nil {
		return nil, errors.New("device not found")
	}

	return s.resolveConnectionFromDevice(device)
}

// resolveConnectionFromDevice resolves connection info from device using runtime config
func (s *DBConfigService) resolveConnectionFromDevice(device *models.ScanResult) (*ConnectionInfo, error) {
	if device == nil {
		return nil, errors.New("device is required")
	}

	ip := device.IP
	if ip == "" {
		return nil, errors.New("device IP is empty")
	}

	posConfig := config.AppConfig.POSDatabase

	port := 3306
	if posConfig.Port != "" {
		if p, err := fmt.Sscanf(posConfig.Port, "%d", &port); err == nil && p == 0 {
			port = 3306
		}
	}

	return &ConnectionInfo{
		DBType:       posConfig.Type,
		Host:         ip,
		Port:         port,
		DatabaseName: posConfig.Name,
		Username:     posConfig.User,
		HasPassword:  posConfig.Password != "",
	}, nil
}

// TestConnection tests a POS DB connection
func (s *DBConfigService) TestConnection(input DBConnectionInput) error {
	if strings.TrimSpace(input.Host) == "" || strings.TrimSpace(input.DatabaseName) == "" || strings.TrimSpace(input.Username) == "" {
		return fmt.Errorf("连接信息不完整")
	}
	if input.Port <= 0 {
		input.Port = 3306
	}

	db, err := openAndPingMySQL(input)
	if err != nil {
		return err
	}
	defer db.Close()

	return nil
}

// TestConnectionForMerchant tests connection for a merchant using runtime config
func (s *DBConfigService) TestConnectionForMerchant(merchantID string) error {
	if merchantID == "" {
		return errors.New("merchant_id is required")
	}

	connInfo, err := s.GetConnection(merchantID)
	if err != nil {
		return err
	}

	input := DBConnectionInput{
		DBType:       connInfo.DBType,
		Host:         connInfo.Host,
		Port:         connInfo.Port,
		DatabaseName: connInfo.DatabaseName,
		Username:     connInfo.Username,
		Password:     config.AppConfig.POSDatabase.Password,
	}

	return s.TestConnection(input)
}

// ExecuteTemplates executes SQL templates on the POS DB
func (s *DBConfigService) ExecuteTemplates(input ExecuteTemplatesInput) (*models.DBSQLExecuteTask, []models.DBSQLExecuteTaskItem, error) {
	if strings.TrimSpace(input.MerchantID) == "" {
		return nil, nil, fmt.Errorf("merchant_id 不能为空")
	}
	if len(input.TemplateIDs) == 0 {
		return nil, nil, fmt.Errorf("请选择至少一个模板")
	}
	if input.ForceExecute && input.ExecutorRole != "admin" {
		return nil, nil, fmt.Errorf("仅管理员可强制执行高风险 SQL")
	}
	if input.ForceExecute && strings.TrimSpace(input.ForceReason) == "" {
		return nil, nil, fmt.Errorf("强制执行时必须填写原因")
	}

	connInfo, err := s.GetConnection(input.MerchantID)
	if err != nil {
		return nil, nil, fmt.Errorf("获取设备连接信息失败: %w", err)
	}

	if connInfo.DBType != "mysql" {
		return nil, nil, fmt.Errorf("当前仅支持 mysql")
	}

	dbInput := DBConnectionInput{
		DBType:       connInfo.DBType,
		Host:         connInfo.Host,
		Port:         connInfo.Port,
		DatabaseName: connInfo.DatabaseName,
		Username:     connInfo.Username,
		Password:     config.AppConfig.POSDatabase.Password,
	}

	templateIDs := uniqueUintIDs(input.TemplateIDs)
	templates, err := s.templateRepo.GetByIDs(templateIDs)
	if err != nil {
		return nil, nil, err
	}
	if len(templates) == 0 {
		return nil, nil, fmt.Errorf("未找到可执行模板")
	}

	type preparedStatement struct {
		TemplateID   uint
		TemplateName string
		SQL          string
	}

	statements := make([]preparedStatement, 0)
	onlySQL := make([]string, 0)
	for _, t := range templates {
		splitted := SplitSQLStatements(t.SQLContent)
		for _, stmt := range splitted {
			statements = append(statements, preparedStatement{
				TemplateID:   t.ID,
				TemplateName: t.Name,
				SQL:          stmt,
			})
			onlySQL = append(onlySQL, stmt)
		}
	}
	if len(statements) == 0 {
		return nil, nil, fmt.Errorf("模板中没有可执行 SQL")
	}

	risks := FindBlockedRisks(onlySQL)
	if len(risks) > 0 && !input.ForceExecute {
		return nil, nil, &RiskSQLBlockedError{Risks: risks}
	}

	lock := s.getDeviceLock(input.MerchantID)
	lock.Lock()
	defer lock.Unlock()

	templateIDPayload, _ := json.Marshal(templateIDs)
	task := &models.DBSQLExecuteTask{
		TaskID:          uuid.NewString(),
		MerchantID:      input.MerchantID,
		DeviceType:      input.DeviceType,
		ExecutorUserID:  input.ExecutorUserID,
		ExecutorRole:    input.ExecutorRole,
		TemplateIDsJSON: string(templateIDPayload),
		IsForced:        input.ForceExecute,
		ForceReason:     input.ForceReason,
		Status:          "running",
		TotalCount:      len(statements),
		SuccessCount:    0,
		FailedCount:     0,
		StartedAt:       time.Now(),
		ClientIP:        input.ClientIP,
		UserAgent:       input.UserAgent,
	}
	if err := s.taskRepo.CreateTask(task); err != nil {
		return nil, nil, err
	}

	db, err := openAndPingMySQL(dbInput)
	if err != nil {
		return s.finishTaskOnError(task, len(statements), fmt.Errorf("创建数据库连接失败: %w", err))
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	pingErr := db.PingContext(ctx)
	cancel()
	if pingErr != nil {
		return s.finishTaskOnError(task, len(statements), fmt.Errorf("数据库连接失败: %w", pingErr))
	}

	successCount := 0
	failedCount := 0
	items := make([]models.DBSQLExecuteTaskItem, 0, len(statements))

	for idx, stmt := range statements {
		start := time.Now()
		status := "success"
		errMsg := ""

		execCtx, execCancel := context.WithTimeout(context.Background(), 12*time.Second)
		_, execErr := db.ExecContext(execCtx, stmt.SQL)
		execCancel()
		if execErr != nil {
			status = "failed"
			errMsg = execErr.Error()
			failedCount++
		} else {
			successCount++
		}

		items = append(items, models.DBSQLExecuteTaskItem{
			TaskID:               task.TaskID,
			TemplateID:           stmt.TemplateID,
			TemplateNameSnapshot: stmt.TemplateName,
			SQLIndex:             idx + 1,
			SQLTextSnapshot:      stmt.SQL,
			Status:               status,
			ErrorMessage:         errMsg,
			DurationMS:           time.Since(start).Milliseconds(),
			ExecutedAt:           time.Now(),
		})
	}

	if err := s.taskRepo.CreateTaskItems(items); err != nil {
		return s.finishTaskOnError(task, len(statements), fmt.Errorf("写入执行明细失败: %w", err))
	}

	finishedAt := time.Now()
	finalStatus := "success"
	if failedCount > 0 && successCount > 0 {
		finalStatus = "partial_failed"
	} else if failedCount > 0 {
		finalStatus = "failed"
	}
	if err := s.taskRepo.FinishTask(
		task.TaskID,
		finalStatus,
		successCount,
		failedCount,
		finishedAt,
		finishedAt.Sub(task.StartedAt).Milliseconds(),
	); err != nil {
		return nil, nil, err
	}

	finishedTask, err := s.taskRepo.GetTaskByTaskID(task.TaskID)
	if err != nil {
		return nil, nil, err
	}
	return finishedTask, items, nil
}

func (s *DBConfigService) GetTaskDetail(taskID string) (*models.DBSQLExecuteTask, []models.DBSQLExecuteTaskItem, error) {
	task, err := s.taskRepo.GetTaskByTaskID(taskID)
	if err != nil {
		return nil, nil, err
	}
	if task == nil {
		return nil, nil, nil
	}
	items, err := s.taskRepo.GetTaskItems(taskID)
	if err != nil {
		return nil, nil, err
	}
	return task, items, nil
}

func (s *DBConfigService) ListHistory(page, pageSize int, userID uint, isAdmin bool) ([]models.DBSQLExecuteTask, int64, int64, error) {
	return s.taskRepo.ListHistory(page, pageSize, userID, isAdmin)
}

func (s *DBConfigService) finishTaskOnError(task *models.DBSQLExecuteTask, failedCount int, err error) (*models.DBSQLExecuteTask, []models.DBSQLExecuteTaskItem, error) {
	finishedAt := time.Now()
	_ = s.taskRepo.FinishTask(
		task.TaskID,
		"failed",
		0,
		failedCount,
		finishedAt,
		finishedAt.Sub(task.StartedAt).Milliseconds(),
	)
	finishedTask, _ := s.taskRepo.GetTaskByTaskID(task.TaskID)
	return finishedTask, nil, err
}

func (s *DBConfigService) getDeviceLock(merchantID string) *sync.Mutex {
	if merchantID == "" {
		return &sync.Mutex{}
	}
	val, _ := s.lockMap.LoadOrStore(merchantID, &sync.Mutex{})
	return val.(*sync.Mutex)
}

func uniqueUintIDs(ids []uint) []uint {
	if len(ids) == 0 {
		return ids
	}
	seen := make(map[uint]struct{}, len(ids))
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func openMySQL(input DBConnectionInput) (*sql.DB, error) {
	if strings.TrimSpace(input.Host) == "" || strings.TrimSpace(input.DatabaseName) == "" || strings.TrimSpace(input.Username) == "" || strings.TrimSpace(input.Password) == "" {
		return nil, errors.New("mysql 连接参数不完整")
	}
	if input.Port <= 0 {
		input.Port = 3306
	}

	cfg := mysql.Config{
		User:      input.Username,
		Passwd:    input.Password,
		Net:       "tcp",
		Addr:      fmt.Sprintf("%s:%d", input.Host, input.Port),
		DBName:    input.DatabaseName,
		ParseTime: true,
		// 部分门店设备 MySQL 用户仍使用 mysql_native_password，显式开启兼容。
		AllowNativePasswords: true,
		Params: map[string]string{
			"charset": "utf8mb4",
		},
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(30 * time.Second)
	return db, nil
}

func openAndPingMySQL(input DBConnectionInput) (*sql.DB, error) {
	hosts := mysqlConnectionHosts(input.Host, getLocalIPv4s())
	var lastErr error

	for _, host := range hosts {
		candidate := input
		candidate.Host = host

		db, err := openMySQL(candidate)
		if err != nil {
			lastErr = err
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pingErr := db.PingContext(ctx)
		cancel()
		if pingErr == nil {
			return db, nil
		}

		lastErr = pingErr
		_ = db.Close()
	}

	if lastErr == nil {
		lastErr = errors.New("mysql connection failed")
	}
	return nil, fmt.Errorf("connection failed: %w", lastErr)
}

func mysqlConnectionHosts(host string, localIPs []string) []string {
	trimmedHost := strings.TrimSpace(host)
	if trimmedHost == "" {
		return nil
	}

	hosts := []string{trimmedHost}
	if isLocalIPv4(trimmedHost, localIPs) {
		hosts = append(hosts, "localhost", "127.0.0.1")
	}

	return uniqueStrings(hosts)
}

func isLocalIPv4(host string, localIPs []string) bool {
	ip := net.ParseIP(strings.TrimSpace(host))
	if ip == nil || ip.To4() == nil {
		return false
	}
	if ip.IsLoopback() {
		return true
	}

	for _, localIP := range localIPs {
		if strings.TrimSpace(localIP) == ip.String() {
			return true
		}
	}
	return false
}

func getLocalIPv4s() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	ips := make([]string, 0)
	seen := make(map[string]struct{})
	for _, iface := range ifaces {
		addrs, addrErr := iface.Addrs()
		if addrErr != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch value := addr.(type) {
			case *net.IPNet:
				ip = value.IP
			case *net.IPAddr:
				ip = value.IP
			}

			ip = ip.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}

			normalized := ip.String()
			if _, exists := seen[normalized]; exists {
				continue
			}
			seen[normalized] = struct{}{}
			ips = append(ips, normalized)
		}
	}
	return ips
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return values
	}

	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
