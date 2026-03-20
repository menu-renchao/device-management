package services

import (
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"device-management/internal/models"
)

const posHTTPPort = 22080

var (
	ErrPOSMerchantIDRequired = errors.New("merchant id is required")
	ErrPOSDeviceOffline      = errors.New("pos device is offline")
	ErrPOSDeviceIPMissing    = errors.New("pos device ip is missing")
	ErrPOSPublicIPNotAllowed = errors.New("pos target must be a private ipv4 address")
	ErrPOSPortNotAllowed     = errors.New("pos target port is not allowed")
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
	repo              POSDeviceLookup
	proxyHostResolver *POSProxyHostResolver
}

func NewPOSAccessService(repo POSDeviceLookup, proxyHostTemplate string) *POSAccessService {
	resolver, err := NewPOSProxyHostResolver(proxyHostTemplate)
	if err != nil {
		resolver = &POSProxyHostResolver{}
	}

	return &POSAccessService{
		repo:              repo,
		proxyHostResolver: resolver,
	}
}

func (s *POSAccessService) ResolveMerchantIDFromProxyHost(host string) (string, bool) {
	if s == nil || s.proxyHostResolver == nil {
		return "", false
	}
	return s.proxyHostResolver.ResolveMerchantID(host)
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
	if err := validatePOSTarget(targetIP, posHTTPPort); err != nil {
		return nil, err
	}

	proxyURL, ok := s.proxyHostResolver.BuildURL(trimmedMerchantID)
	if !ok {
		proxyURL = fmt.Sprintf("/api/device/%s/pos-proxy/", trimmedMerchantID)
	}

	return &POSAccessInfo{
		MerchantID:     trimmedMerchantID,
		IP:             targetIP,
		Port:           posHTTPPort,
		DirectURL:      fmt.Sprintf("http://%s:%d/", targetIP, posHTTPPort),
		ProxyURL:       proxyURL,
		PreferDirect:   true,
		IsOnline:       result.IsOnline,
		LastOnlineTime: result.LastOnlineTime,
	}, nil
}

func validatePOSTarget(ip string, port int) error {
	if port != posHTTPPort {
		return ErrPOSPortNotAllowed
	}
	if !isPrivateIPv4(ip) {
		return ErrPOSPublicIPNotAllowed
	}
	return nil
}

func isPrivateIPv4(ip string) bool {
	parsedIP := net.ParseIP(strings.TrimSpace(ip))
	if parsedIP == nil {
		return false
	}

	ipv4 := parsedIP.To4()
	if ipv4 == nil {
		return false
	}

	switch {
	case ipv4[0] == 10:
		return true
	case ipv4[0] == 172 && ipv4[1] >= 16 && ipv4[1] <= 31:
		return true
	case ipv4[0] == 192 && ipv4[1] == 168:
		return true
	default:
		return false
	}
}
