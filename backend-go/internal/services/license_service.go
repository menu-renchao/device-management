package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"device-management/internal/config"

	"github.com/go-sql-driver/mysql"
)

const (
	licenseDBName     = "kpos"
	licenseDBUser     = "shohoku"
	licenseDBPassword = "N0mur@4$99!"
	licenseDBPort     = 22108
	licenseDateLayout = "2006-01-02 15:04:05"
)

type LicenseService struct {
	backupFunc         func(host string) (*LicenseBackupResult, error)
	importFunc         func(host, sqlContent string) (*LicenseImportResult, error)
	backupsRootDirFunc func() string
}

type LicenseBackupResult struct {
	FileName string
	Content  []byte
}

type LicenseBackupFileInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

type LicenseImportResult struct {
	ExecutedCount int
}

func NewLicenseService() *LicenseService {
	service := &LicenseService{}
	service.backupFunc = service.buildBackupResult
	service.importFunc = service.executeImport
	service.backupsRootDirFunc = service.backupsRootDir
	return service
}

func (s *LicenseService) Backup(host string) (*LicenseBackupResult, error) {
	return s.backupFunc(host)
}

func (s *LicenseService) buildBackupResult(host string) (*LicenseBackupResult, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("设备IP为空，无法连接数据库")
	}

	db, err := s.openDB(host)
	if err != nil {
		return nil, fmt.Errorf("POS 不在线，或输入IP地址有误: %w", err)
	}
	defer db.Close()

	merchantID, err := s.getMerchantID(db)
	if err != nil {
		return nil, err
	}

	companySQL, err := s.buildCompanyProfileSQL(db)
	if err != nil {
		return nil, err
	}

	systemSQL, err := s.buildSystemConfigurationSQL(db)
	if err != nil {
		return nil, err
	}

	header := fmt.Sprintf(`-- ============================================================
-- License 备份文件
-- 商户ID: %s
-- 生成时间: %s
-- 工具版本: License备份恢复工具 v1.0
-- ============================================================

`, merchantID, time.Now().Format(licenseDateLayout))

	content := header + companySQL + "\n" + systemSQL
	filename := fmt.Sprintf("License%s_%s.sql", merchantID, time.Now().Format("20060102_150405"))

	return &LicenseBackupResult{
		FileName: filename,
		Content:  []byte(content),
	}, nil
}

func (s *LicenseService) Import(host, sqlContent string) (*LicenseImportResult, error) {
	return s.importFunc(host, sqlContent)
}

func (s *LicenseService) executeImport(host, sqlContent string) (*LicenseImportResult, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("设备IP为空，无法连接数据库")
	}

	cleaned := strings.TrimSpace(strings.TrimPrefix(sqlContent, "\uFEFF"))
	if cleaned == "" {
		return nil, fmt.Errorf("SQL文件内容为空")
	}

	db, err := s.openDB(host)
	if err != nil {
		return nil, fmt.Errorf("POS 不在线，或输入IP地址有误: %w", err)
	}
	defer db.Close()

	statements := SplitSQLStatements(cleaned)
	if len(statements) == 0 {
		return nil, fmt.Errorf("SQL文件中没有可执行语句")
	}

	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		return nil, fmt.Errorf("开启事务失败: %w", err)
	}

	executedCount := 0
	for idx, statement := range statements {
		stmt := strings.TrimSpace(statement)
		if stmt == "" || strings.HasPrefix(stmt, "--") || strings.HasPrefix(stmt, "#") {
			continue
		}

		if _, execErr := tx.Exec(stmt); execErr != nil {
			_ = tx.Rollback()
			return nil, fmt.Errorf("License导入失败，第%d条SQL执行错误: %w", idx+1, execErr)
		}
		executedCount++
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &LicenseImportResult{
		ExecutedCount: executedCount,
	}, nil
}

func (s *LicenseService) CreateBackup(host, merchantID string) (*LicenseBackupFileInfo, error) {
	result, err := s.Backup(host)
	if err != nil {
		return nil, err
	}
	if len(result.Content) == 0 {
		return nil, fmt.Errorf("License备份文件内容为空")
	}

	merchantDir, err := s.ensureMerchantDir(sanitizePathSegment(merchantID, "unknown-mid"))
	if err != nil {
		return nil, err
	}

	fileName := filepath.Base(strings.TrimSpace(result.FileName))
	if fileName == "." || fileName == "" || strings.ToLower(filepath.Ext(fileName)) != ".sql" {
		return nil, fmt.Errorf("License备份文件名不合法")
	}

	filePath := filepath.Join(merchantDir, fileName)
	if err := os.WriteFile(filePath, result.Content, 0644); err != nil {
		return nil, fmt.Errorf("创建License备份文件失败: %w", err)
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取License备份文件信息失败: %w", err)
	}

	return &LicenseBackupFileInfo{
		Name:    fileName,
		Size:    info.Size(),
		ModTime: info.ModTime(),
	}, nil
}

func (s *LicenseService) ListBackups(merchantID string) ([]LicenseBackupFileInfo, error) {
	merchantDir := filepath.Join(s.backupsRootDirFunc(), sanitizePathSegment(merchantID, "unknown-mid"))
	if _, err := os.Stat(merchantDir); os.IsNotExist(err) {
		return []LicenseBackupFileInfo{}, nil
	}

	entries, err := os.ReadDir(merchantDir)
	if err != nil {
		return nil, fmt.Errorf("读取License备份目录失败: %w", err)
	}

	items := make([]LicenseBackupFileInfo, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.ToLower(filepath.Ext(name)) != ".sql" {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		items = append(items, LicenseBackupFileInfo{
			Name:    name,
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})
	return items, nil
}

func (s *LicenseService) DeleteBackup(merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("删除License备份文件失败: %w", err)
	}
	return nil
}

func (s *LicenseService) OpenBackupFile(merchantID, fileName string) (*os.File, int64, error) {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return nil, 0, err
	}
	file, err := os.Open(filePath)
	if err != nil {
		return nil, 0, fmt.Errorf("打开License备份文件失败: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, 0, fmt.Errorf("读取License备份文件信息失败: %w", err)
	}
	return file, info.Size(), nil
}

func (s *LicenseService) RestoreFromServerFile(host, merchantID, fileName string) error {
	filePath, err := s.resolveBackupPath(merchantID, fileName)
	if err != nil {
		return err
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("读取License备份文件失败: %w", err)
	}
	_, err = s.Import(host, string(content))
	return err
}

func (s *LicenseService) backupsRootDir() string {
	downloadsDir := "downloads"
	if config.AppConfig != nil && strings.TrimSpace(config.AppConfig.Download.DownloadsDir) != "" {
		downloadsDir = strings.TrimSpace(config.AppConfig.Download.DownloadsDir)
	}
	parentDir := filepath.Dir(downloadsDir)
	return filepath.Join(parentDir, "license-backups")
}

func (s *LicenseService) ensureMerchantDir(merchantFolder string) (string, error) {
	rootDir := s.backupsRootDirFunc()
	merchantDir := filepath.Join(rootDir, merchantFolder)
	if err := os.MkdirAll(merchantDir, 0755); err != nil {
		return "", fmt.Errorf("创建License备份目录失败: %w", err)
	}
	return merchantDir, nil
}

func (s *LicenseService) resolveBackupPath(merchantID, fileName string) (string, error) {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		return "", fmt.Errorf("License备份文件名不能为空")
	}
	if filepath.Base(fileName) != fileName || strings.Contains(fileName, "..") {
		return "", fmt.Errorf("License备份文件名不合法")
	}
	if strings.ToLower(filepath.Ext(fileName)) != ".sql" {
		return "", fmt.Errorf("仅支持 .sql License备份文件")
	}

	merchantDir := filepath.Join(s.backupsRootDirFunc(), sanitizePathSegment(merchantID, "unknown-mid"))
	return filepath.Join(merchantDir, fileName), nil
}

func (s *LicenseService) openDB(host string) (*sql.DB, error) {
	dbCfg := resolvePOSDBConnectionConfig(
		licenseDBPort,
		licenseDBUser,
		licenseDBPassword,
		licenseDBName,
	)

	cfg := mysql.Config{
		User:                 dbCfg.User,
		Passwd:               dbCfg.Password,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", host, dbCfg.Port),
		DBName:               dbCfg.Name,
		ParseTime:            true,
		AllowNativePasswords: true,
		Params: map[string]string{
			"charset": "utf8",
		},
	}

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(30 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}

	return db, nil
}

func (s *LicenseService) getMerchantID(db *sql.DB) (string, error) {
	var merchantID sql.NullString
	err := db.QueryRow("SELECT merchant_id FROM company_profile LIMIT 1").Scan(&merchantID)
	if err == sql.ErrNoRows || !merchantID.Valid || strings.TrimSpace(merchantID.String) == "" {
		return "", fmt.Errorf("未找到商户信息")
	}
	if err != nil {
		return "", fmt.Errorf("查询商户信息失败: %w", err)
	}
	return strings.TrimSpace(merchantID.String), nil
}

func (s *LicenseService) buildCompanyProfileSQL(db *sql.DB) (string, error) {
	query := `
SELECT
	name,
	address1,
	address2,
	city,
	state,
	zipcode,
	telephone1,
	telephone2,
	license_key,
	merchant_id,
	merchant_group_id,
	license_status,
	timezone,
	CAST(license_expires_on AS CHAR) AS license_expires_on,
	` + "`mode`" + `,
	serial_no
FROM company_profile`

	rows, err := db.Query(query)
	if err != nil {
		return "", fmt.Errorf("查询 company_profile 失败: %w", err)
	}
	defer rows.Close()

	var builder strings.Builder
	builder.WriteString("-- ==================== COMPANY_PROFILE 更新 ====================\n\n")

	found := false
	for rows.Next() {
		found = true
		var row struct {
			Name            sql.NullString
			Address1        sql.NullString
			Address2        sql.NullString
			City            sql.NullString
			State           sql.NullString
			Zipcode         sql.NullString
			Telephone1      sql.NullString
			Telephone2      sql.NullString
			LicenseKey      sql.NullString
			MerchantID      sql.NullString
			MerchantGroupID sql.NullString
			LicenseStatus   sql.NullInt64
			Timezone        sql.NullString
			LicenseExpires  sql.NullString
			Mode            sql.NullString
			SerialNo        sql.NullString
		}

		if err := rows.Scan(
			&row.Name,
			&row.Address1,
			&row.Address2,
			&row.City,
			&row.State,
			&row.Zipcode,
			&row.Telephone1,
			&row.Telephone2,
			&row.LicenseKey,
			&row.MerchantID,
			&row.MerchantGroupID,
			&row.LicenseStatus,
			&row.Timezone,
			&row.LicenseExpires,
			&row.Mode,
			&row.SerialNo,
		); err != nil {
			return "", fmt.Errorf("读取 company_profile 失败: %w", err)
		}

		builder.WriteString("UPDATE company_profile SET \n")
		builder.WriteString("        name = " + nullableString(row.Name) + ",\n")
		builder.WriteString("        address1 = " + nullableString(row.Address1) + ",\n")
		builder.WriteString("        address2 = " + nullableString(row.Address2) + ",\n")
		builder.WriteString("        city = " + nullableString(row.City) + ",\n")
		builder.WriteString("        state = " + nullableString(row.State) + ",\n")
		builder.WriteString("        zipcode = " + nullableString(row.Zipcode) + ",\n")
		builder.WriteString("        telephone1 = " + nullableString(row.Telephone1) + ",\n")
		builder.WriteString("        telephone2 = " + nullableString(row.Telephone2) + ",\n")
		builder.WriteString("        license_key = " + nullableString(row.LicenseKey) + ",\n")
		builder.WriteString("        merchant_id = " + nullableString(row.MerchantID) + ",\n")
		builder.WriteString("        merchant_group_id = " + nullableString(row.MerchantGroupID) + ",\n")
		builder.WriteString("        license_status = " + nullableInt(row.LicenseStatus) + ",\n")
		builder.WriteString("        timezone = " + nullableString(row.Timezone) + ",\n")
		builder.WriteString("        license_expires_on = " + nullableString(row.LicenseExpires) + ",\n")
		builder.WriteString("        mode = " + nullableString(row.Mode) + ",\n")
		builder.WriteString("        serial_no = " + nullableString(row.SerialNo) + ";\n\n")
	}

	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("遍历 company_profile 失败: %w", err)
	}
	if !found {
		return "", fmt.Errorf("未找到 company_profile 数据")
	}

	return builder.String(), nil
}

func (s *LicenseService) buildSystemConfigurationSQL(db *sql.DB) (string, error) {
	query := `
SELECT
	` + "`name`" + `,
	` + "`val`" + `,
	` + "`boolean_val`" + `,
	` + "`int_val`" + `,
	` + "`double_val`" + `,
	CASE
		WHEN ` + "`date_val`" + ` IS NULL THEN NULL
		ELSE DATE_FORMAT(` + "`date_val`" + `, '%Y-%m-%d %H:%i:%s')
	END AS date_val,
	` + "`description`" + `,
	CASE
		WHEN ` + "`created_on`" + ` IS NULL THEN NULL
		ELSE DATE_FORMAT(` + "`created_on`" + `, '%Y-%m-%d %H:%i:%s')
	END AS created_on,
	CASE
		WHEN ` + "`last_updated`" + ` IS NULL THEN NULL
		ELSE DATE_FORMAT(` + "`last_updated`" + `, '%Y-%m-%d %H:%i:%s')
	END AS last_updated,
	` + "`created_by`" + `,
	` + "`last_updated_by`" + `,
	` + "`version`" + `,
	` + "`display_name`" + `,
	` + "`category`" + `,
	` + "`second_level_category`" + `,
	` + "`frontend_readable`" + `,
	` + "`frontend_editable`" + `,
	` + "`admin_readable`" + `,
	` + "`admin_editable`" + `,
	` + "`config_type`" + `,
	` + "`global_setting`" + `,
	` + "`user_setting`" + `,
	` + "`app_setting`" + `,
	` + "`sync_to_cloud`" + `,
	` + "`merchant_id`" + `,
	` + "`sequence_num`" + `
FROM system_configuration
WHERE ` + "`name`" + ` IN (
	'LICENSE_HARDWARE_SIGNATURE_REQUIRED',
	'MAX_POS_ALLOWED',
	'MENUSIFU_API_SERVICE_API_KEY',
	'MENUSIFU_SERVICE_KEY'
)
ORDER BY ` + "`name`"

	rows, err := db.Query(query)
	if err != nil {
		return "", fmt.Errorf("查询 system_configuration 失败: %w", err)
	}
	defer rows.Close()

	var builder strings.Builder
	builder.WriteString("-- ==================== SYSTEM_CONFIGURATION 清理 ====================\n")
	builder.WriteString("DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'LICENSE_HARDWARE_SIGNATURE_REQUIRED';\n")
	builder.WriteString("DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MAX_POS_ALLOWED';\n")
	builder.WriteString("DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MENUSIFU_API_SERVICE_API_KEY';\n")
	builder.WriteString("DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MENUSIFU_SERVICE_KEY';\n\n")

	found := false
	for rows.Next() {
		found = true
		var row struct {
			Name                sql.NullString
			Val                 sql.NullString
			BooleanVal          sql.NullInt64
			IntVal              sql.NullInt64
			DoubleVal           sql.NullFloat64
			DateVal             sql.NullString
			Description         sql.NullString
			CreatedOn           sql.NullString
			LastUpdated         sql.NullString
			CreatedBy           sql.NullInt64
			LastUpdatedBy       sql.NullInt64
			Version             sql.NullInt64
			DisplayName         sql.NullString
			Category            sql.NullString
			SecondLevelCategory sql.NullString
			FrontendReadable    sql.NullInt64
			FrontendEditable    sql.NullInt64
			AdminReadable       sql.NullInt64
			AdminEditable       sql.NullInt64
			ConfigType          sql.NullString
			GlobalSetting       sql.NullInt64
			UserSetting         sql.NullInt64
			AppSetting          sql.NullInt64
			SyncToCloud         sql.NullInt64
			MerchantID          sql.NullInt64
			SequenceNum         sql.NullInt64
		}

		if err := rows.Scan(
			&row.Name,
			&row.Val,
			&row.BooleanVal,
			&row.IntVal,
			&row.DoubleVal,
			&row.DateVal,
			&row.Description,
			&row.CreatedOn,
			&row.LastUpdated,
			&row.CreatedBy,
			&row.LastUpdatedBy,
			&row.Version,
			&row.DisplayName,
			&row.Category,
			&row.SecondLevelCategory,
			&row.FrontendReadable,
			&row.FrontendEditable,
			&row.AdminReadable,
			&row.AdminEditable,
			&row.ConfigType,
			&row.GlobalSetting,
			&row.UserSetting,
			&row.AppSetting,
			&row.SyncToCloud,
			&row.MerchantID,
			&row.SequenceNum,
		); err != nil {
			return "", fmt.Errorf("读取 system_configuration 失败: %w", err)
		}

		if found && !strings.Contains(builder.String(), "-- ==================== SYSTEM_CONFIGURATION 插入 ====================") {
			builder.WriteString("-- ==================== SYSTEM_CONFIGURATION 插入 ====================\n\n")
		}

		builder.WriteString("INSERT INTO system_configuration (\n")
		builder.WriteString("        `name`, `val`, `boolean_val`, `int_val`, `double_val`, `date_val`,\n")
		builder.WriteString("        `description`, `created_on`, `last_updated`, `created_by`, `last_updated_by`,\n")
		builder.WriteString("        `version`, `display_name`, `category`, `second_level_category`,\n")
		builder.WriteString("        `frontend_readable`, `frontend_editable`, `admin_readable`, `admin_editable`,\n")
		builder.WriteString("        `config_type`, `global_setting`, `user_setting`, `app_setting`, `sync_to_cloud`,\n")
		builder.WriteString("        `merchant_id`, `sequence_num`\n")
		builder.WriteString("    ) VALUES (\n")
		builder.WriteString("        " + nullableString(row.Name) + ", " + nullableString(row.Val) + ", " + nullableInt(row.BooleanVal) + ", " + nullableInt(row.IntVal) + ", " + nullableFloat(row.DoubleVal) + ", " + nullableDateTime(row.DateVal) + ",\n")
		builder.WriteString("        " + nullableString(row.Description) + ", " + nullableDateTime(row.CreatedOn) + ", " + nullableDateTime(row.LastUpdated) + ", " + nullableInt(row.CreatedBy) + ", " + nullableInt(row.LastUpdatedBy) + ",\n")
		builder.WriteString("        " + nullableInt(row.Version) + ", " + nullableString(row.DisplayName) + ", " + nullableString(row.Category) + ", " + nullableString(row.SecondLevelCategory) + ",\n")
		builder.WriteString("        " + nullableInt(row.FrontendReadable) + ", " + nullableInt(row.FrontendEditable) + ", " + nullableInt(row.AdminReadable) + ", " + nullableInt(row.AdminEditable) + ",\n")
		builder.WriteString("        " + nullableString(row.ConfigType) + ", " + nullableInt(row.GlobalSetting) + ", " + nullableInt(row.UserSetting) + ", " + nullableInt(row.AppSetting) + ", " + nullableInt(row.SyncToCloud) + ",\n")
		builder.WriteString("        " + nullableInt(row.MerchantID) + ", " + nullableInt(row.SequenceNum) + "\n")
		builder.WriteString("    );\n\n")
	}

	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("遍历 system_configuration 失败: %w", err)
	}

	builder.WriteString(`-- ==================== 额外配置更新 ====================

UPDATE system_configuration SET val = NULL WHERE name = 'AWS_SQS_QUEUE_INFO';

UPDATE kpos.system_configuration SET val = 'https://api.menusifu.cn/performance-env'
WHERE name IN ('HEARBEAT_SERVICE_URL', 'MENU_SERVICE_URL', 'MERCHANT_SERVICE_URL', 'ORDER_SERVICE_URL');

UPDATE system_configuration SET val = 'hWppFMrbyV5+J/BsjHcP5UyoiyVYNw83x2mq8UhxnJAUFfKPSuHU8bumw8ma5LI/'
WHERE name = 'MENUSIFU_PUBLIC_API_SERVICE_API_KEY';

DELETE FROM kpos.sync_scheduled_task_his;

UPDATE kpos.system_configuration SET boolean_val = 1
WHERE name = 'ENABLE_MENUSIFU_PUBLIC_API_SERVICE';

UPDATE kpos.system_configuration SET val = NULL
WHERE ` + "`name`" + ` = 'AWS_SQS_QUEUE_INFO' AND merchant_id IS NULL;
`)

	if !found {
		return builder.String(), nil
	}

	return builder.String(), nil
}

func escapeSQLString(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func nullableString(value sql.NullString) string {
	if !value.Valid {
		return "null"
	}
	return "'" + escapeSQLString(value.String) + "'"
}

func nullableInt(value sql.NullInt64) string {
	if !value.Valid {
		return "null"
	}
	return strconv.FormatInt(value.Int64, 10)
}

func nullableFloat(value sql.NullFloat64) string {
	if !value.Valid {
		return "null"
	}
	return strconv.FormatFloat(value.Float64, 'f', -1, 64)
}

func nullableDateTime(value sql.NullString) string {
	if value.Valid && strings.TrimSpace(value.String) != "" {
		return "'" + escapeSQLString(strings.TrimSpace(value.String)) + "'"
	}
	return "'2020-07-23 13:58:50'"
}
