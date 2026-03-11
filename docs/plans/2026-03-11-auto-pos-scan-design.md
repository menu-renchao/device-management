# POS 自动扫描设计

**Problem**

当前 POS 列表依赖用户在扫描页手动点击开始扫描。后端已经具备扫描网段、抓取设备信息、更新在线状态和保存扫描结果的能力，但扫描触发方式仍然是人工触发，无法在无人值守场景下持续维护 POS 在线状态。

本次设计目标是在现有 Go 后端内新增“按配置自动扫描指定 CIDR 网段”的能力，支持配置扫描周期、扫描网段、查看最近任务结果，并与现有 POS 列表复用同一套扫描结果回写逻辑。

**Decision**

采用“后端内置调度器 + 配置入库 + 扫描任务日志”方案：

- 自动扫描配置存入数据库，由后端接口提供读取和修改。
- 后端服务启动时创建后台 scheduler，按配置周期检查是否应触发自动扫描。
- 自动扫描与手动扫描共用同一个扫描核心，统一维护扫描状态和结果回写。
- 自动扫描网段使用用户确认的 CIDR 方式配置，不再依赖本机 IP 推导。
- 新增任务日志表记录每次自动扫描的开始、结束、结果、错误和配置快照。

**Scope**

本期包含：

- 自动扫描启用开关
- 扫描周期配置，默认 60 分钟
- 一个或多个 IPv4 CIDR 网段配置
- 后端自动调度与互斥控制
- 自动扫描结果回写现有 `scan_result`、`scan_session`、设备在线状态
- 最近任务日志查询
- 扫描页新增自动扫描配置与任务日志展示

本期不包含：

- 分布式调度
- OS 级计划任务集成
- 独立扫描服务
- 不同网段使用不同端口或超时策略
- 扫描结果主动推送通知

**Architecture**

现有扫描能力集中在 [scan.go](D:/menusifu/device_management/backend-go/internal/handlers/scan.go) 和 [scan_service.go](D:/menusifu/device_management/backend-go/internal/services/scan_service.go)。当前手动扫描入口会根据用户选择的本机 IP 推导 `/23` 网段，再执行端口探测和详情抓取。

本次改造将扫描能力拆成三层：

1. 配置层
- 维护自动扫描配置
- 校验 CIDR 和性能参数

2. 调度层
- 服务启动时常驻运行
- 按周期判断是否应触发自动扫描
- 负责跳过、建档、互斥判断

3. 执行层
- 统一执行扫描
- 支持按 CIDR 列表生成 host 集合
- 延续现有结果保存和在线状态更新流程

**Data Model**

新增表 `auto_scan_config`

- `id`
- `enabled`
- `interval_minutes`
- `cidr_blocks_json`
- `port`
- `connect_timeout_seconds`
- `request_timeout_seconds`
- `max_probe_workers`
- `max_fetch_workers`
- `last_auto_scan_started_at`
- `last_auto_scan_finished_at`
- `updated_by`
- `created_at`
- `updated_at`

说明：

- `cidr_blocks_json` 保存用户配置的 CIDR 数组，例如 `["192.168.1.0/24"]`
- 本期保持单配置模型，可只存一行有效配置

新增表 `scan_job_logs`

- `id`
- `trigger_type`
- `status`
- `started_at`
- `finished_at`
- `cidr_blocks_json`
- `port`
- `devices_found`
- `merchant_ids_found`
- `error_message`
- `triggered_by`
- `created_at`

说明：

- `trigger_type` 取值：`manual`、`auto`
- `status` 取值：`running`、`success`、`failed`、`cancelled`、`skipped`
- 日志保留每次任务的配置快照，避免后续配置变化后无法追溯

`scan_session` 保留现有职责，用于页面展示最后扫描时间等聚合信息。

**Backend Design**

建议对 [scan_service.go](D:/menusifu/device_management/backend-go/internal/services/scan_service.go) 做结构化调整：

新增统一扫描入参：

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

新增统一执行入口：

```go
func (s *ScanService) RunScanWithConfig(
    cfg ScanRunConfig,
    onResult func(result map[string]interface{}),
) error
```

保留并收缩手动扫描入口：

- `StartScan(localIP string, onResult ...)` 继续服务现有前端
- 手动入口仅负责把 `localIP` 转换成默认扫描配置后调用 `RunScanWithConfig`

新增 `AutoScanScheduler`

职责：

- 周期 tick，建议每 1 分钟执行一次检查
- 加载当前自动扫描配置
- 判断是否启用
- 判断距离上次自动扫描开始时间是否达到 `interval_minutes`
- 判断当前是否已有扫描运行
- 创建任务日志
- 触发自动扫描
- 更新任务结果和最近执行时间

挂载位置：

- 在 [main.go](D:/menusifu/device_management/backend-go/cmd/server/main.go) 初始化服务后启动 scheduler
- scheduler 生命周期跟随当前 Go 服务

**Scan Flow**

自动扫描单次执行流程：

1. Scheduler 读取当前配置
2. 校验配置合法性
3. 若当前已有扫描任务运行，记一条 `skipped` 日志并返回
4. 创建 `scan_job_logs(status=running)`
5. 按所有 CIDR 生成 host 列表
6. host 去重后执行端口探测
7. 探测成功的 IP 抓取：
   - `/kpos/webapp/store/fetchCompanyProfile`
   - `/kpos/webapp/os/getOSType`
8. 每个结果继续复用现有 `saveScanResult`
9. 全量扫描成功完成后：
   - 使用本次 `merchantId` 集合更新离线设备
   - 更新 `scan_session.last_scan_at`
   - 更新 `auto_scan_config.last_auto_scan_*`
   - 更新 `scan_job_logs(status=success)`
10. 若任务失败或取消：
   - 写错误日志
   - 不执行批量离线置灰

**Concurrency Rules**

全局同一时刻仅允许一个扫描任务运行。

规则：

- 手动扫描和自动扫描共用同一把扫描互斥锁
- 自动扫描触发时若已有任务运行，直接跳过并记日志
- 手动扫描触发时沿用现有接口行为，返回 `scan already in progress`

这样可以避免：

- 扫描状态互相覆盖
- 任务结果混写
- 同一设备被多次并发请求导致误判

**CIDR Validation Rules**

保存配置前执行严格校验：

- 仅支持 IPv4 CIDR
- 不允许空数组
- 每个 CIDR 必须可被 `net.ParseCIDR` 成功解析
- 单个 CIDR 不允许大于 `/16`
- 合并后总 host 数不允许超过上限，建议 `4096` 或 `8192`
- 保存前先去重

校验失败时直接阻止保存，并返回明确错误信息。

**API Design**

建议新增以下接口：

- `GET /api/scan/auto-config`
  - 返回当前自动扫描配置

- `PUT /api/scan/auto-config`
  - 保存自动扫描配置

- `GET /api/scan/jobs?page=1&page_size=20`
  - 返回最近扫描任务日志

- `POST /api/scan/auto-run`
  - 立即按当前自动配置执行一次扫描

建议请求体：

```json
{
  "enabled": true,
  "interval_minutes": 60,
  "cidr_blocks": ["192.168.1.0/24"],
  "port": 22080,
  "connect_timeout_seconds": 2,
  "request_timeout_seconds": 5,
  "max_probe_workers": 200,
  "max_fetch_workers": 100
}
```

说明：

- `auto-run` 不是调度必需接口，但对调试和运维验证很有用
- 页面保存配置后可立即执行一次，减少等待时间

**Frontend Design**

在 [ScanPage.jsx](D:/menusifu/device_management/frontend/src/pages/ScanPage.jsx) 新增“自动扫描设置”区域，而不是新建独立页面。

建议包含：

- 自动扫描开关
- 扫描周期输入框
- CIDR 多行输入框，一行一个
- 上次自动扫描开始/结束时间
- 最近一次结果状态
- 最近任务日志列表
- “立即执行一次”按钮

交互规则：

- 保存配置前做基础前端校验，后端仍做最终校验
- 开启自动扫描后，不要求页面常驻
- 任务日志默认展示最近 10 到 20 条

**Error Handling**

需要特别处理以下场景：

1. 配置非法
- `PUT /auto-config` 直接拒绝保存

2. 单个设备无法连接或返回异常 JSON
- 保留当前设备错误信息
- 整个任务继续

3. 任务级失败
- 更新任务日志为 `failed`
- 不批量更新离线状态

4. 服务重启
- 启动时重新加载数据库配置
- 下个 scheduler tick 自动恢复执行节奏

5. 扫描耗时大于周期
- 下一次自动触发时命中互斥规则并写 `skipped`
- 不启动第二个并发扫描

**Acceptance Criteria**

- 后端服务启动后，即使没有用户打开页面，也会按配置自动扫描
- 扫描周期和 CIDR 可在页面修改
- 自动扫描和手动扫描不会并发执行
- 扫描完成后 POS 列表在线状态会自动更新
- 失败原因可在任务日志中查看
- 服务重启后自动扫描能力无需人工恢复

**Implementation Notes**

建议实现顺序：

1. 将扫描核心改为支持按 `CIDRBlocks` 扫描
2. 新增自动扫描配置表和任务日志表
3. 新增 scheduler 并挂到服务启动流程
4. 新增配置接口和日志接口
5. 扫描页增加自动扫描配置和日志展示
6. 为 CIDR 校验、调度跳过、扫描互斥补充测试

**Validation**

- 后端单元测试覆盖：
  - CIDR 校验
  - host 总数限制
  - 调度跳过逻辑
  - 手动/自动扫描互斥
- 集成验证：
  - 保存配置后立即执行一次
  - 任务成功后 `scan_job_logs` 与 `scan_session` 正确更新
  - 失败任务不会错误地将在线设备标记为离线

---

文档状态：已在 brainstorming 阶段确认方案方向。  
下一步：进入 writing-plans，拆出可执行的实现计划。
