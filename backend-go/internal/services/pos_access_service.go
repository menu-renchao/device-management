package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"device-management/internal/models"
)

const posHTTPPort = 22080

var (
	ErrPOSMerchantIDRequired = errors.New("merchant id is required")
	ErrPOSDeviceOffline      = errors.New("pos device is offline")
	ErrPOSDeviceIPMissing    = errors.New("pos device ip is missing")
)

type POSAccessInfo struct {
	MerchantID     string
	IP             string
	Port           int
	DirectURL      string
	ProxyURL       string
	PreferDirect   bool
	IsOnline       bool
	LastOnlineTime time.Time
}

type POSDeviceLookup interface {
	GetScanResultByMerchantID(merchantID string) (*models.ScanResult, error)
}

type POSAccessService struct {
	repo POSDeviceLookup
}

func NewPOSAccessService(repo POSDeviceLookup) *POSAccessService {
	return &POSAccessService{repo: repo}
}

func (s *POSAccessService) ResolveAccessInfo(merchantID string) (*POSAccessInfo, error) {
	trimmedMerchantID := strings.TrimSpace(merchantID)
	if trimmedMerchantID == "" {
		return nil, ErrPOSMerchantIDRequired
	}

	result, err := s.repo.GetScanResultByMerchantID(trimmedMerchantID)
	if err != nil {
		return nil, err
	}

	targetIP := strings.TrimSpace(result.IP)
	if targetIP == "" {
		return nil, ErrPOSDeviceIPMissing
	}
	if !result.IsOnline {
		return nil, ErrPOSDeviceOffline
	}

	return &POSAccessInfo{
		MerchantID:     trimmedMerchantID,
		IP:             targetIP,
		Port:           posHTTPPort,
		DirectURL:      fmt.Sprintf("http://%s:%d/", targetIP, posHTTPPort),
		ProxyURL:       fmt.Sprintf("/api/device/%s/pos-proxy/", trimmedMerchantID),
		PreferDirect:   true,
		IsOnline:       result.IsOnline,
		LastOnlineTime: result.LastOnlineTime,
	}, nil
}
