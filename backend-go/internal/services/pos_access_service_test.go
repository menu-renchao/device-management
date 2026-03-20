package services

import (
	"testing"
	"time"

	"device-management/internal/models"
)

type fakePOSDeviceLookup struct {
	result *models.ScanResult
	err    error
}

func (f fakePOSDeviceLookup) GetScanResultByMerchantID(merchantID string) (*models.ScanResult, error) {
	return f.result, f.err
}

func TestResolveAccessInfoBuildsDirectAndProxyURLs(t *testing.T) {
	now := time.Date(2026, 3, 20, 10, 20, 30, 0, time.FixedZone("CST", 8*60*60))
	repo := fakePOSDeviceLookup{
		result: &models.ScanResult{
			IP:             "192.168.1.50",
			MerchantID:     testStringPtr("M123"),
			IsOnline:       true,
			LastOnlineTime: now,
		},
	}

	svc := NewPOSAccessService(repo)

	info, err := svc.ResolveAccessInfo("M123")
	if err != nil {
		t.Fatalf("ResolveAccessInfo returned error: %v", err)
	}

	if info.DirectURL != "http://192.168.1.50:22080/" {
		t.Fatalf("unexpected direct url: %s", info.DirectURL)
	}

	if info.ProxyURL != "/api/device/M123/pos-proxy/" {
		t.Fatalf("unexpected proxy url: %s", info.ProxyURL)
	}

	if !info.LastOnlineTime.Equal(now) {
		t.Fatalf("unexpected last online time: %v", info.LastOnlineTime)
	}
}

func TestResolveAccessInfoRejectsOfflineDevice(t *testing.T) {
	repo := fakePOSDeviceLookup{
		result: &models.ScanResult{
			IP:         "192.168.1.50",
			MerchantID: testStringPtr("M123"),
			IsOnline:   false,
		},
	}

	svc := NewPOSAccessService(repo)

	_, err := svc.ResolveAccessInfo("M123")
	if err == nil {
		t.Fatal("expected offline device error")
	}
}

func TestValidatePOSTargetRejectsPublicIP(t *testing.T) {
	if err := validatePOSTarget("8.8.8.8", 22080); err == nil {
		t.Fatal("expected public ip to be rejected")
	}
}

func TestValidatePOSTargetRejectsUnexpectedPort(t *testing.T) {
	if err := validatePOSTarget("192.168.1.50", 8080); err == nil {
		t.Fatal("expected unexpected port to be rejected")
	}
}

func testStringPtr(value string) *string {
	return &value
}
