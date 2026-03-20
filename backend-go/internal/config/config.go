package config

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server         ServerConfig
	JWT            JWTConfig
	Database       DatabaseConfig
	CORS           CORSConfig
	Upload         UploadConfig
	Download       DownloadConfig
	Log            LogConfig
	BootstrapAdmin BootstrapAdminConfig
}

type ServerConfig struct {
	Port          string
	Mode          string
	RunMode       string
	PublicBaseURL string
	POSProxyHostTemplate string
}

type JWTConfig struct {
	SecretKey             string
	AccessTokenExpires    time.Duration
	RefreshTokenExpires   time.Duration
}

type DatabaseConfig struct {
	Path string
}

type CORSConfig struct {
	Origins []string
}

type UploadConfig struct {
	Path string
}

type DownloadConfig struct {
	DownloadsDir string
}

type LogConfig struct {
	Level      string
	Format     string
	Output     string
	FilePath   string
	MaxSize    int
	MaxBackups int
	MaxAge     int
	Compress   bool
}

type BootstrapAdminConfig struct {
	Username string
	Password string
	Email    string
	Name     string
}

var AppConfig *Config

var ErrInvalidBootstrapAdminConfig = errors.New("bootstrap admin username and password must be provided together")

func Init() error {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("PORT", "5000")
	viper.SetDefault("GIN_MODE", "debug")
	viper.SetDefault("PUBLIC_BASE_URL", "")
	viper.SetDefault("POS_PROXY_HOST_TEMPLATE", "")
	viper.SetDefault("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
	viper.SetDefault("JWT_ACCESS_TOKEN_EXPIRES", "24")
	viper.SetDefault("JWT_REFRESH_TOKEN_EXPIRES", "720")
	viper.SetDefault("DATABASE_PATH", "data.db")
	viper.SetDefault("CORS_ORIGINS", "*")
	viper.SetDefault("UPLOAD_PATH", "uploads")
	viper.SetDefault("DOWNLOADS_DIR", "downloads")
	// 日志配置默认值
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("LOG_FORMAT", "json")
	viper.SetDefault("LOG_OUTPUT", "both")
	viper.SetDefault("LOG_FILE_PATH", "logs/app.log")
	viper.SetDefault("LOG_MAX_SIZE", 100)
	viper.SetDefault("LOG_MAX_BACKUPS", 10)
	viper.SetDefault("LOG_MAX_AGE", 30)
	viper.SetDefault("LOG_COMPRESS", true)
	viper.SetDefault("BOOTSTRAP_ADMIN_USERNAME", "")
	viper.SetDefault("BOOTSTRAP_ADMIN_PASSWORD", "")
	viper.SetDefault("BOOTSTRAP_ADMIN_EMAIL", "")
	viper.SetDefault("BOOTSTRAP_ADMIN_NAME", "")

	if err := viper.ReadInConfig(); err != nil {
		// If .env doesn't exist, use defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	// Parse CORS origins
	corsOriginsStr := viper.GetString("CORS_ORIGINS")
	var corsOrigins []string
	if corsOriginsStr == "*" {
		corsOrigins = []string{"*"}
	} else {
		corsOrigins = strings.Split(corsOriginsStr, ",")
		for i, origin := range corsOrigins {
			corsOrigins[i] = strings.TrimSpace(origin)
		}
	}

	accessHours := viper.GetInt("JWT_ACCESS_TOKEN_EXPIRES")
	refreshHours := viper.GetInt("JWT_REFRESH_TOKEN_EXPIRES")
	bootstrapAdmin, err := readBootstrapAdminConfig()
	if err != nil {
		return err
	}

	AppConfig = &Config{
		Server: ServerConfig{
			Port:          viper.GetString("PORT"),
			Mode:          viper.GetString("GIN_MODE"),
			RunMode:       viper.GetString("GIN_MODE"),
			PublicBaseURL: strings.TrimSpace(viper.GetString("PUBLIC_BASE_URL")),
			POSProxyHostTemplate: strings.TrimSpace(viper.GetString("POS_PROXY_HOST_TEMPLATE")),
		},
		JWT: JWTConfig{
			SecretKey:           viper.GetString("JWT_SECRET_KEY"),
			AccessTokenExpires:  time.Duration(accessHours) * time.Hour,
			RefreshTokenExpires: time.Duration(refreshHours) * time.Hour,
		},
		Database: DatabaseConfig{
			Path: viper.GetString("DATABASE_PATH"),
		},
		CORS: CORSConfig{
			Origins: corsOrigins,
		},
		Upload: UploadConfig{
			Path: viper.GetString("UPLOAD_PATH"),
		},
		Download: DownloadConfig{
			DownloadsDir: viper.GetString("DOWNLOADS_DIR"),
		},
		Log: LogConfig{
			Level:      viper.GetString("LOG_LEVEL"),
			Format:     viper.GetString("LOG_FORMAT"),
			Output:     viper.GetString("LOG_OUTPUT"),
			FilePath:   viper.GetString("LOG_FILE_PATH"),
			MaxSize:    viper.GetInt("LOG_MAX_SIZE"),
			MaxBackups: viper.GetInt("LOG_MAX_BACKUPS"),
			MaxAge:     viper.GetInt("LOG_MAX_AGE"),
			Compress:   viper.GetBool("LOG_COMPRESS"),
		},
		BootstrapAdmin: bootstrapAdmin,
	}

	return nil
}

func readBootstrapAdminConfig() (BootstrapAdminConfig, error) {
	config := BootstrapAdminConfig{
		Username: strings.TrimSpace(viper.GetString("BOOTSTRAP_ADMIN_USERNAME")),
		Password: strings.TrimSpace(viper.GetString("BOOTSTRAP_ADMIN_PASSWORD")),
		Email:    strings.TrimSpace(viper.GetString("BOOTSTRAP_ADMIN_EMAIL")),
		Name:     strings.TrimSpace(viper.GetString("BOOTSTRAP_ADMIN_NAME")),
	}

	if config.Username == "" && config.Password == "" {
		return config, nil
	}
	if config.Username == "" || config.Password == "" {
		return BootstrapAdminConfig{}, ErrInvalidBootstrapAdminConfig
	}
	return config, nil
}

func (c BootstrapAdminConfig) IsConfigured() bool {
	return strings.TrimSpace(c.Username) != "" && strings.TrimSpace(c.Password) != ""
}
