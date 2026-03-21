package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"device-management/internal/services"

	"github.com/gin-gonic/gin"
)

type fakePOSAccessService struct {
	info           *services.POSAccessInfo
	err            error
	hostMerchantID string
}

func (f fakePOSAccessService) ResolveAccessInfo(merchantID string) (*services.POSAccessInfo, error) {
	return f.info, f.err
}

func (f fakePOSAccessService) ResolveMerchantIDFromProxyHost(host string) (string, bool) {
	if f.hostMerchantID == "" {
		return "", false
	}
	return f.hostMerchantID, true
}

func TestGetPOSAccessReturnsURLs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	lastOnlineTime := time.Date(2026, 3, 20, 10, 20, 30, 0, time.FixedZone("CST", 8*60*60))
	handler := &DeviceHandler{
		posAccessService: fakePOSAccessService{
			info: &services.POSAccessInfo{
				MerchantID:     "M123",
				IP:             "192.168.1.50",
				Port:           22080,
				DirectURL:      "http://192.168.1.50:22080/",
				ProxyURL:       "/api/device/M123/pos-proxy/",
				PreferDirect:   true,
				IsOnline:       true,
				LastOnlineTime: lastOnlineTime,
			},
		},
	}

	router := gin.New()
	router.GET("/device/:merchant_id/pos-access", withAuthenticatedUser(handler.GetPOSAccess))

	req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-access", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestPreparePOSProxySessionSetsHttpOnlyCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &DeviceHandler{
		posAccessService: fakePOSAccessService{
			info: &services.POSAccessInfo{
				MerchantID: "M123",
				IP:         "192.168.1.50",
				Port:       22080,
				DirectURL:  "http://192.168.1.50:22080/",
				ProxyURL:   "/api/device/M123/pos-proxy/",
				IsOnline:   true,
			},
		},
	}

	router := gin.New()
	router.POST("/device/:merchant_id/pos-proxy-session", withAuthenticatedUser(handler.PreparePOSProxySession))

	req := httptest.NewRequest(http.MethodPost, "/device/M123/pos-proxy-session", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie to be set")
	}

	found := false
	for _, cookie := range cookies {
		if cookie.Name != "pos_proxy_token" {
			continue
		}
		found = true
		if cookie.Value != "test-auth-token" {
			t.Fatalf("unexpected cookie value: %s", cookie.Value)
		}
		if cookie.Path != "/api/device/M123/pos-proxy/" {
			t.Fatalf("unexpected cookie path: %s", cookie.Path)
		}
		if !cookie.HttpOnly {
			t.Fatal("expected cookie to be HttpOnly")
		}
	}

	if !found {
		t.Fatalf("expected pos_proxy_token cookie, got %#v", cookies)
	}
}

func TestPreparePOSProxySessionSetsSharedDomainCookieForSubdomainProxy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &DeviceHandler{
		posAccessService: fakePOSAccessService{
			info: &services.POSAccessInfo{
				MerchantID: "M123",
				IP:         "192.168.1.50",
				Port:       22080,
				DirectURL:  "http://192.168.1.50:22080/",
				ProxyURL:   "http://m123.pos.menusifu.cloud:5000/",
				IsOnline:   true,
			},
		},
	}

	router := gin.New()
	router.POST("/device/:merchant_id/pos-proxy-session", withAuthenticatedUser(handler.PreparePOSProxySession))

	req := httptest.NewRequest(http.MethodPost, "/device/M123/pos-proxy-session", nil)
	req.Host = "device.menusifu.cloud:3000"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie to be set")
	}

	found := false
	for _, cookie := range cookies {
		if cookie.Name != "pos_proxy_token" {
			continue
		}
		found = true
		if cookie.Value != "test-auth-token" {
			t.Fatalf("unexpected cookie value: %s", cookie.Value)
		}
		if cookie.Path != "/" {
			t.Fatalf("unexpected cookie path: %s", cookie.Path)
		}
		if cookie.Domain != "menusifu.cloud" {
			t.Fatalf("unexpected cookie domain: %s", cookie.Domain)
		}
		if !cookie.HttpOnly {
			t.Fatal("expected cookie to be HttpOnly")
		}
	}

	if !found {
		t.Fatalf("expected pos_proxy_token cookie, got %#v", cookies)
	}
}

func TestPOSProxySessionRouteDoesNotConflictWithProxyWildcard(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &DeviceHandler{}
	router := gin.New()

	router.POST("/device/:merchant_id/pos-proxy-session", withAuthenticatedUser(handler.PreparePOSProxySession))
	router.Any("/device/:merchant_id/pos-proxy", withAuthenticatedUser(handler.ProxyPOS))
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))
}
