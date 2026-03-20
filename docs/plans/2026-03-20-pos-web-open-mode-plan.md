# POS Web Open Mode Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a Go-backed POS reverse proxy and a per-user frontend open mode so users can open POS pages by direct LAN mode or server proxy mode through one `打开` action, without hardcoding the public access address.

**Architecture:** Nginx remains the public ingress, while Go resolves `merchantId -> current POS IP` and proxies requests to `http://<ip>:22080`. The frontend adds a per-user global open mode preference and uses one `打开` button to choose between `directUrl` and `proxyUrl`. Any public host/domain information must come from configuration rather than hardcoded IP values.

**Tech Stack:** Go, Gin, GORM, SQLite, net/http/httputil, React, Axios, Vite

---

### Task 1: Add POS access resolution service

**Files:**
- Create: `backend-go/internal/services/pos_access_service.go`
- Create: `backend-go/internal/services/pos_access_service_test.go`
- Modify: `backend-go/internal/repository/device_repo.go`
- Modify: `backend-go/internal/config/config.go` or the active server config definition file

**Step 1: Write the failing test**

```go
func TestResolveAccessInfoBuildsDirectAndProxyURLs(t *testing.T) {
	repo := fakePOSDeviceLookup{
		result: &models.ScanResult{
			IP:         "192.168.1.50",
			MerchantID: stringPtr("M123"),
			IsOnline:   true,
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
}

func TestResolveAccessInfoRejectsOfflineDevice(t *testing.T) {
	repo := fakePOSDeviceLookup{
		result: &models.ScanResult{
			IP:         "192.168.1.50",
			MerchantID: stringPtr("M123"),
			IsOnline:   false,
		},
	}

	svc := NewPOSAccessService(repo)

	_, err := svc.ResolveAccessInfo("M123")
	if err == nil {
		t.Fatal("expected offline device error")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestResolveAccessInfo -v`

Expected: FAIL with missing `NewPOSAccessService` or missing symbols.

**Step 3: Write minimal implementation**

Create `POSAccessInfo`, `POSDeviceLookup`, and `POSAccessService` in `backend-go/internal/services/pos_access_service.go`.

Add a repository lookup in `backend-go/internal/repository/device_repo.go`:

```go
func (r *DeviceRepository) GetScanResultByMerchantID(merchantID string) (*models.ScanResult, error)
```

Implement resolution rules:

- require non-empty `merchantId`
- fetch scan result by `merchantId`
- require non-empty IP
- require `IsOnline == true`
- build `DirectURL` with fixed port `22080`
- build `ProxyURL` with `/api/device/:merchantId/pos-proxy/`
- add a configurable public-base setting for future domain access, while keeping `ProxyURL` frontend-safe as a relative path

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestResolveAccessInfo -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_access_service.go backend-go/internal/services/pos_access_service_test.go backend-go/internal/repository/device_repo.go backend-go/internal/config/config.go
git commit -m "feat: add pos access resolution service"
```

### Task 2: Add target validation and transport configuration

**Files:**
- Modify: `backend-go/internal/services/pos_access_service.go`
- Modify: `backend-go/internal/services/pos_access_service_test.go`

**Step 1: Write the failing test**

```go
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
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestValidatePOSTarget -v`

Expected: FAIL with missing `validatePOSTarget`.

**Step 3: Write minimal implementation**

Add validation helpers in `backend-go/internal/services/pos_access_service.go`:

```go
func validatePOSTarget(ip string, port int) error
func isPrivateIPv4(ip string) bool
func newPOSTransport() *http.Transport
```

Rules:

- only allow private IPv4 targets
- reject loopback, link-local, and public addresses
- only allow port `22080`
- create one shared proxy transport with connection reuse and timeouts

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestValidatePOSTarget -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_access_service.go backend-go/internal/services/pos_access_service_test.go
git commit -m "test: cover pos target validation"
```

### Task 3: Add POS access metadata endpoint

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Create: `backend-go/internal/handlers/device_pos_access_test.go`

**Step 1: Write the failing test**

```go
func TestGetPOSAccessReturnsURLs(t *testing.T) {
	router := gin.New()
	handler := &DeviceHandler{
		posAccessService: fakePOSAccessService{
			info: &services.POSAccessInfo{
				MerchantID:   "M123",
				IP:           "192.168.1.50",
				Port:         22080,
				DirectURL:    "http://192.168.1.50:22080/",
				ProxyURL:     "/api/device/M123/pos-proxy/",
				PreferDirect: true,
				IsOnline:     true,
			},
		},
	}

	router.GET("/device/:merchant_id/pos-access", withAuthenticatedUser(handler.GetPOSAccess))

	req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-access", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestGetPOSAccessReturnsURLs -v`

Expected: FAIL with missing handler method or dependency field.

**Step 3: Write minimal implementation**

Update `DeviceHandler` in `backend-go/internal/handlers/device.go` to accept a POS access dependency and add:

```go
func (h *DeviceHandler) GetPOSAccess(c *gin.Context)
```

Return shape:

```go
response.Success(c, gin.H{
	"merchantId": info.MerchantID,
	"ip": info.IP,
	"port": info.Port,
	"directUrl": info.DirectURL,
	"proxyUrl": info.ProxyURL,
	"preferDirect": info.PreferDirect,
	"isOnline": info.IsOnline,
	"lastOnlineTime": info.LastOnlineTime,
})
```

Register the route in `backend-go/cmd/server/main.go`:

```go
device.GET("/:merchant_id/pos-access", deviceHandler.GetPOSAccess)
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestGetPOSAccessReturnsURLs -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_access_test.go backend-go/cmd/server/main.go
git commit -m "feat: add pos access metadata endpoint"
```

### Task 4: Add basic POS reverse proxy endpoint

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Create: `backend-go/internal/handlers/device_pos_proxy_test.go`

**Step 1: Write the failing test**

```go
func TestPOSProxyForwardsHTMLResponse(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>ok</html>"))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-proxy/", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ok") {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestPOSProxyForwardsHTMLResponse -v`

Expected: FAIL with missing `ProxyPOS`.

**Step 3: Write minimal implementation**

Add in `backend-go/internal/handlers/device.go`:

```go
func (h *DeviceHandler) ProxyPOS(c *gin.Context)
```

Implementation requirements:

- require login
- resolve target via `merchantId`
- create `httputil.ReverseProxy`
- forward request path and query
- reuse shared transport
- return `502` on upstream failure

Register routes in `backend-go/cmd/server/main.go`:

```go
device.Any("/:merchant_id/pos-proxy", deviceHandler.ProxyPOS)
device.Any("/:merchant_id/pos-proxy/*path", deviceHandler.ProxyPOS)
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestPOSProxyForwardsHTMLResponse -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_proxy_test.go backend-go/cmd/server/main.go
git commit -m "feat: add pos reverse proxy endpoint"
```

### Task 5: Add redirect and cookie-path rewriting

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/device_pos_proxy_test.go`

**Step 1: Write the failing test**

```go
func TestPOSProxyRewritesLocationAndCookiePath(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "sid", Value: "abc", Path: "/"})
		w.Header().Set("Location", "http://192.168.1.50:22080/login")
		w.WriteHeader(http.StatusFound)
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-proxy/", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	location := rec.Header().Get("Location")
	if location != "/api/device/M123/pos-proxy/login" {
		t.Fatalf("unexpected location: %s", location)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestPOSProxyRewritesLocationAndCookiePath -v`

Expected: FAIL because rewrite behavior is missing.

**Step 3: Write minimal implementation**

Update proxy response handling in `backend-go/internal/handlers/device.go`:

- rewrite root-relative or absolute POS `Location` values to the proxy prefix
- rewrite `Set-Cookie` path from `/` to `/api/device/:merchantId/pos-proxy/`

Keep rewrite logic isolated in small helper functions.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestPOSProxyRewritesLocationAndCookiePath -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_proxy_test.go
git commit -m "feat: rewrite pos proxy redirects and cookie paths"
```

### Task 6: Add minimal HTML root-path rewriting

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/device_pos_proxy_test.go`

**Step 1: Write the failing test**

```go
func TestPOSProxyRewritesHTMLRootRelativePaths(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><link href="/css/app.css"><form action="/login"></form></html>`))
	}))
	defer upstream.Close()

	handler := newProxyHandlerPointingTo(upstream.URL)
	router := gin.New()
	router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

	req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-proxy/", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, `/api/device/M123/pos-proxy/css/app.css`) {
		t.Fatalf("expected rewritten asset path, got %s", body)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestPOSProxyRewritesHTMLRootRelativePaths -v`

Expected: FAIL because HTML rewriting is missing.

**Step 3: Write minimal implementation**

Add a narrow HTML response rewrite path in `backend-go/internal/handlers/device.go`:

- only run for `Content-Type` starting with `text/html`
- rewrite common root-relative `href`, `src`, and `action` values
- do not add a generic HTML parser unless the narrow rewrite proves insufficient

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestPOSProxyRewritesHTMLRootRelativePaths -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_proxy_test.go
git commit -m "feat: add minimal html rewrite for pos proxy"
```

### Task 7: Add proxied POS access logging

**Files:**
- Create: `backend-go/internal/models/device_web_access_log.go`
- Create: `backend-go/internal/repository/device_web_access_log_repo.go`
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test**

```go
func TestCreateDeviceWebAccessLog(t *testing.T) {
	db := newTestDB(t)
	repo := NewDeviceWebAccessLogRepository(db)

	err := repo.Create(&models.DeviceWebAccessLog{
		MerchantID: "M123",
		TargetIP:   "192.168.1.50",
		TargetPort: 22080,
		Method:     "GET",
		Path:       "/",
		StatusCode: 200,
		UserID:     1,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run TestCreateDeviceWebAccessLog -v`

Expected: FAIL with missing model or repository symbols.

**Step 3: Write minimal implementation**

Create `backend-go/internal/models/device_web_access_log.go` and `backend-go/internal/repository/device_web_access_log_repo.go`.

Log fields should include:

- `MerchantID`
- `TargetIP`
- `TargetPort`
- `Method`
- `Path`
- `StatusCode`
- `UserID`
- `ClientIP`
- `DurationMs`
- `ErrorMessage`

Register the model in `backend-go/cmd/server/main.go` auto-migrate list and write logs from the proxy handler.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run TestCreateDeviceWebAccessLog -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/models/device_web_access_log.go backend-go/internal/repository/device_web_access_log_repo.go backend-go/internal/handlers/device.go backend-go/cmd/server/main.go
git commit -m "feat: add pos proxy access logging"
```

### Task 8: Add frontend per-user open mode state

**Files:**
- Create: `frontend/src/pages/posOpenMode.js`
- Create: `frontend/src/pages/posOpenMode.test.js`

**Step 1: Write the failing test**

```js
import { getPOSOpenModeStorageKey, normalizePOSOpenMode } from './posOpenMode';

test('builds per-user storage key', () => {
  expect(getPOSOpenModeStorageKey(12)).toBe('scan_page_pos_open_mode_12');
});

test('normalizes invalid mode to direct', () => {
  expect(normalizePOSOpenMode('bad')).toBe('direct');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- posOpenMode.test.js`

Workdir: `frontend`

Expected: FAIL with missing module.

**Step 3: Write minimal implementation**

Create `frontend/src/pages/posOpenMode.js`:

```js
export function getPOSOpenModeStorageKey(userId) {
  return `scan_page_pos_open_mode_${userId || 'default'}`;
}

export function normalizePOSOpenMode(value) {
  return value === 'proxy' ? 'proxy' : 'direct';
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- posOpenMode.test.js`

Workdir: `frontend`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/posOpenMode.js frontend/src/pages/posOpenMode.test.js
git commit -m "feat: add pos open mode helpers"
```

### Task 9: Integrate open mode and POS access API into the scan page

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/components/ScanTable.jsx`

**Step 1: Write the failing test**

If the current frontend test surface is too thin for component interaction, add a small pure-function assertion around open-mode selection and use the production build as the integration verification for this task.

Add or extend a helper assertion so that one mode maps to one output URL:

```js
test('proxy mode chooses proxy url', () => {
  const result = choosePOSOpenUrl({
    mode: 'proxy',
    directUrl: 'http://192.168.1.50:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  });

  expect(result).toBe('/api/device/M123/pos-proxy/');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- posOpenMode.test.js`

Workdir: `frontend`

Expected: FAIL before integration helper exists.

**Step 3: Write minimal implementation**

In `frontend/src/services/api.js`, add:

```js
getPosAccess: async (merchantId) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get(`/device/${encodeURIComponent(merchantId)}/pos-access`);
  return response.data;
}
```

In `frontend/src/pages/ScanPage.jsx`:

- load the per-user default mode from local storage
- render the mode selector in the toolbar
- update `handleOpenDevice` to accept the whole device object
- fetch POS access metadata before opening
- open either `directUrl` or `proxyUrl` based on the selected mode

In `frontend/src/components/ScanTable.jsx`:

- pass the whole `device` to `onOpenDevice`
- keep a single `打开` button only

**Step 4: Run build to verify it passes**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/ScanPage.jsx frontend/src/components/ScanTable.jsx frontend/src/pages/posOpenMode.js frontend/src/pages/posOpenMode.test.js
git commit -m "feat: add per-user pos open mode to scan page"
```

### Task 10: End-to-end verification and compatibility fixes

**Files:**
- Modify: `backend-go/internal/handlers/device.go` as needed
- Modify: `frontend/src/pages/ScanPage.jsx` as needed
- Modify: `docs/plans/2026-03-20-pos-web-open-mode-plan.md` if implementation notes need to be updated

**Step 1: Run backend tests**

Run: `go test ./...`

Workdir: `backend-go`

Expected: all tests pass

**Step 2: Run frontend build**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 3: Manual verification**

1. Log in from an inner-network environment and set default open mode to `直连`
2. Open a POS and confirm the browser opens `http://<ip>:22080/`
3. Log in from an outer-network environment and set default open mode to `代理`
4. Open a POS and confirm the browser opens `/api/device/:merchantId/pos-proxy/`
5. Validate POS page navigation, form submissions, and redirect flows
6. Validate proxy logs record merchant, target IP, user, status, and duration
7. Validate that changing the configured public base URL for future domain access does not require code changes in proxy behavior

**Step 4: Fix only observed compatibility issues**

Only patch real failures observed in manual verification, such as:

- missing root-path rewrite cases
- incorrect `Location` rewrite behavior
- cookie path issues
- upstream timeout handling

Do not introduce a broad HTML rewrite engine without concrete evidence.

**Step 5: Commit**

```bash
git add backend-go frontend docs/plans/2026-03-20-pos-web-open-mode-plan.md
git commit -m "feat: complete pos web open mode flow"
```
