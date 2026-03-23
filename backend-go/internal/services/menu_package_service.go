package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"device-management/internal/config"
)

const (
	menuPackageSQLExtension   = ".menupack.sql"
	menuPackageDBPort         = 22108
	menuPackageDBUser         = "shohoku"
	menuPackageDBPassword     = "N0mur@4$99!"
	menuPackageDBName         = "kpos"
	menuPackageDefaultCharset = "utf8"
)

type MenuPackageFileInfo struct {
	Name             string    `json:"name"`
	SourceMerchantID string    `json:"source_merchant_id"`
	SourceVersion    string    `json:"source_version"`
	Size             int64     `json:"size"`
	ModTime          time.Time `json:"mod_time"`
}

type MenuPackageGroup struct {
	SourceMerchantID string                `json:"source_merchant_id"`
	Items            []MenuPackageFileInfo `json:"items"`
}

type MenuPackageService struct {
	spec                MenuDomainSpec
	dbPort              int
	dbUser              string
	dbPassword          string
	dbName              string
	packagesRootDirFunc func() string
}

func NewMenuPackageService() *MenuPackageService {
	dbCfg := resolvePOSDBConnectionConfig(
		menuPackageDBPort,
		menuPackageDBUser,
		menuPackageDBPassword,
		menuPackageDBName,
	)

	return &MenuPackageService{
		spec:       NewMenuDomainSpec(),
		dbPort:     dbCfg.Port,
		dbUser:     dbCfg.User,
		dbPassword: dbCfg.Password,
		dbName:     dbCfg.Name,
	}
}

func (s *MenuPackageService) CreatePackage(host, merchantID, version string) (*MenuPackageFileInfo, error) {
	host = strings.TrimSpace(host)
	merchantID = strings.TrimSpace(merchantID)
	if host == "" {
		return nil, fmt.Errorf("menu export host is empty")
	}
	if merchantID == "" {
		return nil, fmt.Errorf("menu export merchant_id is empty")
	}

	merchantDir, err := s.ensureMerchantDir(sanitizePathSegment(merchantID, "unknown-mid"))
	if err != nil {
		return nil, err
	}

	versionSegment := sanitizePathSegment(version, "v_unknown")
	filePath, fileName, err := nextMenuPackageFilePath(merchantDir, merchantID, versionSegment)
	if err != nil {
		return nil, err
	}
	if err := s.exportMenuDomainToSQLFile(host, merchantID, strings.TrimSpace(version), filePath); err != nil {
		_ = os.Remove(filePath)
		return nil, err
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("stat menu package file: %w", err)
	}

	return &MenuPackageFileInfo{
		Name:             fileName,
		SourceMerchantID: merchantID,
		SourceVersion:    strings.TrimSpace(version),
		Size:             info.Size(),
		ModTime:          info.ModTime(),
	}, nil
}

func (s *MenuPackageService) ListPackages(merchantID string) ([]MenuPackageFileInfo, error) {
	merchantDir := filepath.Join(s.getPackagesRootDir(), sanitizePathSegment(merchantID, "unknown-mid"))
	if _, err := os.Stat(merchantDir); os.IsNotExist(err) {
		return []MenuPackageFileInfo{}, nil
	}

	entries, err := os.ReadDir(merchantDir)
	if err != nil {
		return nil, fmt.Errorf("read menu package directory: %w", err)
	}

	items := make([]MenuPackageFileInfo, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !isSupportedMenuPackageFileName(name) {
			continue
		}
		info, statErr := entry.Info()
		if statErr != nil {
			continue
		}
		items = append(items, MenuPackageFileInfo{
			Name:             name,
			SourceMerchantID: strings.TrimSpace(merchantID),
			SourceVersion:    extractMenuPackageVersion(name),
			Size:             info.Size(),
			ModTime:          info.ModTime(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})
	return items, nil
}

func (s *MenuPackageService) ListPackageGroups(merchantIDs []string, excludeMerchantID string) ([]MenuPackageGroup, error) {
	groups := make([]MenuPackageGroup, 0, len(merchantIDs))
	for _, merchantID := range merchantIDs {
		merchantID = strings.TrimSpace(merchantID)
		if merchantID == "" || merchantID == strings.TrimSpace(excludeMerchantID) {
			continue
		}

		items, err := s.ListPackages(merchantID)
		if err != nil {
			return nil, err
		}
		if len(items) == 0 {
			continue
		}

		groups = append(groups, MenuPackageGroup{
			SourceMerchantID: merchantID,
			Items:            items,
		})
	}

	sort.Slice(groups, func(i, j int) bool {
		return groups[i].SourceMerchantID < groups[j].SourceMerchantID
	})
	return groups, nil
}

func (s *MenuPackageService) OpenPackageFile(merchantID, fileName string) (*os.File, int64, error) {
	filePath, err := s.resolvePackagePath(merchantID, fileName)
	if err != nil {
		return nil, 0, err
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, 0, fmt.Errorf("open menu package file: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, 0, fmt.Errorf("stat menu package file: %w", err)
	}

	return file, info.Size(), nil
}

func (s *MenuPackageService) DeletePackage(merchantID, fileName string) error {
	filePath, err := s.resolvePackagePath(merchantID, fileName)
	if err != nil {
		return err
	}
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("delete menu package file: %w", err)
	}
	return nil
}

func (s *MenuPackageService) ImportFromServerPackage(host, merchantID, fileName string) error {
	filePath, err := s.resolvePackagePath(merchantID, fileName)
	if err != nil {
		return err
	}
	return s.importFromFile(host, filePath)
}

func (s *MenuPackageService) ImportFromUploadPackage(host, filePath string) error {
	return s.importFromFile(host, filePath)
}

func (s *MenuPackageService) importFromFile(host, filePath string) error {
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return fmt.Errorf("menu package file path is empty")
	}
	if !isSupportedMenuPackageFileName(filepath.Base(filePath)) {
		return fmt.Errorf("only %s files are supported", menuPackageSQLExtension)
	}
	return s.runMenuImportSQLFile(host, filePath)
}

func (s *MenuPackageService) packagesRootDir() string {
	downloadsDir := "downloads"
	if config.AppConfig != nil && strings.TrimSpace(config.AppConfig.Download.DownloadsDir) != "" {
		downloadsDir = strings.TrimSpace(config.AppConfig.Download.DownloadsDir)
	}
	parentDir := filepath.Dir(downloadsDir)
	return filepath.Join(parentDir, "menu-packages")
}

func (s *MenuPackageService) getPackagesRootDir() string {
	if s.packagesRootDirFunc != nil {
		return s.packagesRootDirFunc()
	}
	return s.packagesRootDir()
}

func (s *MenuPackageService) ensureMerchantDir(merchantFolder string) (string, error) {
	rootDir := s.getPackagesRootDir()
	merchantDir := filepath.Join(rootDir, merchantFolder)
	if err := os.MkdirAll(merchantDir, 0755); err != nil {
		return "", fmt.Errorf("create menu package directory: %w", err)
	}
	return merchantDir, nil
}

func (s *MenuPackageService) resolvePackagePath(merchantID, fileName string) (string, error) {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		return "", fmt.Errorf("menu package file name is empty")
	}
	if filepath.Base(fileName) != fileName || strings.Contains(fileName, "..") {
		return "", fmt.Errorf("menu package file name is invalid")
	}
	if !isSupportedMenuPackageFileName(fileName) {
		return "", fmt.Errorf("only %s files are supported", menuPackageSQLExtension)
	}

	merchantFolder := sanitizePathSegment(merchantID, "unknown-mid")
	return filepath.Join(s.getPackagesRootDir(), merchantFolder, fileName), nil
}

func (s *MenuPackageService) requireCommand(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("required command not found: %s", name)
	}
	return nil
}

func nextMenuPackageFilePath(merchantDir, merchantID, version string) (string, string, error) {
	timestamp := time.Now().Format("20060102_150405")
	baseName := fmt.Sprintf("%s_%s_%s", sanitizePathSegment(merchantID, "unknown-mid"), version, timestamp)
	fileName := baseName + menuPackageSQLExtension
	filePath := filepath.Join(merchantDir, fileName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return filePath, fileName, nil
	}
	for i := 1; i <= 99; i++ {
		fileName = fmt.Sprintf("%s_%02d%s", baseName, i, menuPackageSQLExtension)
		filePath = filepath.Join(merchantDir, fileName)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return filePath, fileName, nil
		}
	}
	return "", "", fmt.Errorf("failed to generate unique menu package file name")
}

func extractMenuPackageVersion(fileName string) string {
	name := strings.TrimSpace(fileName)
	name = strings.TrimSuffix(name, menuPackageSQLExtension)
	if name == "" {
		return "v_unknown"
	}
	lastUnderscore := strings.LastIndex(name, "_")
	if lastUnderscore <= 0 {
		return name
	}
	secondUnderscore := strings.LastIndex(name[:lastUnderscore], "_")
	if secondUnderscore <= 0 {
		return name
	}
	return name[secondUnderscore+1 : lastUnderscore]
}

func isSupportedMenuPackageFileName(fileName string) bool {
	lowerName := strings.ToLower(strings.TrimSpace(fileName))
	return strings.HasSuffix(lowerName, menuPackageSQLExtension)
}

func (s *MenuPackageService) exportMenuDomainToSQLFile(host, merchantID, version, filePath string) error {
	if err := s.requireCommand("mysqldump"); err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("create menu package file: %w", err)
	}
	defer file.Close()

	if _, err := fmt.Fprintf(
		file,
		"-- menu package format=%s merchant_id=%s version=%s exported_at=%s\n\n",
		menuPackageFormatVersion,
		merchantID,
		version,
		time.Now().Format(time.RFC3339),
	); err != nil {
		return fmt.Errorf("write menu package header: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	for _, table := range s.spec.TableOrder {
		if _, err := fmt.Fprintf(file, "-- table: %s\n", table); err != nil {
			return fmt.Errorf("write table header: %w", err)
		}
		if err := s.dumpTableToWriter(ctx, file, host, table); err != nil {
			return err
		}
		if _, err := file.WriteString("\n"); err != nil {
			return fmt.Errorf("write table separator: %w", err)
		}
	}

	return nil
}

func (s *MenuPackageService) dumpTableToWriter(ctx context.Context, writer io.Writer, host, table string) error {
	var stderr bytes.Buffer

	args := []string{
		"-h", strings.TrimSpace(host),
		"--port", strconv.Itoa(s.dbPort),
		"-u", s.dbUser,
		"-p" + s.dbPassword,
		"--default-character-set=" + menuPackageDefaultCharset,
		"--single-transaction",
		"--quick",
		"--skip-triggers",
		"--no-create-info",
		"--skip-add-locks",
		"--skip-lock-tables",
		"--compact",
		"--complete-insert",
	}
	if table == "field_display_name" {
		args = append(args, "--where="+s.fieldDisplayNameWhereClause())
	}
	args = append(args, s.dbName, table)

	cmd := exec.CommandContext(ctx, "mysqldump", args...)
	cmd.Stdout = writer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return wrapCommandError("menu export failed", err, stderr.String())
	}
	return nil
}

func (s *MenuPackageService) fieldDisplayNameWhereClause() string {
	quotedTypes := make([]string, 0, len(s.spec.FieldDisplayNameTypes))
	for _, fieldType := range s.spec.FieldDisplayNameTypes {
		quotedTypes = append(quotedTypes, "'"+escapeSQLString(fieldType)+"'")
	}
	return "field_type IN (" + strings.Join(quotedTypes, ",") + ")"
}

func (s *MenuPackageService) runMenuImportSQLFile(host, sqlFilePath string) error {
	if err := s.requireCommand("mysql"); err != nil {
		return err
	}

	sqlFile, err := os.Open(sqlFilePath)
	if err != nil {
		return fmt.Errorf("open menu package file: %w", err)
	}
	defer sqlFile.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	var stderr bytes.Buffer
	cmd := exec.CommandContext(
		ctx,
		"mysql",
		"-h", strings.TrimSpace(host),
		"--port", strconv.Itoa(s.dbPort),
		"-u", s.dbUser,
		"-p"+s.dbPassword,
		"--default-character-set="+menuPackageDefaultCharset,
		"--force",
		s.dbName,
	)
	cmd.Stderr = &stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("open mysql stdin pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return fmt.Errorf("start mysql command: %w", err)
	}

	writeErr := make(chan error, 1)
	go func() {
		defer stdin.Close()

		if _, err := io.WriteString(stdin, s.menuImportPreludeSQL()); err != nil {
			writeErr <- err
			return
		}
		if _, err := io.Copy(stdin, sqlFile); err != nil {
			writeErr <- err
			return
		}
		if _, err := io.WriteString(stdin, "\n"+s.menuImportPostludeSQL()); err != nil {
			writeErr <- err
			return
		}
		writeErr <- nil
	}()

	if err := <-writeErr; err != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return fmt.Errorf("write mysql import script: %w", err)
	}

	if err := cmd.Wait(); err != nil {
		return wrapCommandError("menu import failed", err, stderr.String())
	}
	return nil
}

func (s *MenuPackageService) menuImportPreludeSQL() string {
	var builder strings.Builder
	builder.WriteString("SET FOREIGN_KEY_CHECKS=0;\n")
	for _, table := range s.spec.ClearOrder {
		builder.WriteString(s.clearTableSQL(table))
		builder.WriteString("\n")
	}
	return builder.String()
}

func (s *MenuPackageService) menuImportPostludeSQL() string {
	var builder strings.Builder
	builder.WriteString("\n")
	builder.WriteString(s.repairStepsSQL())
	builder.WriteString("\nSET FOREIGN_KEY_CHECKS=1;\n")
	return builder.String()
}

func (s *MenuPackageService) clearTableSQL(table string) string {
	if table == "field_display_name" {
		return "DELETE FROM `field_display_name` WHERE " + s.fieldDisplayNameWhereClause() + ";"
	}
	return fmt.Sprintf("DELETE FROM `%s`;", table)
}

func (s *MenuPackageService) repairStepsSQL() string {
	repairSteps := []string{
		"update system_language,field_display_name set system_language.id=field_display_name.language_id where system_language.name='Chinese' and field_display_name.name=_utf8mb4 0xE78EB0E98791E694AFE4BB98;",
		"update system_language,field_display_name set field_display_name.language_id=(select id from system_language where name='Chinese') where field_display_name.language_id=3 or field_display_name.language_id=2;",
		"update menu_group set admin_readable=1 where menu_id=4 and deleted=0;",
		"update printer set second_language_id=(select id from system_language where name='Chinese');",
		"update global_device set receipt_printer_id=null,package_printer_id=null,runner_printer_id=null,cash_drawer_id=null,report_printer_id=null,payment_terminal_id=null,package_printer_id_2=null,waitlist_printer_id=null,open_food_printer_id=null;",
		"update app_instance set receipt_printer_id=null;",
		"INSERT INTO field_display_name (name,item_id,field_name,field_type,language_id,version,deleted,read_only) SELECT name,item_id,'shortName',field_type,language_id,version,deleted,read_only from field_display_name WHERE read_only = 0 and field_name = 'name' and field_type in ('COMBO_SECTION','CATEGORY','MENU_GROUP') and item_id in (select item_id from field_display_name WHERE deleted=0 and field_type in ('COMBO_SECTION','CATEGORY','MENU_GROUP') GROUP BY item_id,language_id having count(field_name)<2);",
		"INSERT INTO field_display_name (name,item_id,field_name,field_type,language_id,version,deleted,read_only) SELECT name,item_id,'posName',field_type,language_id,version,deleted,read_only from field_display_name WHERE read_only = 0 and field_name = 'name' and field_type in ('CATEGORY','SALE_ITEM','ITEM_OPTION') and item_id in (select item_id from field_display_name WHERE deleted=0 and field_type in ('COMBO_SECTION','CATEGORY','MENU_GROUP','ITEM_SIZE','SALE_ITEM','ITEM_OPTION') GROUP BY item_id,language_id having count(field_name)<3);",
		"DELETE from field_display_name where field_name='shortName' and field_type='ITEM_SIZE';",
		"UPDATE menu_item set report_item_id=null;",
	}

	return strings.Join(repairSteps, "\n")
}
