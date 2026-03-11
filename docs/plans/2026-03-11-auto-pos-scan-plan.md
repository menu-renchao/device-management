# POS 自动扫描 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 为 POS 列表新增可配置的后端自动扫描能力，支持按 CIDR 周期扫描、查看任务日志，并与现有手动扫描共享同一套结果回写逻辑。

**Architecture:** 在现有 Go 后端中新增自动扫描配置存储、扫描任务日志和后台 scheduler。扫描执行层统一收敛到 `ScanService.RunScanWithConfig`，手动扫描和自动扫描都通过同一套互斥与回写逻辑运行；前端在扫描页补充自动扫描配置与任务日志展示。

**Tech Stack:** Go, Gin, GORM, SQLite, React, Vite

---

### Task 1: 新增自动扫描数据模型

**Files:**
- Modify: `backend-go/internal/models/scan_session.go`
- Create: `backend-go/internal/models/auto_scan_config.go`
- Create: `backend-go/internal/models/scan_job_log.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/models/` no dedicated tests

**Step 1: 定义 `AutoScanConfig` 模型**

在 `backend-go/internal/models/auto_scan_config.go` 中新增模型，字段包含：

```go
type AutoScanConfig struct {
    ID                       uint      `gorm:"primaryKey" json:"id"`
    Enabled                  bool      `gorm:"not null;default:false" json:"enabled"`
    IntervalMinutes          int       `gorm:"not null;default:60" json:"interval_minutes"`
    CIDRBlocksJSON           string    `gorm:"type:text;not null" json:"-"`
    Port                     int       `gorm:"not null;default:22080" json:"port"`
    ConnectTimeoutSeconds    int       `gorm:"not null;default:2" json:"connect_timeout_seconds"`
    RequestTimeoutSeconds    int       `gorm:"not null;default:5" json:"request_timeout_seconds"`
    MaxProbeWorkers          int       `gorm:"not null;default:200" json:"max_probe_workers"`
    MaxFetchWorkers          int       `gorm:"not null;default:100" json:"max_fetch_workers"`
    LastAutoScanStartedAt    *time.Time `json:"last_auto_scan_started_at"`
    LastAutoScanFinishedAt   *time.Time `json:"last_auto_scan_finished_at"`
    UpdatedBy                *uint     `json:"updated_by"`
    CreatedAt                time.Time `json:"created_at"`
    UpdatedAt                time.Time `json:"updated_at"`
}
```

同时加上帮助方法：

```go
func (c *AutoScanConfig) GetCIDRBlocks() ([]string, error)
func (c *AutoScanConfig) SetCIDRBlocks(blocks []string) error
```

**Step 2: 定义 `ScanJobLog` 模型**

在 `backend-go/internal/models/scan_job_log.go` 中新增：

```go
type ScanJobLog struct {
    ID               uint       `gorm:"primaryKey" json:"id"`
    TriggerType      string     `gorm:"size:16;index;not null" json:"trigger_type"`
    Status           string     `gorm:"size:16;index;not null" json:"status"`
    StartedAt        time.Time  `gorm:"index;not null" json:"started_at"`
    FinishedAt       *time.Time `json:"finished_at"`
    CIDRBlocksJSON   string     `gorm:"type:text;not null" json:"-"`
    Port             int        `gorm:"not null" json:"port"`
    DevicesFound     int        `gorm:"not null;default:0" json:"devices_found"`
    MerchantIDsFound int        `gorm:"not null;default:0" json:"merchant_ids_found"`
    ErrorMessage     string     `gorm:"type:text" json:"error_message"`
    TriggeredBy      string     `gorm:"size:64;not null" json:"triggered_by"`
    CreatedAt        time.Time  `json:"created_at"`
}
```

同样加 `GetCIDRBlocks` / `SetCIDRBlocks` 助手。

**Step 3: 将新模型加入自动迁移**

在 `backend-go/cmd/server/main.go` 找到现有 `AutoMigrate` 或表初始化位置，加入：

```go
&models.AutoScanConfig{},
&models.ScanJobLog{},
```

**Step 4: 运行后端启动验证迁移成功**

Run: `go test ./...`

Expected: 所有测试通过，新增模型编译无误。

**Step 5: Commit**

```bash
git add backend-go/internal/models/auto_scan_config.go backend-go/internal/models/scan_job_log.go backend-go/cmd/server/main.go
git commit -m "feat: add auto scan models"
```

### Task 2: 新增自动扫描配置和任务日志仓储

**Files:**
- Create: `backend-go/internal/repository/auto_scan_config_repo.go`
- Create: `backend-go/internal/repository/scan_job_log_repo.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/repository/` no dedicated tests

**Step 1: 新增 `AutoScanConfigRepository`**

在 `backend-go/internal/repository/auto_scan_config_repo.go` 中定义：

```go
type AutoScanConfigRepository struct {
    db *gorm.DB
}

func NewAutoScanConfigRepository(db *gorm.DB) *AutoScanConfigRepository
func (r *AutoScanConfigRepository) GetOrCreateDefault() (*models.AutoScanConfig, error)
func (r *AutoScanConfigRepository) Update(config *models.AutoScanConfig) error
```

`GetOrCreateDefault()` 要保证数据库中至少有一条默认配置。

**Step 2: 新增 `ScanJobLogRepository`**

在 `backend-go/internal/repository/scan_job_log_repo.go` 中定义：

```go
type ScanJobLogRepository struct {
    db *gorm.DB
}

func NewScanJobLogRepository(db *gorm.DB) *ScanJobLogRepository
func (r *ScanJobLogRepository) Create(log *models.ScanJobLog) error
func (r *ScanJobLogRepository) Update(log *models.ScanJobLog) error
func (r *ScanJobLogRepository) List(page, pageSize int) ([]models.ScanJobLog, int64, error)
func (r *ScanJobLogRepository) LatestAutoRun() (*models.ScanJobLog, error)
```

**Step 3: 在 `main.go` 初始化仓储**

把新 repo 注入后续 handler / scheduler 需要的位置。

**Step 4: 运行编译验证**

Run: `go test ./...`

Expected: 编译通过，没有未使用的 repo 初始化代码。

**Step 5: Commit**

```bash
git add backend-go/internal/repository/auto_scan_config_repo.go backend-go/internal/repository/scan_job_log_repo.go backend-go/cmd/server/main.go
git commit -m "feat: add auto scan repositories"
```

### Task 3: 为 CIDR 校验和 host 限制补测试

**Files:**
- Modify: `backend-go/internal/services/scan_service.go`
- Create: `backend-go/internal/services/scan_service_auto_config_test.go`

**Step 1: 写 CIDR 校验失败测试**

在 `backend-go/internal/services/scan_service_auto_config_test.go` 中新增：

```go
func TestValidateCIDRBlocksRejectsInvalidCIDR(t *testing.T) {
    err := validateCIDRBlocks([]string{"192.168.1.0/24", "bad-cidr"})
    if err == nil {
        t.Fatalf("expected invalid CIDR error")
    }
}
```

**Step 2: 写 host 数超限测试**

```go
func TestValidateCIDRBlocksRejectsTooManyHosts(t *testing.T) {
    err := validateCIDRBlocks([]string{"10.0.0.0/16"})
    if err == nil {
        t.Fatalf("expected too many hosts error")
    }
}
```

根据最终阈值调整样例，确保测试表达规则。

**Step 3: 写 CIDR 去重与通过测试**

```go
func TestValidateCIDRBlocksAcceptsReasonableCIDRs(t *testing.T) {
    blocks, err := normalizeCIDRBlocks([]string{"192.168.1.0/24", "192.168.1.0/24"})
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if len(blocks) != 1 {
        t.Fatalf("expected deduped cidr blocks")
    }
}
```

**Step 4: 最小实现辅助函数**

在 `scan_service.go` 中新增：

```go
func normalizeCIDRBlocks(blocks []string) ([]string, error)
func estimateHostCount(cidr string) (int, error)
func validateCIDRBlocks(blocks []string) error
```

**Step 5: 运行测试**

Run: `go test ./internal/services -run TestValidateCIDRBlocks -v`

Expected: 新增测试通过。

**Step 6: Commit**

```bash
git add backend-go/internal/services/scan_service.go backend-go/internal/services/scan_service_auto_config_test.go
git commit -m "test: cover auto scan cidr validation"
```

### Task 4: 抽取统一扫描配置和执行入口

**Files:**
- Modify: `backend-go/internal/services/scan_service.go`
- Modify: `backend-go/internal/handlers/scan.go`
- Test: `backend-go/internal/services/scan_service_auto_config_test.go`

**Step 1: 定义统一扫描配置结构**

在 `scan_service.go` 中新增：

```go
type ScanRunConfig struct {
    TriggerType           string
    CIDRBlocks            []string
    Port                  int
    ConnectTimeoutSeconds int
    RequestTimeoutSeconds int
    MaxProbeWorkers       int
    MaxFetchWorkers       int
    TriggeredBy           string
}
```

**Step 2: 新增统一入口 `RunScanWithConfig`**

把当前 `StartScan` 的主体扫描逻辑迁移到：

```go
func (s *ScanService) RunScanWithConfig(cfg ScanRunConfig, onResult func(result map[string]interface{})) error
```

要求：
- 继续沿用现有 `status` 字段
- 使用统一互斥锁
- 初始化扫描状态
- 在 goroutine 中按多个 CIDR 执行扫描

**Step 3: 让 `StartScan` 变成包装层**

`StartScan(localIP string, ...)` 中：
- 解析 `localIP`
- 生成默认 CIDR 配置
- 调用 `RunScanWithConfig`

保持现有前端接口不变。

**Step 4: 将端口和超时从硬编码改为配置传递**

最小改动方式：
- `performScan` 接受 `ScanRunConfig`
- `scanPort` 使用 `cfg.Port` 和 `cfg.ConnectTimeoutSeconds`
- `fetchCompanyProfile` / `guessOS` 使用 `cfg.RequestTimeoutSeconds`

**Step 5: 运行后端测试**

Run: `go test ./internal/services ./internal/handlers -v`

Expected: 服务层和 handler 编译通过。

**Step 6: Commit**

```bash
git add backend-go/internal/services/scan_service.go backend-go/internal/handlers/scan.go
git commit -m "refactor: unify manual and auto scan execution"
```

### Task 5: 补充自动扫描结果汇总和互斥测试

**Files:**
- Modify: `backend-go/internal/services/scan_service_auto_config_test.go`

**Step 1: 写并发互斥测试**

新增测试，第一次启动扫描后再次调用 `RunScanWithConfig` 返回错误：

```go
func TestRunScanWithConfigRejectsConcurrentRuns(t *testing.T) {
    // start a scan with a cancellable context or stub
    // assert second call returns scan already in progress
}
```

如直接跑真实网络扫描不稳定，可通过抽出小型可替换函数或注入 host provider 让测试可控。

**Step 2: 写 merchant ID 汇总逻辑测试**

验证成功结果会写入 `status.MerchantIDs`，错误结果不会误写空值。

**Step 3: 最小实现让测试通过**

在 `scan_service.go` 中把可测的逻辑抽成纯函数，例如：

```go
func collectMerchantID(result map[string]interface{}) (string, bool)
```

**Step 4: 运行测试**

Run: `go test ./internal/services -run TestRunScanWithConfig -v`

Expected: 新增测试通过。

**Step 5: Commit**

```bash
git add backend-go/internal/services/scan_service.go backend-go/internal/services/scan_service_auto_config_test.go
git commit -m "test: cover auto scan concurrency rules"
```

### Task 6: 实现自动扫描 scheduler

**Files:**
- Create: `backend-go/internal/services/auto_scan_scheduler.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/services/auto_scan_scheduler_test.go`

**Step 1: 写调度跳过测试**

新增 `backend-go/internal/services/auto_scan_scheduler_test.go`：

```go
func TestSchedulerSkipsWhenDisabled(t *testing.T) {}
func TestSchedulerSkipsWhenScanAlreadyRunning(t *testing.T) {}
func TestSchedulerRunsWhenIntervalElapsed(t *testing.T) {}
```

尽量把“是否该执行”的判断抽成纯函数，方便测试。

**Step 2: 新建 `AutoScanScheduler`**

实现结构：

```go
type AutoScanScheduler struct {
    scanService *ScanService
    configRepo  *repository.AutoScanConfigRepository
    jobRepo     *repository.ScanJobLogRepository
    interval    time.Duration
}
```

并提供：

```go
func NewAutoScanScheduler(...) *AutoScanScheduler
func (s *AutoScanScheduler) Start(ctx context.Context)
func (s *AutoScanScheduler) RunOnce(ctx context.Context) error
```

**Step 3: 在 `RunOnce` 中实现决策逻辑**

- 取配置
- 判断 enabled
- 判断上次开始时间与 `interval_minutes`
- 判断 `scanService.GetStatus().IsScanning`
- 触发 `RunScanWithConfig`

**Step 4: 在 `main.go` 中启动 scheduler**

在服务初始化后创建 context 并调用：

```go
go autoScanScheduler.Start(appCtx)
```

**Step 5: 运行测试**

Run: `go test ./internal/services -run TestScheduler -v`

Expected: 调度测试通过。

**Step 6: Commit**

```bash
git add backend-go/internal/services/auto_scan_scheduler.go backend-go/internal/services/auto_scan_scheduler_test.go backend-go/cmd/server/main.go
git commit -m "feat: add auto scan scheduler"
```

### Task 7: 实现任务日志创建和完成回写

**Files:**
- Modify: `backend-go/internal/services/auto_scan_scheduler.go`
- Modify: `backend-go/internal/handlers/scan.go`
- Modify: `backend-go/internal/repository/scan_job_log_repo.go`
- Test: `backend-go/internal/services/auto_scan_scheduler_test.go`

**Step 1: 写任务日志状态流转测试**

至少覆盖：
- scheduler 触发时创建 `running`
- 成功完成后写 `success`
- 扫描中跳过写 `skipped`

**Step 2: 在 scheduler 中创建和更新日志**

启动前：

```go
job := &models.ScanJobLog{
    TriggerType: "auto",
    Status: "running",
    StartedAt: time.Now(),
    TriggeredBy: "system",
}
```

完成后更新 `FinishedAt`、`DevicesFound`、`MerchantIDsFound`、`Status`。

**Step 3: 让手动扫描也可以写日志**

如果本期希望统一日志视图，给 [scan.go](D:/menusifu/device_management/backend-go/internal/handlers/scan.go) 的手动触发也补 `manual` 日志；如果决定本期只记录自动扫描，保留 TODO 注释并在 plan 中注明。

建议本期直接统一写日志，避免前端列表含义不一致。

**Step 4: 运行测试**

Run: `go test ./internal/services -run TestScheduler -v`

Expected: 日志状态流转测试通过。

**Step 5: Commit**

```bash
git add backend-go/internal/services/auto_scan_scheduler.go backend-go/internal/handlers/scan.go backend-go/internal/repository/scan_job_log_repo.go
git commit -m "feat: persist auto scan job logs"
```

### Task 8: 新增自动扫描配置接口

**Files:**
- Modify: `backend-go/internal/handlers/scan.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/handlers/scan_handler_auto_config_test.go`

**Step 1: 写获取与保存配置 handler 测试**

新建：

```go
func TestGetAutoScanConfig(t *testing.T) {}
func TestUpdateAutoScanConfigRejectsInvalidCIDR(t *testing.T) {}
func TestUpdateAutoScanConfigSucceeds(t *testing.T) {}
```

用 `httptest` 驱动 Gin handler。

**Step 2: 在 `ScanHandler` 中注入新 repo**

扩展构造函数参数，新增：

```go
configRepo *repository.AutoScanConfigRepository
jobRepo    *repository.ScanJobLogRepository
```

**Step 3: 实现新接口**

在 `scan.go` 中添加：

```go
func (h *ScanHandler) GetAutoScanConfig(c *gin.Context)
func (h *ScanHandler) UpdateAutoScanConfig(c *gin.Context)
func (h *ScanHandler) RunAutoScanNow(c *gin.Context)
func (h *ScanHandler) ListScanJobs(c *gin.Context)
```

**Step 4: 注册路由**

在 `main.go` 的扫描相关路由中加入对应 endpoint。

**Step 5: 运行测试**

Run: `go test ./internal/handlers -run TestGetAutoScanConfig -v`

Expected: handler 测试通过。

**Step 6: Commit**

```bash
git add backend-go/internal/handlers/scan.go backend-go/internal/handlers/scan_handler_auto_config_test.go backend-go/cmd/server/main.go
git commit -m "feat: add auto scan config endpoints"
```

### Task 9: 扩展前端 API 封装

**Files:**
- Modify: `frontend/src/services/api.js`

**Step 1: 为自动扫描接口写调用封装**

在 `scanAPI` 下新增：

```js
getAutoConfig()
updateAutoConfig(payload)
listJobs(params)
runAutoScan()
```

**Step 2: 检查返回结构与现有 API 风格保持一致**

避免单独引入一套新的 `fetch` 风格，继续复用现有 axios 或请求封装。

**Step 3: 运行前端构建**

Run: `npm run build`

Workdir: `frontend`

Expected: 构建通过。

**Step 4: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add frontend auto scan api client"
```

### Task 10: 在扫描页增加自动扫描配置表单

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`

**Step 1: 写最小交互状态**

在 `ScanPage.jsx` 中新增状态：

```js
const [autoScanConfig, setAutoScanConfig] = useState(...)
const [autoScanJobs, setAutoScanJobs] = useState([])
const [savingAutoScan, setSavingAutoScan] = useState(false)
const [runningAutoScan, setRunningAutoScan] = useState(false)
```

**Step 2: 页面初始化加载配置和日志**

在现有 `useEffect` 中或新增独立 effect 调用：
- `scanAPI.getAutoConfig()`
- `scanAPI.listJobs({ page: 1, page_size: 10 })`

**Step 3: 新增配置 UI**

最小字段：
- 启用开关
- 周期分钟数
- CIDR 多行文本框
- 保存按钮
- 立即执行一次按钮

**Step 4: 新增最近任务日志 UI**

展示列：
- 触发类型
- 状态
- 开始时间
- 结束时间
- 发现设备数
- 错误信息

**Step 5: 本地前端校验**

保存前校验：
- 周期 > 0
- CIDR 至少一行

其余严格校验依赖后端返回。

**Step 6: 运行构建**

Run: `npm run build`

Workdir: `frontend`

Expected: 构建通过，无 ESLint / 编译错误。

**Step 7: Commit**

```bash
git add frontend/src/pages/ScanPage.jsx
git commit -m "feat: add auto scan settings to scan page"
```

### Task 11: 补充端到端手工验证

**Files:**
- Modify: `docs/plans/2026-03-11-auto-pos-scan-plan.md`

**Step 1: 启动后端和前端**

Run: `go run ./cmd/server`

Workdir: `backend-go`

Run: `npm run dev`

Workdir: `frontend`

Expected: 前后端均启动成功。

**Step 2: 手工验证配置保存**

- 打开扫描页
- 保存 `192.168.1.0/24`
- 周期设为 `60`
- 确认页面回显与数据库一致

**Step 3: 手工验证立即执行**

- 点击“立即执行一次”
- 确认任务日志新增 `running -> success/failed`
- 确认 POS 列表最后扫描时间更新

**Step 4: 手工验证调度执行**

- 临时把周期改成 1 分钟用于验证
- 等待一个周期
- 确认无需页面操作也会新增自动扫描任务日志

**Step 5: 手工验证互斥**

- 手动扫描启动后立即点“立即执行一次”
- 确认自动任务被跳过或手动接口返回占用提示

**Step 6: 记录验证结果**

把实际验证结果补充到实现 PR 描述或开发记录中。

**Step 7: Commit**

```bash
git add .
git commit -m "test: verify auto pos scan flow"
```

### Task 12: 最终回归与收尾

**Files:**
- Modify: `docs/plans/2026-03-11-auto-pos-scan-design.md` if any approved design tweaks are needed

**Step 1: 跑后端全量测试**

Run: `go test ./...`

Workdir: `backend-go`

Expected: 全部通过。

**Step 2: 跑前端构建**

Run: `npm run build`

Workdir: `frontend`

Expected: 构建通过。

**Step 3: 检查 git 状态**

Run: `git status --short`

Expected: 仅包含本次功能相关文件。

**Step 4: 准备交付说明**

说明内容至少包括：
- 新增自动扫描配置入口
- 任务日志位置
- 默认配置值
- 已验证命令

**Step 5: Commit**

```bash
git add .
git commit -m "feat: complete auto pos scan"
```
