# POS Web Access Proxy Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 为 `device.menusifu.cloud` 增加按设备身份解析目标 IP 的 POS 页面访问能力，使内网用户优先直连，外网用户通过平台跳板访问内网 POS 页面。

**Architecture:** 在 Go 后端新增 POS 访问解析服务与反向代理入口，严格限制只代理已登记设备的内网 `22080` 端口，并记录访问审计。前端改造现有“打开设备”按钮，先获取访问元信息，再优先尝试局域网直连，失败后回退到平台代理地址，同时保留稳定的“通过平台访问”入口。

**Tech Stack:** Go, Gin, GORM, SQLite, React, Axios, Vite

---

### Task 1: 添加 POS 访问解析服务

**Files:**
- Create: `backend-go/internal/services/pos_access_service.go`
- Create: `backend-go/internal/services/pos_access_service_test.go`
- Modify: `backend-go/internal/repository/device_repo.go`

**Step 1: Write the failing test**

在 `backend-go/internal/services/pos_access_service_test.go` 新建最小测试，覆盖：

```go
func TestResolveAccessInfoBuildsDirectAndProxyURLs(t *testing.T) {
    svc := NewPOSAccessService(fakeDeviceRepo{
        result: &models.ScanResult{
            IP: "192.168.1.50",
            MerchantID: stringPtr("M123"),
            IsOnline: true,
        },
    }, "https://device.menusifu.cloud")

    info, err := svc.ResolveAccessInfo("M123")
    if err != nil {
        t.Fatalf("ResolveAccessInfo returned error: %v", err)
    }
    if info.DirectURL != "http://192.168.1.50:22080/" {
        t.Fatalf("unexpected direct url: %s", info.DirectURL)
    }
    if info.ProxyBaseURL != "https://device.menusifu.cloud/api/device/M123/pos-proxy/" {
        t.Fatalf("unexpected proxy url: %s", info.ProxyBaseURL)
    }
}

func TestResolveAccessInfoRejectsPublicIP(t *testing.T) {
    svc := NewPOSAccessService(fakeDeviceRepo{
        result: &models.ScanResult{
            IP: "8.8.8.8",
            MerchantID: stringPtr("M123"),
            IsOnline: true,
        },
    }, "https://device.menusifu.cloud")

    _, err := svc.ResolveAccessInfo("M123")
    if err == nil {
        t.Fatal("expected private network validation error")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestResolveAccessInfo -v`

Expected: FAIL with `undefined: NewPOSAccessService` or equivalent missing symbol errors.

**Step 3: Write minimal implementation**

在 `backend-go/internal/services/pos_access_service.go` 实现：

```go
type POSAccessInfo struct {
    MerchantID   string
    IP           string
    Port         int
    DirectURL    string
    ProxyBaseURL string
    PreferDirect bool
}

type POSDeviceLookup interface {
    GetScanResultByMerchantID(merchantID string) (*models.ScanResult, error)
}

type POSAccessService struct {
    repo       POSDeviceLookup
    publicBase string
}

func NewPOSAccessService(repo POSDeviceLookup, publicBase string) *POSAccessService
func (s *POSAccessService) ResolveAccessInfo(merchantID string) (*POSAccessInfo, error)
```

同时在 `device_repo.go` 里只补充当前任务真正需要的查询帮助函数，例如：

```go
func (r *DeviceRepository) GetOnlineScanResultByMerchantID(merchantID string) (*models.ScanResult, error)
```

`ResolveAccessInfo` 至少要完成：

- 校验 `merchantID` 非空
- 查到设备
- 校验 `IsOnline == true`
- 校验 `IP` 为 RFC1918 私网地址
- 端口固定为 `22080`
- 组装 `DirectURL` 和 `ProxyBaseURL`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestResolveAccessInfo -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_access_service.go backend-go/internal/services/pos_access_service_test.go backend-go/internal/repository/device_repo.go
git commit -m "feat: add pos access resolution service"
```

### Task 2: 补齐私网校验与端口白名单测试

**Files:**
- Modify: `backend-go/internal/services/pos_access_service.go`
- Modify: `backend-go/internal/services/pos_access_service_test.go`

**Step 1: Write the failing test**

在测试文件中继续增加：

```go
func TestValidateTargetRejectsLoopbackAndLinkLocal(t *testing.T) {
    for _, candidate := range []string{"127.0.0.1", "169.254.1.1"} {
        if err := validatePOSTarget(candidate, 22080); err == nil {
            t.Fatalf("expected %s to be rejected", candidate)
        }
    }
}

func TestValidateTargetRejectsNonWhitelistedPort(t *testing.T) {
    if err := validatePOSTarget("192.168.1.50", 8080); err == nil {
        t.Fatal("expected port whitelist error")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestValidateTarget -v`

Expected: FAIL with `undefined: validatePOSTarget`.

**Step 3: Write minimal implementation**

在 `pos_access_service.go` 增加：

```go
func validatePOSTarget(ip string, port int) error
func isPrivateIPv4(ip string) bool
```

规则固定为：

- 只允许 IPv4
- 只允许 `10/8`、`172.16/12`、`192.168/16`
- 拒绝回环、链路本地、组播、公网
- 端口只允许 `22080`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestValidateTarget -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_access_service.go backend-go/internal/services/pos_access_service_test.go
git commit -m "test: cover pos target validation rules"
```

### Task 3: 新增访问审计模型与仓库

**Files:**
- Create: `backend-go/internal/models/device_web_access_log.go`
- Create: `backend-go/internal/repository/device_web_access_log_repo.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test**

先给仓库写一个最小持久化测试：

```go
func TestCreateDeviceWebAccessLog(t *testing.T) {
    db := newTestDB(t)
    repo := NewDeviceWebAccessLogRepository(db)

    err := repo.Create(&models.DeviceWebAccessLog{
        MerchantID: "M123",
        TargetIP: "192.168.1.50",
        TargetPort: 22080,
        AccessMode: "proxy",
        UserID: 1,
        Status: "success",
    })
    if err != nil {
        t.Fatalf("Create returned error: %v", err)
    }
}
```

如果当前仓库没有统一仓库测试基座，可在同文件内最小创建 SQLite 内存库。

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run TestCreateDeviceWebAccessLog -v`

Expected: FAIL with missing model or repository symbols.

**Step 3: Write minimal implementation**

新增模型：

```go
type DeviceWebAccessLog struct {
    ID           uint      `gorm:"primaryKey"`
    MerchantID   string    `gorm:"size:100;index;not null"`
    TargetIP     string    `gorm:"size:50;not null"`
    TargetPort   int       `gorm:"not null"`
    AccessMode   string    `gorm:"size:16;not null"`
    UserID       uint      `gorm:"index;not null"`
    ClientIP     string    `gorm:"size:100"`
    Status       string    `gorm:"size:16;not null"`
    ErrorMessage string    `gorm:"type:text"`
    CreatedAt    time.Time
}
```

新增仓库：

```go
type DeviceWebAccessLogRepository struct { db *gorm.DB }

func NewDeviceWebAccessLogRepository(db *gorm.DB) *DeviceWebAccessLogRepository
func (r *DeviceWebAccessLogRepository) Create(log *models.DeviceWebAccessLog) error
```

并在 `main.go` 的数据库初始化处把新模型加入迁移。

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run TestCreateDeviceWebAccessLog -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/models/device_web_access_log.go backend-go/internal/repository/device_web_access_log_repo.go backend-go/cmd/server/main.go
git commit -m "feat: add pos web access audit log"
```

### Task 4: 增加访问元信息接口

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Create: `backend-go/internal/handlers/device_pos_access_test.go`

**Step 1: Write the failing test**

在 `device_pos_access_test.go` 新建：

```go
func TestGetPOSAccessReturnsURLs(t *testing.T) {
    router := gin.New()
    handler := &DeviceHandler{
        posAccessService: fakePOSAccessService{
            info: &services.POSAccessInfo{
                MerchantID: "M123",
                IP: "192.168.1.50",
                Port: 22080,
                DirectURL: "http://192.168.1.50:22080/",
                ProxyBaseURL: "https://device.menusifu.cloud/api/device/M123/pos-proxy/",
                PreferDirect: true,
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

Expected: FAIL with missing `GetPOSAccess` or missing dependency fields.

**Step 3: Write minimal implementation**

在 `device.go` 中：

- 给 `DeviceHandler` 加入 `posAccessService`
- 扩展 `NewDeviceHandler(...)`
- 新增：

```go
func (h *DeviceHandler) GetPOSAccess(c *gin.Context)
```

接口行为：

- 取 `merchant_id`
- 校验当前用户对设备的访问权限
- 调用 `ResolveAccessInfo`
- 返回：

```go
response.Success(c, gin.H{
    "merchantId": info.MerchantID,
    "ip": info.IP,
    "port": info.Port,
    "directUrl": info.DirectURL,
    "proxyBaseUrl": info.ProxyBaseURL,
    "preferDirect": info.PreferDirect,
})
```

同时在 `main.go` 注册：

```go
device.GET("/:merchant_id/pos-access", deviceHandler.GetPOSAccess)
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestGetPOSAccessReturnsURLs -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_access_test.go backend-go/cmd/server/main.go
git commit -m "feat: add pos access info endpoint"
```

### Task 5: 增加 POS 反向代理接口

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Create: `backend-go/internal/handlers/device_pos_proxy_test.go`

**Step 1: Write the failing test**

使用 `httptest.NewServer` 模拟 POS 页面：

```go
func TestPOSProxyForwardsResponse(t *testing.T) {
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

Run: `go test ./internal/handlers -run TestPOSProxyForwardsResponse -v`

Expected: FAIL with missing `ProxyPOS`.

**Step 3: Write minimal implementation**

在 `device.go` 中新增：

```go
func (h *DeviceHandler) ProxyPOS(c *gin.Context)
```

实现要求：

- 校验用户权限
- 调用 `ResolveAccessInfo`
- 用 `httputil.NewSingleHostReverseProxy` 转发到目标 `http://<ip>:22080`
- 把 `c.Param("path")` 拼到上游路径
- 透传查询参数
- 代理失败时返回 `502`

同时注册路由：

```go
device.Any("/:merchant_id/pos-proxy/*path", deviceHandler.ProxyPOS)
device.Any("/:merchant_id/pos-proxy", deviceHandler.ProxyPOS)
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestPOSProxyForwardsResponse -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_proxy_test.go backend-go/cmd/server/main.go
git commit -m "feat: add pos reverse proxy endpoint"
```

### Task 6: 记录代理访问审计并补失败路径测试

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/device_pos_proxy_test.go`
- Modify: `backend-go/internal/repository/device_web_access_log_repo.go`

**Step 1: Write the failing test**

继续补：

```go
func TestPOSProxyWritesFailureAuditLog(t *testing.T) {
    repo := &fakeAuditRepo{}
    handler := newProxyHandlerWithAuditRepo(repo)

    router := gin.New()
    router.Any("/device/:merchant_id/pos-proxy/*path", withAuthenticatedUser(handler.ProxyPOS))

    req := httptest.NewRequest(http.MethodGet, "/device/M123/pos-proxy/", nil)
    rec := httptest.NewRecorder()
    router.ServeHTTP(rec, req)

    if len(repo.logs) != 1 {
        t.Fatalf("expected one audit log, got %d", len(repo.logs))
    }
    if repo.logs[0].Status == "" {
        t.Fatal("expected status to be recorded")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestPOSProxyWritesFailureAuditLog -v`

Expected: FAIL because proxy path does not yet write logs.

**Step 3: Write minimal implementation**

在 `device.go` 的代理成功和失败分支分别写日志：

```go
_ = h.deviceWebAccessLogRepo.Create(&models.DeviceWebAccessLog{
    MerchantID: merchantID,
    TargetIP: targetIP,
    TargetPort: 22080,
    AccessMode: "proxy",
    UserID: middleware.GetUserID(c),
    ClientIP: c.ClientIP(),
    Status: "success",
})
```

失败分支写：

```go
Status: "failed",
ErrorMessage: err.Error(),
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestPOSProxyWritesFailureAuditLog -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/internal/handlers/device_pos_proxy_test.go backend-go/internal/repository/device_web_access_log_repo.go
git commit -m "feat: audit proxied pos web access"
```

### Task 7: 扩展前端 API 与访问决策纯函数

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/pages/posAccessState.js`
- Create: `frontend/src/pages/posAccessState.test.js`

**Step 1: Write the failing test**

在 `frontend/src/pages/posAccessState.test.js` 中增加：

```js
import { choosePOSAccessMode } from './posAccessState';

test('prefers direct when probe succeeds', async () => {
  const result = await choosePOSAccessMode({
    directUrl: 'http://192.168.1.50:22080/',
    proxyBaseUrl: 'https://device.menusifu.cloud/api/device/M123/pos-proxy/',
    probeDirect: async () => true,
  });

  expect(result).toEqual({
    mode: 'direct',
    url: 'http://192.168.1.50:22080/',
  });
});

test('falls back to proxy when direct probe fails', async () => {
  const result = await choosePOSAccessMode({
    directUrl: 'http://192.168.1.50:22080/',
    proxyBaseUrl: 'https://device.menusifu.cloud/api/device/M123/pos-proxy/',
    probeDirect: async () => false,
  });

  expect(result.mode).toBe('proxy');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- posAccessState.test.js`

Workdir: `frontend`

Expected: FAIL with `Cannot find module './posAccessState'` or missing export.

**Step 3: Write minimal implementation**

在 `posAccessState.js` 里实现：

```js
export async function choosePOSAccessMode({ directUrl, proxyBaseUrl, probeDirect }) {
  const canDirect = await probeDirect(directUrl);
  if (canDirect) {
    return { mode: 'direct', url: directUrl };
  }
  return { mode: 'proxy', url: proxyBaseUrl };
}
```

在 `api.js` 的 `deviceAPI` 里新增：

```js
getPosAccess: async (merchantId) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.get(`/device/${encodeURIComponent(merchantId)}/pos-access`);
  return response.data;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- posAccessState.test.js`

Workdir: `frontend`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/posAccessState.js frontend/src/pages/posAccessState.test.js
git commit -m "feat: add frontend pos access decision helpers"
```

### Task 8: 改造扫描页和设备表格入口

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/components/ScanTable.jsx`

**Step 1: Write the failing test**

如果当前表格组件没有可行的交互测试基座，就先给纯函数补测试，并在本任务内通过构建验证代替组件级单测。新增一个小范围断言到 `frontend/src/components/scanTableState.test.js` 或 `frontend/src/pages/posAccessState.test.js`，保证“无 merchantId 时不显示代理入口”的派生逻辑。

**Step 2: Run test to verify it fails**

Run: `npm test -- posAccessState.test.js`

Workdir: `frontend`

Expected: FAIL before新增派生逻辑实现。

**Step 3: Write minimal implementation**

在 `ScanPage.jsx`：

- 删除固定 `window.open(\`http://${ip}:22080\`)`
- 新增：

```js
const openPOSDevice = async (device, forceProxy = false) => {
  const result = await deviceAPI.getPosAccess(device.merchantId);
  const data = result.data;

  if (forceProxy) {
    window.open(data.proxyBaseUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const decision = await choosePOSAccessMode({
    directUrl: data.directUrl,
    proxyBaseUrl: data.proxyBaseUrl,
    probeDirect: probeDirectURL,
  });
  window.open(decision.url, '_blank', 'noopener,noreferrer');
}
```

在 `ScanTable.jsx`：

- 主按钮改为调用 `onOpenDevice(device)`
- 更多菜单增加“通过平台访问”
- 无 `merchantId` 时不显示 POS 打开入口

**Step 4: Run build to verify it passes**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 5: Commit**

```bash
git add frontend/src/pages/ScanPage.jsx frontend/src/components/ScanTable.jsx
git commit -m "feat: add pos direct-or-proxy open flow"
```

### Task 9: 端到端联调与代理兼容性修补

**Files:**
- Modify: `backend-go/internal/handlers/device.go` as needed
- Modify: `frontend/src/pages/ScanPage.jsx` as needed
- Modify: `docs/plans/2026-03-19-pos-web-access-proxy-plan.md`

**Step 1: Run backend tests**

Run: `go test ./...`

Workdir: `backend-go`

Expected: all tests pass

**Step 2: Run frontend build**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 3: Manual verification**

1. 在局域网环境登录平台，点击“打开 POS”，确认直接打开 `http://<ip>:22080/`
2. 在外网环境登录 `https://device.menusifu.cloud`，点击“打开 POS”，确认回退到 `/api/device/:merchantId/pos-proxy/`
3. 用无权限用户访问同一入口，确认返回 403
4. 访问不存在或离线设备，确认前后端错误提示正确
5. 检查审计表中写入成功和失败记录

**Step 4: Fix only real compatibility issues**

如果联调发现问题，只补最小必要修复：

- `Location` 重写
- 查询参数拼接错误
- 代理根路径 `/` 行为不正确
- Cookie 丢失

不要在没有证据前预先引入 HTML 内容重写。

**Step 5: Commit**

```bash
git add backend-go frontend docs/plans/2026-03-19-pos-web-access-proxy-plan.md
git commit -m "feat: complete pos web access proxy flow"
```

Plan complete and saved to `docs/plans/2026-03-19-pos-web-access-proxy-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh session per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
