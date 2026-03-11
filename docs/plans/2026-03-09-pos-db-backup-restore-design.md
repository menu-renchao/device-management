# POS 设备管理「数据备份 / 数据恢复」功能设计

## 1. 背景与目标

当前 POS 设备管理页的「更多操作」中，已有 `License备份/导入` 与 `数据库配置` 等能力，但缺少“整库级”的统一备份与恢复能力。  
业务希望参考 `MenusifuCloudDbBackup.py` 的核心思路，在现有设备管理体系内新增：

- `数据备份`
- `数据恢复`

并满足以下目标：

1. 备份数据优先保存到服务端；
2. 服务端按 `MID` 分目录管理；
3. 文件名使用“版本 + 时间”命名；
4. 支持服务端备份文件的删除与下载；
5. 恢复支持两种来源：服务端选择 + 本地上传；
6. 同时覆盖 Linux 与 Windows POS 设备；
7. 维持当前权限体系（管理员/负责人/借用人）与交互风格（`toast.confirm`）。

---

## 2. 本次头脑风暴确认结论

### 2.1 范围与兼容

- 设备范围：`Linux + Windows`（双端都支持）
- 备份格式：统一逻辑备份（`SQL`）
- 数据范围：整库 `kpos` 全量备份/恢复

### 2.2 命名与存储

- 服务端目录：按 `MID` 分文件夹
- 文件名：`{version}_{yyyyMMdd_HHmmss}.sql`
- 版本来源：设备列表中的 `version` 字段
- 清理策略：不做自动清理，仅手动删除

### 2.3 权限与操作

- 权限口径：管理员 + 负责人 + 当前借用人
- 备份默认动作：仅保存到服务端（不自动下载）
- 恢复后重启：可选、默认不重启
- 平台差异：Windows 不提供重启；Linux 可选重启 POS

### 2.4 连接策略

- 数据库连接使用固定参数（对齐脚本思路）：
  - `host = device.ip`
  - `port = 22108`
  - `database = kpos`
  - 用户名/密码固定配置（后端维护，前端不可见）

---

## 3. 方案对比与选型

### 方案一（采用）：后端统一直连 DB，统一备份恢复

通过服务端直连设备 MySQL 完成导出/导入，Linux 与 Windows 共用同一链路，统一产出 SQL 文件。

**优点**

- 双端体验一致，维护成本低；
- 能天然支持服务端文件管理（列表、下载、删除）；
- 与现有 `device` 域权限模型一致，接入简单。

**缺点**

- 依赖后端到设备 DB 的网络可达性；
- 大文件恢复时需要任务化与超时控制。

### 方案二：Linux 走 SSH 设备侧，Windows 走后端直连

**不采用原因**

- 双链路并存导致测试和问题排查成本高；
- 交互和错误处理难统一。

### 方案三：设备侧 Agent/脚本执行并上报

**不采用原因**

- 需要额外部署和运维体系，不符合当前快速落地目标。

---

## 4. 总体架构设计

## 4.1 前端（POS 列表 + 统一弹窗）

- 在 `ScanTable` 的「更多操作」新增：
  - `数据备份`
  - `数据恢复`
- 由 `ScanPage` 统一承接并打开备份恢复弹窗：
  - Tab1：服务端备份管理
  - Tab2：恢复数据（服务端选择 / 本地上传）

## 4.2 后端（Device 域扩展）

- 在 `device` 域下新增备份恢复接口与处理器逻辑；
- 新增 `DBBackupService`：
  - 备份任务创建与执行
  - 恢复任务创建与执行
  - 文件列表、下载、删除
  - 上传文件暂存与消费

## 4.3 文件存储层

- 根目录建议：`downloads/db-backups`
- 结构：`downloads/db-backups/{MID}/{version}_{timestamp}.sql`
- 支持按 MID 分页列出备份记录

## 4.4 元数据与任务层

建议记录“文件元数据 + 任务状态”，避免每次扫描目录，提升稳定性和可审计性。

---

## 5. 产品交互设计

## 5.1 更多操作入口

- 展示条件：设备有 `merchantId`
- 权限不足时：
  - 按当前项目风格给出提示文案；
  - 不执行请求。

## 5.2 统一弹窗结构

- 标题：`数据备份与恢复`
- 设备信息区：设备名、MID、IP、版本
- Tab：
  - `服务端备份`
  - `恢复数据`

## 5.3 服务端备份 Tab

功能：

1. `创建备份` 按钮（确认后执行）
2. 列表字段：文件名、版本、大小、创建时间、创建人、来源
3. 行内操作：
   - `下载到本地`
   - `删除`

交互规则：

- 创建备份使用 `toast.confirm(..., { variant: 'primary' })`
- 创建成功仅刷新列表，不自动下载
- 删除使用危险确认（默认 danger）

## 5.4 恢复数据 Tab

分为两块来源：

1. 从服务端备份恢复（选择一条已有备份）
2. 从本地上传恢复（上传 `.sql` 后恢复）

公共选项：

- Linux 设备显示：`恢复成功后重启 POS`（默认不勾选）
- Windows 设备不显示重启选项

恢复确认：

- 使用危险确认弹窗；
- 明确提示“恢复将覆盖当前数据库数据”。

## 5.5 状态反馈

- 备份/恢复都展示任务状态（pending/running/success/failed）
- 失败时优先展示后端可读错误文案
- 恢复成功后展示：
  - 数据恢复结果
  - Linux 可选重启结果（如有）

---

## 6. 核心业务流程

## 6.1 数据备份流程（服务端优先）

1. 前端提交 `merchant_id` 创建备份任务；
2. 后端校验权限与设备存在性；
3. 任务进入 `running`；
4. 后端按固定连接参数导出 `kpos` SQL；
5. 临时文件写入完成后原子落盘到 MID 目录；
6. 写入文件元数据；
7. 任务置为 `success`，前端刷新列表。

## 6.2 下载与删除流程

- 下载：按备份记录 ID 返回文件流；
- 删除：删除物理文件 + 元数据记录。

## 6.3 恢复流程（服务端来源）

1. 用户选择服务端备份；
2. 前端发起恢复任务（可选 Linux 重启标记）；
3. 后端读取对应 SQL 文件并导入；
4. 导入成功后，如为 Linux 且勾选重启，则执行重启子步骤；
5. 任务返回最终状态。

## 6.4 恢复流程（本地上传来源）

1. 前端上传 `.sql` 文件到服务端临时区；
2. 上传成功返回 `upload_token`；
3. 使用 `upload_token` 发起恢复任务；
4. 任务执行成功后消费并清理临时文件。

## 6.5 任务状态机

- `pending`：任务已创建
- `running`：执行中
- `success`：执行完成
- `failed`：执行失败
- `canceled`：预留（本期可不开放）

---

## 7. 接口设计（建议）

统一前缀：`/api/device`

## 7.1 备份任务

- `POST /db-backup/jobs`
  - 请求：`{ merchant_id }`
  - 返回：`job_id`, `status`

- `GET /db-backup/jobs/:jobId`
  - 返回：任务状态、进度、错误、关联备份记录 ID

## 7.2 服务端备份文件

- `GET /db-backups?merchant_id={MID}&page=1&page_size=20`
  - 返回：分页列表

- `GET /db-backups/:id/download`
  - 返回：SQL 文件流

- `DELETE /db-backups/:id`
  - 返回：删除结果

## 7.3 本地上传（恢复前置）

- `POST /db-restore/uploads`
  - `multipart/form-data`：`merchant_id`, `file(.sql)`
  - 返回：`upload_token`, `file_name`, `size`

## 7.4 恢复任务

- `POST /db-restore/jobs`
  - 服务端来源：
    - `merchant_id`
    - `source_type = server`
    - `backup_id`
    - `restart_pos_after_restore`（仅 Linux 生效）
  - 本地上传来源：
    - `merchant_id`
    - `source_type = upload`
    - `upload_token`
    - `restart_pos_after_restore`（仅 Linux 生效）

- `GET /db-restore/jobs/:jobId`
  - 返回：状态、进度、错误、恢复摘要、重启结果

---

## 8. 数据模型设计（建议）

## 8.1 `device_db_backup_files`

- `id`
- `merchant_id`
- `version`
- `file_name`
- `relative_path`
- `size_bytes`
- `source_type`（backup/upload）
- `created_by`
- `created_at`

## 8.2 `device_db_backup_jobs`

- `job_id`
- `merchant_id`
- `status`
- `progress`
- `error_message`
- `backup_file_id`
- `requested_by`
- `created_at`
- `started_at`
- `finished_at`

## 8.3 `device_db_restore_jobs`

- `job_id`
- `merchant_id`
- `status`
- `progress`
- `error_message`
- `source_type`
- `source_file_id` / `upload_token`
- `restart_pos_after_restore`
- `restart_result`
- `requested_by`
- `created_at`
- `started_at`
- `finished_at`

## 8.4 `device_db_restore_uploads`（可选）

- `upload_token`
- `merchant_id`
- `original_file_name`
- `temp_path`
- `size_bytes`
- `uploaded_by`
- `created_at`
- `consumed_at`

---

## 9. 权限与安全设计

## 9.1 权限判定

统一沿用现有设备权限口径：

- 管理员
- 设备负责人
- 当前借用人（借用未过期）

## 9.2 安全要求

1. 固定 DB 凭据仅保存在后端配置，不回传前端；
2. 日志中禁止输出明文密码与完整连接串；
3. 上传仅允许 `.sql`；
4. 上传和恢复都要校验文件大小与内容有效性；
5. 所有危险动作必须二次确认。

## 9.3 并发控制

- 同 MID 下备份/恢复互斥；
- 冲突时返回 `409`。

---

## 10. 异常处理规范

- `400`：参数/文件格式不合法
- `401`：未登录
- `403`：无权限
- `404`：设备或备份资源不存在
- `409`：设备已有运行中任务
- `422`：数据库连接失败或 SQL 导入失败
- `500`：系统内部错误

错误文案要求可读，可直接用于前端提示。

---

## 11. 测试与验收

## 11.1 功能验收

- 备份成功落盘到 `MID` 目录；
- 列表、下载、删除正常；
- 服务端来源恢复正常；
- 本地上传来源恢复正常；
- Linux 可选重启有效，Windows 不显示重启。

## 11.2 权限验收

- 管理员 / 负责人 / 当前借用人：可操作；
- 其他用户：403。

## 11.3 跨平台验收

- Linux：备份/恢复/可选重启通过；
- Windows：备份/恢复通过，重启选项隐藏。

## 11.4 边界验收

- 并发冲突返回 409；
- 大文件恢复过程可追踪；
- 非法文件可拦截；
- 设备 DB 不可达时返回明确错误。

## 11.5 回归验收

- 不影响现有 `License备份/导入`；
- 不影响现有 `数据库配置` 模块；
- 不影响其他“更多操作”能力。

---

## 12. 风险与缓解

1. **网络可达性风险**：后端到设备 DB 不可达  
   - 缓解：任务错误信息明确化，增加连接前置校验。

2. **大 SQL 文件恢复耗时风险**  
   - 缓解：任务化 + 超时控制 + 进度轮询。

3. **并发写入风险**  
   - 缓解：MID 级互斥。

4. **误操作风险**  
   - 缓解：危险确认 + 默认不自动重启。

---

## 13. 上线范围与里程碑建议

1. 后端：任务 + 文件管理 + 恢复引擎；
2. 前端：更多菜单入口 + 弹窗交互；
3. 联调：Linux/Windows 双端验证；
4. 灰度：先小范围角色试用，再全量开放。

---

## 14. 文档结论

本设计已完成头脑风暴阶段确认，满足以下核心约束：

- 双端支持（Linux/Windows）
- 统一 SQL 备份恢复
- MID 目录管理 + 版本时间命名
- 服务端优先存储 + 下载/删除能力
- 恢复支持服务端选择与本地上传
- Linux 可选重启、Windows 不重启
- 固定连接参数、整库 `kpos` 范围

文档状态：`Brainstorming 已确认`  
下一步建议：进入实施计划拆解（writing-plans）。
