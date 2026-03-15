# POS 扫描隐藏服务异常设计

**Problem**

当前 POS 扫描会把“端口可达但拿不到 `merchantId`”的设备当作在线结果继续处理：

- 后端会把这类结果写入 `scan_results`
- 前端扫描列表会把它显示为“服务异常”
- 历史脏数据会持续污染设备列表与后续数据操作

新需求要求 POS 设备扫描不再展示和记录这类“服务异常”数据，并提供脚本清理历史异常记录。

**Decision**

采用“扫描写入前拦截 + 列表查询兜底过滤 + 一次性历史清理脚本”的方案：

- 扫描流程继续探测设备，但 `merchantId` 为空的结果不再写入 `scan_results`
- 设备列表查询层统一过滤 `merchant_id` 为空、`NULL` 或纯空白的记录
- 前端扫描表不再把无 `merchantId` 的在线结果渲染为“服务异常”设备
- 提供独立脚本删除历史异常记录，避免旧数据继续影响列表

**Scope**

本次包含：

- 调整手动扫描与自动扫描的结果持久化逻辑
- 调整设备列表查询逻辑，兜底过滤异常扫描记录
- 调整扫描页状态展示逻辑，去掉“服务异常”状态分支
- 提供历史数据清理脚本
- 补充后端、前端、脚本测试

本次不包含：

- 保留“服务异常设备”作为单独诊断视图
- 新增后台配置开关控制是否保留异常结果
- 修改 POS 探测协议本身

**Architecture**

异常数据的来源在 [scan_service.go](D:/project%20x/device-management/backend-go/internal/services/scan_service.go) 和 [scan.go](D:/project%20x/device-management/backend-go/internal/handlers/scan.go) 的组合流程中：

1. 扫描服务抓取 `fetchCompanyProfile`
2. 解析 `merchantId` / `name` / `version`
3. handler 将结果写入 `scan_results`
4. 设备列表接口再从 `scan_results` 读取并返回前端

本次改造分三层完成：

1. 写入层
   - 在 `saveScanResult` 入口前判定 `merchantId`
   - `merchantId` 为空时直接跳过创建和更新
2. 查询层
   - 在设备仓库 `ListScanResults` 中增加 `merchant_id` 非空过滤
   - 防止历史脏数据和旁路写入数据出现在正式设备列表
3. 展示层
   - 扫描表不再把“在线但无 merchantId”的结果标记为服务异常
   - 页面只展示符合业务有效性的设备记录

**Data Flow**

改造后的数据流如下：

1. 扫描服务继续扫描 IP 和端口
2. 抓取公司信息并提取 `merchantId`
3. 若 `merchantId` 为空：
   - 不调用仓库创建
   - 不调用仓库更新
   - 不进入正式设备列表数据集
4. 若 `merchantId` 有效：
   - 按现有逻辑更新或创建 `scan_results`
   - 参与在线状态与列表展示
5. 历史数据通过独立清理脚本删除空 `merchant_id` 记录

**Backend Design**

- 在 [scan.go](D:/project%20x/device-management/backend-go/internal/handlers/scan.go) 增加一个统一的 `merchantId` 有效性判断，避免创建和更新逻辑重复分叉。
- `saveScanResult` 对 `merchantId` 做 `TrimSpace`，空值直接返回。
- [scan_result.go](D:/project%20x/device-management/backend-go/internal/models/scan_result.go) 的 `ToDict()` 仍保留现有字段结构，但后续列表查询不会再把空 `merchant_id` 记录送到前端。
- 在 [device_repo.go](D:/project%20x/device-management/backend-go/internal/repository/device_repo.go) 的 `ListScanResults` 加上统一过滤条件：
  - `merchant_id IS NOT NULL`
  - `TRIM(merchant_id) != ''`
- 这样即使脚本尚未执行，历史脏数据也不会继续暴露在 `/api/devices` 响应中。

**Frontend Design**

- 在 [ScanTable.jsx](D:/project%20x/device-management/frontend/src/components/ScanTable.jsx) 移除“服务异常”展示分支。
- 状态文案只保留：
  - 在线
  - 离线
- 对于无 `merchantId` 的瞬时扫描结果，不再作为可操作设备项强调展示。
- 前端不承担主过滤职责，主过滤仍以后端为准；前端改动主要用于消除错误状态文案和视觉误导。

**Cleanup Script Design**

提供独立脚本入口：

- `backend-go/cmd/cleanup-service-exception/main.go`

脚本职责：

1. 连接当前 SQLite 数据库
2. 查询 `scan_results` 中 `merchant_id` 为空、`NULL` 或纯空白的记录数
3. 执行删除
4. 输出删除前数量和实际删除数量

脚本不做其他级联删除，原因是这类记录没有有效 `merchant_id`，理论上不会成为 `device_properties`、`device_occupancies`、`device_claims` 等表的关联主键。

**Error Handling**

- 空 `merchantId` 不作为接口错误返回，不中断整次扫描，只跳过该条结果。
- 清理脚本遇到数据库打开失败、SQL 执行失败时直接退出并返回非零状态。
- 列表查询过滤条件为只读逻辑，不影响正常设备记录。

**Why This Approach**

- 满足“以后不再记录”的根本要求，而不是只做展示层隐藏。
- 查询层兜底让改造具备容错性，避免历史脏数据在脚本执行前继续暴露。
- 独立脚本可单独执行、可审计、风险面小。
- 对现有扫描协议和设备详情抓取能力影响最小。

**Verification**

- handler 测试覆盖“空 `merchantId` 不落库”
- repository 测试覆盖“列表查询过滤空 `merchant_id`”
- 前端测试覆盖“无 `merchantId` 的在线设备不显示服务异常”
- 脚本测试覆盖“只删除异常记录，不删除正常记录”
