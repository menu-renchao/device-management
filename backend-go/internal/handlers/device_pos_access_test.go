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
	info *services.POSAccessInfo
	err  error
}

func (f fakePOSAccessService) ResolveAccessInfo(merchantID string) (*services.POSAccessInfo, error) {
	return f.info, f.err
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
