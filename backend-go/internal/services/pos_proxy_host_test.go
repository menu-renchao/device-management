package services

import "testing"

func TestBuildPOSProxyURLUsesTemplate(t *testing.T) {
	resolver, err := NewPOSProxyHostResolver("https://{merchant_id}.pos.example.com")
	if err != nil {
		t.Fatalf("NewPOSProxyHostResolver() error = %v", err)
	}

	proxyURL, ok := resolver.BuildURL("M000021195")
	if !ok {
		t.Fatal("expected build to succeed")
	}

	if proxyURL != "https://m000021195.pos.example.com/" {
		t.Fatalf("unexpected proxy url: %s", proxyURL)
	}
}

func TestResolveMerchantIDFromHost(t *testing.T) {
	resolver, err := NewPOSProxyHostResolver("https://{merchant_id}.pos.example.com:3000")
	if err != nil {
		t.Fatalf("NewPOSProxyHostResolver() error = %v", err)
	}

	merchantID, ok := resolver.ResolveMerchantID("m000021195.pos.example.com:3000")
	if !ok {
		t.Fatal("expected host match")
	}

	if merchantID != "M000021195" {
		t.Fatalf("unexpected merchant id: %s", merchantID)
	}
}
