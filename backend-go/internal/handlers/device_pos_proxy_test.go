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

	"device-management/internal/models"
	"device-management/internal/services"

	"github.com/gin-gonic/gin"
)

type fakeDeviceWebAccessLogRepo struct {
	logs []*models.DeviceWebAccessLog
	err  error
}

func (f *fakeDeviceWebAccessLogRepo) Create(log *models.DeviceWebAccessLog) error {
	f.logs = append(f.logs, log)
	return f.err
}

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

func TestPOSProxyRewritesLocationAndCookiePath(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "sid", Value: "abc", Path: "/"})
		w.Header().Set("Location", "http://192.168.1.50:22080/login")
		w.WriteHeader(http.StatusFound)
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	server := httptest.NewServer(router)
	defer server.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(server.URL + "/device/M123/pos-proxy/")
	if err != nil {
		t.Fatalf("client.Get() error = %v", err)
	}
	defer resp.Body.Close()

	location := resp.Header.Get("Location")
	if location != "/api/device/M123/pos-proxy/login" {
		t.Fatalf("unexpected location: %s", location)
	}

	cookies := resp.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookie count = %d, want 1", len(cookies))
	}
	if cookies[0].Path != "/api/device/M123/pos-proxy/" {
		t.Fatalf("unexpected cookie path: %s", cookies[0].Path)
	}
}

func TestPOSProxyPreservesTokenInRedirectLocation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "/login?next=%2Fdashboard")
		w.WriteHeader(http.StatusFound)
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	server := httptest.NewServer(router)
	defer server.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(server.URL + "/device/M123/pos-proxy/?token=test-token")
	if err != nil {
		t.Fatalf("client.Get() error = %v", err)
	}
	defer resp.Body.Close()

	location := resp.Header.Get("Location")
	if location != "/api/device/M123/pos-proxy/login?next=%2Fdashboard&token=test-token" {
		t.Fatalf("unexpected location: %s", location)
	}
}

func TestPOSProxyRewritesHTMLRootRelativePaths(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><link href="/css/app.css"><script src="/js/app.js"></script><form action="/login"></form></html>`))
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

	bodyText := string(body)
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/css/app.css`) {
		t.Fatalf("expected rewritten css path, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/js/app.js`) {
		t.Fatalf("expected rewritten script path, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/login`) {
		t.Fatalf("expected rewritten form action, got %s", bodyText)
	}
}

func TestPOSProxyRewritesHTMLRootRelativePathsWithToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><link href="/css/app.css"><script src="/js/app.js"></script><form action="/login"></form></html>`))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := http.Get(server.URL + "/device/M123/pos-proxy/?token=test-token")
	if err != nil {
		t.Fatalf("http.Get() error = %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	bodyText := string(body)
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/css/app.css?token=test-token`) {
		t.Fatalf("expected rewritten css path with token, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/js/app.js?token=test-token`) {
		t.Fatalf("expected rewritten script path with token, got %s", bodyText)
	}
	if !strings.Contains(bodyText, `/api/device/M123/pos-proxy/login?token=test-token`) {
		t.Fatalf("expected rewritten form action with token, got %s", bodyText)
	}
}

func TestPOSProxyWritesAccessLog(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>ok</html>"))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	logRepo := &fakeDeviceWebAccessLogRepo{}
	handler.deviceWebAccessLogRepo = logRepo

	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := http.Get(server.URL + "/device/M123/pos-proxy/")
	if err != nil {
		t.Fatalf("http.Get() error = %v", err)
	}
	defer resp.Body.Close()

	if len(logRepo.logs) != 1 {
		t.Fatalf("expected one access log, got %d", len(logRepo.logs))
	}
	if logRepo.logs[0].MerchantID != "M123" {
		t.Fatalf("unexpected merchant id in log: %s", logRepo.logs[0].MerchantID)
	}
	if logRepo.logs[0].StatusCode != http.StatusOK {
		t.Fatalf("unexpected status code in log: %d", logRepo.logs[0].StatusCode)
	}
}

func TestPOSProxySetsProxyCookieWhenQueryTokenPresent(t *testing.T) {
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

	resp, err := http.Get(server.URL + "/device/M123/pos-proxy/?token=test-token")
	if err != nil {
		t.Fatalf("http.Get() error = %v", err)
	}
	defer resp.Body.Close()

	cookies := resp.Cookies()
	foundTokenCookie := false
	foundMerchantCookie := false
	for _, cookie := range cookies {
		if cookie.Name == "pos_proxy_token" {
			foundTokenCookie = true
			if cookie.Value != "test-token" {
				t.Fatalf("unexpected cookie value: %s", cookie.Value)
			}
			if cookie.Path != "/api/device/M123/pos-proxy/" {
				t.Fatalf("unexpected cookie path: %s", cookie.Path)
			}
		}
	}

	if !foundTokenCookie || foundMerchantCookie {
		t.Fatalf("expected proxy cookies, got %#v", cookies)
	}
}

func TestPOSSubdomainProxyUsesHostMerchantID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/kpos/webapp/system/listSystemConfigurations" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.URL.RawQuery != "name=RESTAURANT_DISPLAY_MODE" {
			t.Fatalf("unexpected upstream query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	handler.posAccessService = fakePOSAccessService{
		hostMerchantID: "M123",
		info: &services.POSAccessInfo{
			MerchantID: "M123",
			IP:         handler.posAccessService.(fakePOSAccessService).info.IP,
			Port:       handler.posAccessService.(fakePOSAccessService).info.Port,
			DirectURL:  handler.posAccessService.(fakePOSAccessService).info.DirectURL,
			ProxyURL:   "https://m123.pos.example.com/",
			IsOnline:   true,
		},
	}
	router := gin.New()
	router.Any("/*path", withAuthenticatedUser(func(c *gin.Context) {
		merchantID, ok := handler.ResolvePOSProxyMerchantID(c.Request.Host)
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		handler.ProxyPOSSubdomain(c, merchantID)
	}))

	server := httptest.NewServer(router)
	defer server.Close()

	req, err := http.NewRequest(http.MethodGet, server.URL+"/kpos/webapp/system/listSystemConfigurations?name=RESTAURANT_DISPLAY_MODE", nil)
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	req.Host = "m123.pos.example.com"

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestPOSSubdomainProxyDoesNotRewriteHTMLWithTokenQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><link href="/css/app.css"><script src="/js/app.js"></script><form action="/login"></form></html>`))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	handler.posAccessService = fakePOSAccessService{
		hostMerchantID: "M123",
		info: &services.POSAccessInfo{
			MerchantID: "M123",
			IP:         handler.posAccessService.(fakePOSAccessService).info.IP,
			Port:       handler.posAccessService.(fakePOSAccessService).info.Port,
			DirectURL:  handler.posAccessService.(fakePOSAccessService).info.DirectURL,
			ProxyURL:   "https://m123-pos.example.com/",
			IsOnline:   true,
		},
	}

	router := gin.New()
	router.Any("/*path", withAuthenticatedUser(func(c *gin.Context) {
		merchantID, ok := handler.ResolvePOSProxyMerchantID(c.Request.Host)
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		handler.ProxyPOSSubdomain(c, merchantID)
	}))

	server := httptest.NewServer(router)
	defer server.Close()

	req, err := http.NewRequest(http.MethodGet, server.URL+"/?token=test-token", nil)
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	req.Host = "m123-pos.example.com"

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	bodyText := string(body)
	if strings.Contains(bodyText, "token=test-token") {
		t.Fatalf("unexpected token rewrite in subdomain html: %s", bodyText)
	}

	foundTokenCookie := false
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "pos_proxy_token" {
			foundTokenCookie = true
			if cookie.Path != "/" {
				t.Fatalf("unexpected token cookie path: %s", cookie.Path)
			}
		}
	}
	if !foundTokenCookie {
		t.Fatalf("expected pos_proxy_token cookie, got %#v", resp.Cookies())
	}
}

func TestPOSSubdomainProxyDoesNotRewriteRedirectWithTokenQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "/login?next=%2Fdashboard")
		w.WriteHeader(http.StatusFound)
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	handler.posAccessService = fakePOSAccessService{
		hostMerchantID: "M123",
		info: &services.POSAccessInfo{
			MerchantID: "M123",
			IP:         handler.posAccessService.(fakePOSAccessService).info.IP,
			Port:       handler.posAccessService.(fakePOSAccessService).info.Port,
			DirectURL:  handler.posAccessService.(fakePOSAccessService).info.DirectURL,
			ProxyURL:   "https://m123-pos.example.com/",
			IsOnline:   true,
		},
	}

	router := gin.New()
	router.Any("/*path", withAuthenticatedUser(func(c *gin.Context) {
		merchantID, ok := handler.ResolvePOSProxyMerchantID(c.Request.Host)
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		handler.ProxyPOSSubdomain(c, merchantID)
	}))

	server := httptest.NewServer(router)
	defer server.Close()

	req, err := http.NewRequest(http.MethodGet, server.URL+"/?token=test-token", nil)
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	req.Host = "m123-pos.example.com"

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()

	location := resp.Header.Get("Location")
	if location != "/login?next=%2Fdashboard" {
		t.Fatalf("unexpected redirect location: %s", location)
	}
}

func TestPOSSubdomainProxyRewritesForeignCookieDomainToCurrentHost(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "licenseAuthKey=n565177kbbu2rrame7un5rk4p; Domain=192.168.0.72; Path=/kpos")
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(t, upstream.URL)
	handler.posAccessService = fakePOSAccessService{
		hostMerchantID: "M123",
		info: &services.POSAccessInfo{
			MerchantID: "M123",
			IP:         handler.posAccessService.(fakePOSAccessService).info.IP,
			Port:       handler.posAccessService.(fakePOSAccessService).info.Port,
			DirectURL:  handler.posAccessService.(fakePOSAccessService).info.DirectURL,
			ProxyURL:   "https://m123-pos.example.com/",
			IsOnline:   true,
		},
	}

	router := gin.New()
	router.Any("/*path", withAuthenticatedUser(func(c *gin.Context) {
		merchantID, ok := handler.ResolvePOSProxyMerchantID(c.Request.Host)
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		handler.ProxyPOSSubdomain(c, merchantID)
	}))

	server := httptest.NewServer(router)
	defer server.Close()

	req, err := http.NewRequest(http.MethodGet, server.URL+"/kpos/front2/myhome.html?token=test-token", nil)
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	req.Host = "m123-pos.example.com"

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()

	setCookieHeaders := resp.Header.Values("Set-Cookie")
	if len(setCookieHeaders) == 0 {
		t.Fatalf("expected set-cookie header")
	}

	var found bool
	for _, header := range setCookieHeaders {
		if strings.Contains(header, "licenseAuthKey=") {
			found = true
			if strings.Contains(strings.ToLower(header), "domain=192.168.0.72") {
				t.Fatalf("expected foreign domain to be removed, got %s", header)
			}
			if !strings.Contains(header, "Path=/kpos") {
				t.Fatalf("expected original kpos path preserved, got %s", header)
			}
		}
	}

	if !found {
		t.Fatalf("expected licenseAuthKey set-cookie, got %#v", setCookieHeaders)
	}
}
