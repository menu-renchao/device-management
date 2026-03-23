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

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

type DBConnectionInput struct {
	DBType           string `json:"db_type"`
	Host             string `json:"host"`
	Port             int    `json:"port"`
	DatabaseName     string `json:"database_name"`
	Username         string `json:"username"`
	Password         string `json:"password"`
	UseSavedPassword bool   `json:"use_saved_password"`
}

type POSDBDefaultConnectionInfo struct {
	MerchantID   string `json:"merchant_id"`
	Host         string `json:"host"`
	Port         int    `json:"port"`
	DatabaseName string `json:"database_name"`
	Username     string `json:"username"`
	PasswordSet  bool   `json:"password_set"`
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
	return "risk SQL detected and blocked"
}

type posDBRuntime interface {
	Resolve(merchantID string) (DBConnectionInput, error)
	GetDefaultConnectionInfo(merchantID string) (*POSDBDefaultConnectionInfo, error)
}

type DBConfigService struct {
	posDBRuntime         posDBRuntime
	templateRepo         *repository.DBSQLTemplateRepository
	taskRepo             *repository.DBSQLExecuteTaskRepository
	openAndPingMySQLFunc func(DBConnectionInput) (*sql.DB, error)
	lockMap              sync.Map
}

func NewDBConfigService(
	posDBRuntime posDBRuntime,
	templateRepo *repository.DBSQLTemplateRepository,
	taskRepo *repository.DBSQLExecuteTaskRepository,
) *DBConfigService {
	return &DBConfigService{
		posDBRuntime:         posDBRuntime,
		templateRepo:         templateRepo,
		taskRepo:             taskRepo,
		openAndPingMySQLFunc: openAndPingMySQL,
	}
}

func (s *DBConfigService) GetDefaultConnectionInfo(merchantID string) (*POSDBDefaultConnectionInfo, error) {
	if strings.TrimSpace(merchantID) == "" {
		return nil, fmt.Errorf("merchant_id is required")
	}
	return s.posDBRuntime.GetDefaultConnectionInfo(merchantID)
}

func (s *DBConfigService) GetConnection(merchantID string) (*models.DeviceDBConnection, error) {
	info, err := s.GetDefaultConnectionInfo(merchantID)
	if err != nil {
		return nil, err
	}

	return &models.DeviceDBConnection{
		MerchantID:        info.MerchantID,
		DBType:            "mysql",
		Host:              info.Host,
		Port:              info.Port,
		DatabaseName:      info.DatabaseName,
		Username:          info.Username,
		PasswordEncrypted: "configured-by-default",
	}, nil
}

func (s *DBConfigService) UpsertConnection(merchantID string, _ DBConnectionInput, _ uint) (*models.DeviceDBConnection, error) {
	return s.GetConnection(merchantID)
}

func (s *DBConfigService) TestConnectionForMerchant(merchantID string, _ ...DBConnectionInput) error {
	if strings.TrimSpace(merchantID) == "" {
		return fmt.Errorf("merchant_id is required")
	}

	input, err := s.posDBRuntime.Resolve(merchantID)
	if err != nil {
		return err
	}

	db, err := s.openAndPingMySQLFunc(input)
	if err != nil {
		return err
	}
	if db != nil {
		defer db.Close()
	}
	return nil
}

func (s *DBConfigService) ExecuteTemplates(input ExecuteTemplatesInput) (*models.DBSQLExecuteTask, []models.DBSQLExecuteTaskItem, error) {
	if strings.TrimSpace(input.MerchantID) == "" {
		return nil, nil, fmt.Errorf("merchant_id is required")
	}
	if len(input.TemplateIDs) == 0 {
		return nil, nil, fmt.Errorf("at least one template must be selected")
	}
	if input.ForceExecute && input.ExecutorRole != "admin" {
		return nil, nil, fmt.Errorf("only admins can force high-risk SQL")
	}
	if input.ForceExecute && strings.TrimSpace(input.ForceReason) == "" {
		return nil, nil, fmt.Errorf("force_reason is required when force_execute is true")
	}

	dbInput, err := s.posDBRuntime.Resolve(input.MerchantID)
	if err != nil {
		return nil, nil, err
	}

	templateIDs := uniqueUintIDs(input.TemplateIDs)
	templates, err := s.templateRepo.GetByIDs(templateIDs)
	if err != nil {
		return nil, nil, err
	}
	if len(templates) == 0 {
		return nil, nil, fmt.Errorf("no executable templates found")
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
		return nil, nil, fmt.Errorf("template contains no executable SQL")
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

	db, err := s.openAndPingMySQLFunc(dbInput)
	if err != nil {
		return s.finishTaskOnError(task, len(statements), fmt.Errorf("open target database: %w", err))
	}
	defer db.Close()

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
		return s.finishTaskOnError(task, len(statements), fmt.Errorf("write execute items: %w", err))
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
		return nil, errors.New("mysql connection parameters are incomplete")
	}
	if input.Port <= 0 {
		input.Port = 3306
	}

	cfg := mysql.Config{
		User:                 input.Username,
		Passwd:               input.Password,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", input.Host, input.Port),
		DBName:               input.DatabaseName,
		ParseTime:            true,
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
