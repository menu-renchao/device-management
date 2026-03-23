package services

import (
	"fmt"
	"strings"

	"device-management/internal/repository"
)

const (
	defaultPOSDBPort     = 22108
	defaultPOSDBUser     = "shohoku"
	defaultPOSDBPassword = "N0mur@4$99!"
	defaultPOSDBName     = "kpos"
)

type POSDBRuntime struct {
	deviceRepo *repository.DeviceRepository
}

func NewPOSDBRuntime(deviceRepo *repository.DeviceRepository) *POSDBRuntime {
	return &POSDBRuntime{deviceRepo: deviceRepo}
}

func (r *POSDBRuntime) Resolve(merchantID string) (DBConnectionInput, error) {
	device, err := r.deviceRepo.GetScanResultByMerchantID(strings.TrimSpace(merchantID))
	if err != nil {
		return DBConnectionInput{}, fmt.Errorf("load device %s: %w", merchantID, err)
	}

	host := strings.TrimSpace(device.IP)
	if host == "" {
		return DBConnectionInput{}, fmt.Errorf("device %s has empty IP", merchantID)
	}

	dbCfg := resolvePOSDBConnectionConfig(
		defaultPOSDBPort,
		defaultPOSDBUser,
		defaultPOSDBPassword,
		defaultPOSDBName,
	)

	return DBConnectionInput{
		DBType:       "mysql",
		Host:         host,
		Port:         dbCfg.Port,
		DatabaseName: dbCfg.Name,
		Username:     dbCfg.User,
		Password:     dbCfg.Password,
	}, nil
}

func (r *POSDBRuntime) GetDefaultConnectionInfo(merchantID string) (*POSDBDefaultConnectionInfo, error) {
	input, err := r.Resolve(merchantID)
	if err != nil {
		return nil, err
	}

	return &POSDBDefaultConnectionInfo{
		MerchantID:   strings.TrimSpace(merchantID),
		Host:         input.Host,
		Port:         input.Port,
		DatabaseName: input.DatabaseName,
		Username:     input.Username,
		PasswordSet:  strings.TrimSpace(input.Password) != "",
	}, nil
}
