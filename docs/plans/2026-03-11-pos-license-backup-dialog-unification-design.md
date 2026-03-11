# POS License 备份导入统一 Dialog 设计

## 1. 背景与目标

当前 POS 设备页中：

- `数据备份/恢复` 已经采用独立 dialog，并由服务端统一管理备份文件；
- `License备份` 与 `License导入` 仍是旧交互，分别走直接下载和隐藏文件上传。

这导致两套能力在交互、服务端职责和文件管理方式上都不一致。  
本次目标是将 `License备份导入` 统一改造成与 `数据备份/恢复` 一致的模式：

1. 使用独立 dialog 弹窗承载全部 License 备份与恢复操作；
2. 由服务端统一管理 License 备份文件；
3. License 备份目录与数据备份目录位于同一父级层级；
4. 用户侧能力对齐为：
   - 创建服务端备份
   - 查看服务端备份列表
   - 下载服务端备份
   - 删除服务端备份
   - 从服务端备份恢复
   - 从本地上传 `.sql` 文件恢复

## 2. 已确认需求

本次 brainstorming 已确认采用方案 1：

- License 交互完全对齐数据备份弹窗；
- 服务端新增 License 文件管理能力，而不是继续直接返回 blob；
- 服务端支持“列表 / 下载 / 删除 / 从服务端恢复 / 本地上传恢复”；
- 文件目录与数据备份放在同一层级，但分别管理；
- 权限口径沿用现有设备配置权限：
  - 管理员
  - 设备负责人
  - 当前借用人

## 3. 方案对比与选型

### 方案 A：License 也改造成服务端管理 + 独立 dialog

采用方式：

- 新增 License 备份文件存储与管理 service；
- 前端新增 License 管理弹窗；
- `ScanTable` 中将 `License备份` 和 `License导入` 合并为一个入口；
- 后端接口风格与现有数据库备份接口保持一致。

优点：

- 与 `数据备份/恢复` 交互完全一致；
- 服务端统一保存历史文件，便于回查、下载和重复恢复；
- 前后端职责边界更清晰；
- 后续若要做审计、分页、清理策略也更容易扩展。

缺点：

- 需要补齐一整套 License 文件管理接口与 service。

### 方案 B：仅把 License 导入改成 dialog，备份仍直接下载

不采用原因：

- 仍然保留两套交互模型；
- 不满足“服务端统一管理”和“交互一致”的目标。

### 方案 C：抽象成一个通用备份弹窗，同时承载 License 和数据

不采用原因：

- 本次会把已有数据库备份能力一起重构，范围过大；
- 风险高于当前需求所需。

### 结论

采用方案 A：License 单独做成与数据库备份相同体验的服务端管理 dialog。

## 4. 前端设计

## 4.1 入口收敛

位置：`frontend/src/components/ScanTable.jsx`

现状：

- `License备份`
- `License导入`

调整后：

- 合并为单一菜单项：`License备份/导入`

显示条件保持不变：

- 设备存在 `merchantId`
- 当前用户具备设备配置权限

## 4.2 弹窗结构

新增组件建议：

- `frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx`

布局与 `DBBackupRestoreModal.jsx` 对齐：

1. 顶部信息区
   - 标题：`License备份/导入`
   - 副标题：`MID / IP / version`
2. 风险提示区
   - 提示恢复会覆盖当前 License 配置
3. 工具栏
   - `创建备份`
   - `刷新列表`
4. 服务端备份列表
   - 文件名
   - 大小
   - 时间
   - 操作：`下载 / 恢复 / 删除`
5. 本地上传恢复区
   - 选择 `.sql`
   - 上传并恢复

## 4.3 用户交互规则

- 创建备份前使用 `toast.confirm`
- 从服务端恢复前使用 `toast.confirm`
- 从本地上传恢复前使用 `toast.confirm`
- 列表为空时显示空态
- 所有按钮具备 loading / disabled 状态
- 成功后刷新列表，失败直接展示后端错误文案

## 4.4 ScanPage 状态调整

位置：`frontend/src/pages/ScanPage.jsx`

现状：

- 通过 `licenseFileInputRef` 和 `licenseImportDeviceRef` 处理本地文件导入；
- 备份直接调用 blob 下载；
- 数据备份弹窗由 `dbBackupModal` 独立管理。

调整后：

- 新增 `licenseBackupModal` 状态；
- 移除隐藏文件 input 方案；
- 原 `handleBackupLicense`、`handleImportLicense` 收敛为 `handleOpenLicenseBackupRestore`；
- 由弹窗内部完成列表、下载、恢复、上传恢复等流程。

## 5. 后端设计

## 5.1 接口目标

License 接口风格对齐数据库备份现状，建议新增：

- `POST /api/device/license/backup`
  - 创建并保存服务端备份
- `GET /api/device/license/backups`
  - 查询服务端备份列表
- `GET /api/device/license/backups/download`
  - 下载指定备份
- `DELETE /api/device/license/backups`
  - 删除指定备份
- `POST /api/device/license/restore/server`
  - 从服务端备份恢复
- `POST /api/device/license/restore/upload`
  - 从本地上传文件恢复

说明：

- 保留现有路由前缀 `device/license`，减少概念漂移；
- 原先“直接返回 blob”的 `POST /device/license/backup` 改为返回 JSON，表示服务端备份已创建。

## 5.2 Handler 设计

位置：`backend-go/internal/handlers/device.go` 或新拆分的 License handler 文件。

处理逻辑统一包含：

1. 校验 `merchant_id`
2. 通过 `getPermittedDeviceForLicense` 复用权限校验
3. 定位设备 IP
4. 调用 License 文件管理 service
5. 返回标准 JSON 或文件流

恢复能力拆分为两类：

- 服务端恢复：读取服务端已保存 `.sql`
- 上传恢复：读取用户上传 `.sql` 并执行

## 5.3 Service 设计

现状：

- `LicenseService.Backup(host)` 返回内存中的文件名与内容
- `LicenseService.Import(host, sqlContent)` 直接执行导入

调整方向：

1. 保留已有 SQL 生成和执行核心逻辑；
2. 新增 License 文件管理 service，例如：
   - `CreateBackup(host, merchantID)`
   - `ListBackups(merchantID)`
   - `OpenBackupFile(merchantID, fileName)`
   - `DeleteBackup(merchantID, fileName)`
   - `RestoreFromServerFile(host, merchantID, fileName)`
   - `RestoreFromUploadContent(host, content)`
3. `Backup` 从“生成内存 blob”扩展为“生成内容并保存到磁盘”。

这样可以最大程度复用现有 `LicenseService.Import` 和 SQL 生成逻辑，避免重写业务核心。

## 5.4 文件存储设计

现有数据库备份目录：

- `db-backups/<merchantId>/...`

本次新增 License 目录：

- `license-backups/<merchantId>/...`

两者要求：

- 位于同一父目录下；
- 文件名和路径都经过校验；
- 禁止路径穿越；
- 仅允许 `.sql` 文件参与恢复与下载。

可沿用数据库备份的目录定位思路，统一为：

- `<parent>/db-backups`
- `<parent>/license-backups`

这正好满足“文件夹和数据在同一层级”。

## 6. 数据流

## 6.1 创建备份

1. 用户在扫描页打开 `License备份/导入` 弹窗
2. 点击 `创建备份`
3. 前端调用创建接口并等待完成
4. 后端连接目标设备数据库生成 License SQL
5. 后端保存为服务端文件
6. 前端提示成功并刷新列表

## 6.2 从服务端文件恢复

1. 用户在列表选择某个备份
2. 点击 `恢复`
3. 前端确认风险
4. 后端读取服务端文件内容
5. 后端调用 License 导入逻辑执行 SQL
6. 前端提示恢复结果

## 6.3 从本地上传恢复

1. 用户选择本地 `.sql`
2. 点击 `上传并恢复`
3. 前端确认风险
4. 后端接收上传文件并校验
5. 后端读取内容并执行导入
6. 前端提示恢复结果

## 7. 错误处理

需要覆盖的典型错误：

- 缺少 `merchant_id`
- 设备不存在
- 当前用户无权限
- 设备 IP 为空
- 上传文件不存在
- 非 `.sql` 文件
- 文件为空
- 文件过大
- 服务端备份文件不存在
- SQL 执行失败

前端规则：

- 优先展示后端返回的 `error` 文案；
- 不再使用浏览器原生确认框；
- 操作失败不关闭弹窗，便于用户继续处理。

## 8. 测试策略

## 8.1 后端

重点测试：

- 文件名合法性校验
- 服务端列表排序与返回字段
- 删除与打开文件
- 从服务端恢复
- 上传恢复的扩展名、空文件、超大文件校验
- 权限矩阵

## 8.2 前端

重点测试：

- `ScanTable` 菜单入口由两个合并为一个
- 弹窗打开/关闭状态
- 备份列表加载
- 上传文件后的恢复流程
- 操作按钮 loading 状态

## 9. 影响范围

前端：

- `frontend/src/components/ScanTable.jsx`
- `frontend/src/pages/ScanPage.jsx`
- `frontend/src/services/api.js`
- `frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx`
- `frontend/src/App.css`

后端：

- `backend-go/cmd/server/main.go`
- `backend-go/internal/handlers/device.go`
- `backend-go/internal/services/license_service.go`
- 新增 License 文件管理相关 service / test 文件

## 10. 结论

本次改造不改变 License 备份内容与导入执行逻辑本身，只改变其承载方式：

- 前端统一为 dialog 交互；
- 服务端统一负责文件生命周期；
- 文件目录与数据库备份保持并列层级；
- 用户体验与“数据备份/恢复”完全一致。

文档状态：已确认  
下一步：进入 implementation plan
