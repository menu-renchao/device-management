package services

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestNormalizeCIDRBlocksDeduplicatesAndTrims(t *testing.T) {
	got, err := normalizeCIDRBlocks([]string{" 192.168.1.0/24 ", "192.168.1.0/24", "10.0.0.0/24"})
	if err != nil {
		t.Fatalf("normalizeCIDRBlocks returned error: %v", err)
	}

	want := []string{"10.0.0.0/24", "192.168.1.0/24"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeCIDRBlocks = %v, want %v", got, want)
	}
}

func TestValidateCIDRBlocksRejectsInvalidCIDR(t *testing.T) {
	err := validateCIDRBlocks([]string{"192.168.1.0/24", "bad-cidr"})
	if err == nil {
		t.Fatalf("expected invalid CIDR error")
	}
}

func TestValidateCIDRBlocksRejectsTooManyHosts(t *testing.T) {
	err := validateCIDRBlocks([]string{"10.0.0.0/16"})
	if err == nil {
		t.Fatalf("expected host limit error")
	}
}

func TestRunScanWithConfigRejectsConcurrentRuns(t *testing.T) {
	service := NewScanService()
	service.status.IsScanning = true

	err := service.RunScanWithConfig(ScanRunConfig{
		TriggerType: "auto",
		CIDRBlocks:  []string{"192.168.1.0/24"},
	}, nil)
	if err == nil {
		t.Fatalf("expected concurrent run error")
	}
	if !strings.Contains(err.Error(), "scan already in progress") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRunScanWithConfigStartsScanWithNormalizedCIDRs(t *testing.T) {
	service := NewScanService()
	started := make(chan ScanRunConfig, 1)
	release := make(chan struct{})
	service.performScanFunc = func(_ context.Context, cfg ScanRunConfig, _ func(map[string]interface{})) {
		started <- cfg
		<-release
	}

	err := service.RunScanWithConfig(ScanRunConfig{
		TriggerType: "auto",
		CIDRBlocks:  []string{" 192.168.1.0/24 ", "192.168.1.0/24"},
	}, nil)
	if err != nil {
		t.Fatalf("RunScanWithConfig returned error: %v", err)
	}

	select {
	case cfg := <-started:
		want := []string{"192.168.1.0/24"}
		if !reflect.DeepEqual(cfg.CIDRBlocks, want) {
			t.Fatalf("CIDRBlocks = %v, want %v", cfg.CIDRBlocks, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for scan start")
	}

	status := service.GetStatus()
	if !status.IsScanning {
		t.Fatalf("expected status to show scanning")
	}

	close(release)
}
