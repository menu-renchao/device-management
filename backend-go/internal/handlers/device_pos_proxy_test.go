package handlers

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	neturl "net/url"
	"strings"
	"testing"

	"device-management/internal/services"

	"github.com/gin-gonic/gin"
)

func newProxyHandlerPointingTo(t *testing.T, upstreamURL string) *DeviceHandler {
	t.Helper()

	parsedURL, err := neturl.Parse(upstreamURL)
	if err != nil {
		t.Fatalf("Parse(%q) error = %v", upstreamURL, err)
	}

	host, portText, err := net.SplitHostPort(parsedURL.Host)
	if err != nil {
		t.Fatalf("SplitHostPort(%q) error = %v", parsedURL.Host, err)
	}

	port := 0
	if _, err := fmt.Sscanf(portText, "%d", &port); err != nil {
		t.Fatalf("Sscanf(%q) error = %v", portText, err)
	}

	return &DeviceHandler{
		posAccessService: fakePOSAccessService{
			info: &services.POSAccessInfo{
				MerchantID: "M123",
				IP:         host,
				Port:       port,
				DirectURL:  upstreamURL + "/",
				ProxyURL:   "/api/device/M123/pos-proxy/",
				IsOnline:   true,
			},
		},
	}
}

func TestPOSProxyForwardsHTMLResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>ok</html>"))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := http.Get(server.URL + "/device/M123/pos-proxy/")
	if err != nil {
		t.Fatalf("http.Get() error = %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if !strings.Contains(string(body), "ok") {
		t.Fatalf("unexpected body: %s", string(body))
	}
}
