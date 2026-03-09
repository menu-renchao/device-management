# POS 设备「数据备份 / 数据恢复」功能 Implementation Plan

> 关联设计文档：`docs/plans/2026-03-09-pos-db-backup-restore-design.md`

## Goal

在 POS 设备管理「更多操作」中新增 `数据备份` 与 `数据恢复`，满足以下要求：

- Linux + Windows 双端支持
- 统一 SQL 备份/恢复（整库 `kpos`）
- 服务端优先存储，目录按 MID 管理
- 文件名按 `{version}_{yyyyMMdd_HHmmss}.sql`
- 支持服务端列表/下载/删除、支持本地上传恢复
- Linux 可选“恢复后重启 POS”，Windows 不提供重启

## Architecture

- 前端：`ScanTable` 新增入口 + `ScanPage` 弹窗编排 + 新增 `DBBackupRestoreModal`
- 后端：`device` 域扩展备份恢复 API + 任务化执行
- 存储：`downloads/db-backups/{MID}` 文件存储 + SQLite 元数据与任务表
- 权限：管理员 / 负责人 / 当前借用人

## Tech Stack

- Go + Gin + GORM + SQLite
- React + Axios
- `mysqldump` / `mysql`（服务端命令）

---

## Task 0: 基线校验

### Files

- Modify: 无

### Steps

1. `git status -sb` 查看当前工作区状态
2. `cd backend-go && go test ./...` 验证后端基线
3. `cd frontend && npm run build` 验证前端基线

### Expected

- 后端测试通过（允许 `[no test files]`）
- 前端构建成功

---

## Task 1: 后端数据模型与仓储层

### Files

- Create: `backend-go/internal/models/device_db_backup_file.go`
- Create: `backend-go/internal/models/device_db_backup_job.go`
- Create: `backend-go/internal/models/device_db_restore_job.go`
- Create: `backend-go/internal/models/device_db_restore_upload.go`
- Create: `backend-go/internal/repository/device_db_backup_repo.go`
- Modify: `backend-go/cmd/server/main.go`

### Steps

1. 新增备份文件元数据模型（MID、版本、文件名、路径、大小、来源、创建人）
2. 新增备份任务模型（job_id、状态、进度、错误、开始结束时间）
3. 新增恢复任务模型（来源、状态、是否请求重启、重启结果）
4. 新增本地上传临时记录模型（upload_token、临时路径、消费时间）
5. 新增仓储方法：
   - 文件：创建/分页列表/按 ID 查询/删除
   - 任务：创建/更新状态/查询详情
   - 上传：创建/查询/标记已消费
6. 在 `main.go` 的 `AutoMigrate` 注册新模型并初始化仓储

### Expected

- 数据表自动迁移成功
- 仓储接口可被服务层调用

---

## Task 2: 服务端存储与命名工具

### Files

- Create: `backend-go/internal/services/db_backup_storage_service.go`
- Create: `backend-go/internal/services/db_backup_naming.go`
- Test: `backend-go/internal/services/db_backup_naming_test.go`

### Steps

1. 统一备份根目录：`{DOWNLOADS_DIR}/db-backups`
2. 生成 MID 目录：`{root}/{MID}`
3. 版本清洗：仅保留 `[a-zA-Z0-9._-]`，其他替换为 `_`
4. 文件名生成：`{version}_{yyyyMMdd_HHmmss}.sql`
5. 处理同秒重名冲突（追加 `_01/_02`）
6. 封装文件操作：保存、打开下载、删除、大小读取

### Expected

- 任意 MID 都能稳定生成合法路径
- 文件命名规则满足设计要求

---

## Task 3: 备份执行服务（任务化）

### Files

- Create: `backend-go/internal/services/db_backup_job_service.go`
- Modify: `backend-go/internal/services/db_backup_job_service.go`（包含 worker）
- Test: `backend-go/internal/services/db_backup_job_service_test.go`

### Steps

1. 新增 `CreateBackupJob(merchantID, operatorID)`：
   - 权限前置（由 handler 做）
   - 检查 MID 级互斥（running 任务冲突返回 409）
   - 创建 `pending` 任务并异步执行
2. 异步执行备份：
   - 查询设备 IP 与版本
   - 固定连接参数拼接 `mysqldump`
   - 输出到临时文件，再原子移动到目标目录
   - 创建备份元数据记录
   - 更新任务 `success/failed`
3. 任务进度建议粗粒度：
   - 10（启动）/ 40（导出中）/ 80（落盘）/ 100（完成）
4. 错误处理：
   - 设备不存在
   - DB 不可达
   - `mysqldump` 缺失
   - 文件写入失败

### Expected

- 能创建并完成备份任务
- 失败时错误信息可读且可查询

---

## Task 4: 恢复执行服务（服务端来源 + 本地上传来源）

### Files

- Create: `backend-go/internal/services/db_restore_job_service.go`
- Create: `backend-go/internal/services/db_restore_upload_service.go`
- Test: `backend-go/internal/services/db_restore_job_service_test.go`

### Steps

1. 新增上传暂存：
   - 接收 `.sql`，落盘到临时目录
   - 生成 `upload_token` 并入库
2. 新增 `CreateRestoreJob(...)` 支持两类来源：
   - `source_type=server`：通过 `backup_id` 找文件
   - `source_type=upload`：通过 `upload_token` 找临时文件
3. 异步执行恢复：
   - 固定连接参数执行 `mysql < file.sql`
   - 更新任务状态
4. Linux 可选重启：
   - 仅 Linux 设备且请求重启时尝试调用重启逻辑
   - 若无法重启，记录 `restart_result`，不回滚恢复成功状态
5. Windows 逻辑：
   - 忽略重启参数，不做重启步骤
6. 上传文件消费策略：
   - 恢复执行后标记已消费并清理临时文件

### Expected

- 服务端文件与本地上传两种恢复路径都可用
- Linux 重启可选且不影响恢复主结果

---

## Task 5: Handler 与路由接入

### Files

- Create: `backend-go/internal/handlers/device_db_backup.go`
- Modify: `backend-go/internal/handlers/device.go`（复用权限方法）
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/handlers/device_db_backup_test.go`

### Steps

1. 新增接口：
   - `POST /api/device/db-backup/jobs`
   - `GET /api/device/db-backup/jobs/:jobId`
   - `GET /api/device/db-backups`
   - `GET /api/device/db-backups/:id/download`
   - `DELETE /api/device/db-backups/:id`
   - `POST /api/device/db-restore/uploads`
   - `POST /api/device/db-restore/jobs`
   - `GET /api/device/db-restore/jobs/:jobId`
2. 复用现有设备权限口径（管理员/负责人/借用人）
3. 统一响应格式与错误码（400/403/404/409/422/500）
4. 下载接口返回流式文件与 `Content-Disposition`

### Expected

- API 可完整覆盖前端所需链路
- 权限判定与现有功能一致

---

## Task 6: 前端 API 封装

### Files

- Modify: `frontend/src/services/api.js`

### Steps

1. 在 `deviceAPI` 新增方法：
   - `createDBBackupJob(merchantId)`
   - `getDBBackupJob(jobId)`
   - `listDBBackups(merchantId, page, pageSize)`
   - `downloadDBBackupUrl(backupId)`
   - `deleteDBBackup(backupId)`
   - `uploadRestoreSQL(merchantId, file)`
   - `createDBRestoreJob(payload)`
   - `getDBRestoreJob(jobId)`
2. 上传接口采用 `multipart/form-data`
3. 下载接口使用 URL 方式，复用 token 方案

### Expected

- 前端业务调用不直接拼 URL，统一走 API 层

---

## Task 7: 前端入口与弹窗交互

### Files

- Modify: `frontend/src/components/ScanTable.jsx`
- Modify: `frontend/src/pages/ScanPage.jsx`
- Create: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`
- (Optional) Create: `frontend/src/components/db-backup/BackupListPanel.jsx`
- (Optional) Create: `frontend/src/components/db-backup/RestorePanel.jsx`
- Modify: `frontend/src/App.css`（如需样式）

### Steps

1. 在“更多操作”新增：
   - `数据备份`
   - `数据恢复`
2. 打开统一弹窗：
   - Tab1 服务端备份管理
   - Tab2 恢复数据
3. 服务端备份 Tab：
   - 创建备份（确认 + 任务轮询）
   - 列表展示
   - 下载、删除
4. 恢复 Tab：
   - 服务端备份选择恢复
   - 本地上传恢复
   - Linux 显示“恢复后重启”，Windows 不显示
5. 全流程使用 `toast.confirm` / `toast.success|error|warning`

### Expected

- 用户可在一个弹窗内完成备份、下载、删除、恢复
- 交互风格与现有系统一致

---

## Task 8: 联调与验收

### Files

- Modify: `docs/development-guide.md`（新增 API 说明）
- Modify: `docs/architecture-overview.md`（新增模块说明，可选）

### Steps

1. 后端全量测试：`cd backend-go && go test ./...`
2. 前端构建：`cd frontend && npm run build`
3. 手工验收场景：
   - Linux 设备：备份、下载、删除、恢复、可选重启
   - Windows 设备：备份、下载、删除、恢复（无重启选项）
   - 权限矩阵（管理员/负责人/借用人/无权限）
   - 并发冲突（同 MID 双任务）
   - 失败路径（设备 DB 不可达、非法文件）

### Expected

- 功能符合设计文档
- 无高优先级回归

---

## 验收清单（可打勾）

- [ ] 更多操作新增 `数据备份` / `数据恢复` 入口
- [ ] 双端支持（Linux + Windows）
- [ ] 备份文件按 `MID` 目录和 `版本+时间` 命名
- [ ] 服务端备份支持下载与删除
- [ ] 恢复支持服务端来源与本地上传来源
- [ ] Linux 可选重启，Windows 无重启选项
- [ ] 权限与现有设备权限口径一致
- [ ] 同 MID 任务互斥（409）
- [ ] 错误文案可读、前端可直显

---

## 风险与备注

1. 运行环境需具备 `mysqldump` / `mysql` 可执行文件；
2. 固定 DB 凭据建议后续迁移为环境配置项；
3. Linux 重启步骤依赖当前可用的重启实现能力，失败不应覆盖恢复成功结果；
4. 本计划不包含自动清理历史备份（按需求仅手动删除）。

---

文档状态：`Plan Draft - Ready for Implementation`
