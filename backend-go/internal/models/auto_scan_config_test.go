package models

import (
	"reflect"
	"testing"
)

func TestAutoScanConfigCIDRBlocksRoundTrip(t *testing.T) {
	config := &AutoScanConfig{}
	input := []string{"192.168.1.0/24", "10.0.0.0/24"}

	if err := config.SetCIDRBlocks(input); err != nil {
		t.Fatalf("SetCIDRBlocks returned error: %v", err)
	}

	got, err := config.GetCIDRBlocks()
	if err != nil {
		t.Fatalf("GetCIDRBlocks returned error: %v", err)
	}

	if !reflect.DeepEqual(got, input) {
		t.Fatalf("GetCIDRBlocks = %v, want %v", got, input)
	}
}

func TestAutoScanConfigGetCIDRBlocksRejectsInvalidJSON(t *testing.T) {
	config := &AutoScanConfig{CIDRBlocksJSON: "not-json"}

	if _, err := config.GetCIDRBlocks(); err == nil {
		t.Fatalf("expected invalid json error")
	}
}
