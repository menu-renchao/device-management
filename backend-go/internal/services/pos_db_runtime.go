package services

import (
	"errors"
	"strconv"

	"device-management/internal/config"
	"device-management/internal/models"
	"device-management/internal/repository"
)

var ErrEmptyDeviceIP = errors.New("device IP is empty")

// POSDBRuntimeResolver resolves POS database connection at runtime using device IP
type POSDBRuntimeResolver struct {
	deviceRepo *repository.DeviceRepository
}

// NewPOSDBRuntimeResolver creates a new runtime resolver
func NewPOSDBRuntimeResolver(deviceRepo *repository.DeviceRepository) *POSDBRuntimeResolver {
	return &POSDBRuntimeResolver{
		deviceRepo: deviceRepo,
	}
}

// ResolveForMerchant resolves the POS DB connection for a given merchant ID
func (r *POSDBRuntimeResolver) ResolveForMerchant(merchantID string) (DBConnectionInput, error) {
	if merchantID == "" {
		return DBConnectionInput{}, errors.New("merchant_id is required")
	}

	device, err := r.deviceRepo.GetScanResultByMerchantID(merchantID)
	if err != nil {
		return DBConnectionInput{}, err
	}
	if device == nil {
		return DBConnectionInput{}, errors.New("device not found")
	}

	return r.resolveFromDevice(device)
}

// resolveFromDevice resolves connection data from a device
func (r *POSDBRuntimeResolver) resolveFromDevice(device *models.ScanResult) (DBConnectionInput, error) {
	if device == nil {
		return DBConnectionInput{}, errors.New("device is required")
	}

	ip := device.IP
	if ip == "" {
		return DBConnectionInput{}, ErrEmptyDeviceIP
	}

	posConfig := config.AppConfig.POSDatabase

	port := 3306
	if posConfig.Port != "" {
		if p, err := strconv.Atoi(posConfig.Port); err == nil {
			port = p
		}
	}

	return DBConnectionInput{
		DBType:       posConfig.Type,
		Host:         ip,
		Port:         port,
		DatabaseName: posConfig.Name,
		Username:     posConfig.User,
		Password:     posConfig.Password,
	}, nil
}
