package services

import (
	"strings"

	"device-management/internal/config"
)

type posDBConnectionConfig struct {
	Port     int
	User     string
	Password string
	Name     string
}

func resolvePOSDBConnectionConfig(defaultPort int, defaultUser, defaultPassword, defaultName string) posDBConnectionConfig {
	cfg := posDBConnectionConfig{
		Port:     defaultPort,
		User:     defaultUser,
		Password: defaultPassword,
		Name:     defaultName,
	}

	if config.AppConfig == nil {
		return cfg
	}

	if config.AppConfig.POSDatabase.Port > 0 {
		cfg.Port = config.AppConfig.POSDatabase.Port
	}
	if strings.TrimSpace(config.AppConfig.POSDatabase.User) != "" {
		cfg.User = strings.TrimSpace(config.AppConfig.POSDatabase.User)
	}
	if config.AppConfig.POSDatabase.Password != "" {
		cfg.Password = config.AppConfig.POSDatabase.Password
	}
	if strings.TrimSpace(config.AppConfig.POSDatabase.Name) != "" {
		cfg.Name = strings.TrimSpace(config.AppConfig.POSDatabase.Name)
	}

	return cfg
}
