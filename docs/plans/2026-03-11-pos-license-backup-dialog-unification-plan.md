# POS License 备份导入统一 Dialog Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 将 POS 设备页中的 License 备份导入改造成与数据备份/恢复一致的服务端管理 dialog。

**Architecture:** 前端收敛为单一 `License备份/导入` 入口，并使用独立弹窗承载服务端列表、下载、删除、服务端恢复和本地上传恢复。后端在保留现有 License SQL 生成与导入逻辑的基础上，补齐服务端文件管理接口，并将 `license-backups` 与 `db-backups` 放在同一父级目录下。

**Tech Stack:** React, Axios, Go, Gin, `database/sql`, 本地文件系统

---

### Task 1: 写 License 文件管理 service 的失败测试

**Files:**
- Create: `backend-go/internal/services/license_backup_storage_test.go`
- Reference: `backend-go/internal/services/db_backup_service.go`

**Step 1: Write the failing test**

为以下行为分别写测试：

- `ListBackups` 按修改时间倒序返回 `.sql` 文件
- `DeleteBackup` 会拒绝非法文件名
- `OpenBackupFile` 只允许读取当前商家目录下的 `.sql`
- `RestoreFromServerFile` 会先解析服务端文件再调用导入逻辑

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestLicenseBackupStorage -v`

Expected: FAIL，提示缺少对应的 License 文件管理实现。

**Step 3: Write minimal implementation**

先创建最小的 service 骨架与必要接口，让测试进入真正的行为失败而不是编译失败。

**Step 4: Run test to verify it still fails for the right reason**

Run: `go test ./internal/services -run TestLicenseBackupStorage -v`

Expected: FAIL，失败点变成返回值不符合预期，而不是找不到类型或方法。

**Step 5: Commit**

```bash
git add backend-go/internal/services/license_backup_storage_test.go backend-go/internal/services/license_backup_storage.go
git commit -m "test: add failing tests for license backup storage"
```

### Task 2: 实现 License 文件管理 service

**Files:**
- Create: `backend-go/internal/services/license_backup_storage.go`
- Modify: `backend-go/internal/services/license_service.go`
- Test: `backend-go/internal/services/license_backup_storage_test.go`

**Step 1: Write the failing test**

补一条测试验证“创建服务端备份后会保存到 `license-backups/<merchantId>`，且文件名合法”。

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestLicenseBackupStorage -v`

Expected: FAIL，提示未创建文件或路径不符合预期。

**Step 3: Write minimal implementation**

实现：

- `licenseBackupsRootDir()`
- `ensureMerchantDir(merchantID)`
- `resolveBackupPath(merchantID, fileName)`
- `ListBackups / OpenBackupFile / DeleteBackup`
- `CreateBackup(host, merchantID)`：复用现有 SQL 生成逻辑并落盘
- `RestoreFromServerFile(host, merchantID, fileName)`：读取文件并复用导入逻辑

同时把现有 `Backup(host)` 拆成更易复用的“生成文件名 + 内容”能力，避免重复拼装 SQL。

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestLicenseBackupStorage -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/license_service.go backend-go/internal/services/license_backup_storage.go backend-go/internal/services/license_backup_storage_test.go
git commit -m "feat: add server-managed license backup storage"
```

### Task 3: 写 License handler 接口的失败测试

**Files:**
- Create: `backend-go/internal/handlers/device_license_backup_test.go`
- Reference: `backend-go/internal/handlers/device.go`
- Reference: `backend-go/internal/handlers/device_db_backup.go`

**Step 1: Write the failing test**

为以下接口写 handler 测试：

- `GET /device/license/backups`
- `GET /device/license/backups/download`
- `DELETE /device/license/backups`
- `POST /device/license/restore/server`
- `POST /device/license/restore/upload`

至少覆盖：

- 缺少 `merchant_id`
- 非法文件扩展名
- 权限不足返回 403
- 成功返回统一 JSON 或文件流

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestDeviceLicenseBackupHandlers -v`

Expected: FAIL，提示路由或 handler 尚未实现。

**Step 3: Write minimal implementation**

先在 `DeviceHandler` 中补最小的 handler 方法签名和依赖注入，保证测试进入业务失败。

**Step 4: Run test to verify it still fails for the right reason**

Run: `go test ./internal/handlers -run TestDeviceLicenseBackupHandlers -v`

Expected: FAIL，失败点落在响应内容或状态码不符合预期。

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device_license_backup_test.go backend-go/internal/handlers/device.go
git commit -m "test: add failing tests for license backup handlers"
```

### Task 4: 实现 License 服务端管理接口

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/handlers/device_license_backup_test.go`

**Step 1: Write the failing test**

补一条测试验证 `POST /device/license/backup` 现在返回 JSON 创建结果，而不再直接返回 blob。

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestDeviceLicenseBackupHandlers -v`

Expected: FAIL，提示返回格式仍不匹配。

**Step 3: Write minimal implementation**

实现并注册接口：

- `POST /device/license/backup`
- `GET /device/license/backups`
- `GET /device/license/backups/download`
- `DELETE /device/license/backups`
- `POST /device/license/restore/server`
- `POST /device/license/restore/upload`

要求：

- 统一复用 `getPermittedDeviceForLicense`
- 上传恢复保留 `.sql`、空文件、大小限制校验
- 下载接口返回文件流
- 创建备份接口返回备份元信息

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestDeviceLicenseBackupHandlers -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device.go backend-go/cmd/server/main.go backend-go/internal/handlers/device_license_backup_test.go
git commit -m "feat: add license backup management APIs"
```

### Task 5: 写前端 API 和入口收敛的失败测试

**Files:**
- Create: `frontend/src/pages/scanPageLicenseModalState.test.js`
- Modify: `frontend/src/components/ScanTable.jsx`
- Modify: `frontend/src/services/api.js`

**Step 1: Write the failing test**

至少验证：

- `ScanTable` 只暴露一个 `License备份/导入` 菜单入口
- 页面状态从“打开旧备份/导入动作”变为“打开 License 弹窗”

**Step 2: Run test to verify it fails**

Run: `npm test -- scanPageLicenseModalState.test.js`

Expected: FAIL，提示入口文案或状态管理与预期不一致。

**Step 3: Write minimal implementation**

先在 `ScanTable` 中合并入口，并在 `api.js` 中补齐新接口方法：

- `backupLicense`
- `listLicenseBackups`
- `downloadLicenseBackupUrl`
- `deleteLicenseBackup`
- `restoreLicenseFromServer`
- `restoreLicenseFromUpload`

**Step 4: Run test to verify it passes**

Run: `npm test -- scanPageLicenseModalState.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/ScanTable.jsx frontend/src/services/api.js frontend/src/pages/scanPageLicenseModalState.test.js
git commit -m "refactor: unify license entry around modal state"
```

### Task 6: 写 License 弹窗组件的失败测试

**Files:**
- Create: `frontend/src/components/license-backup/licenseBackupRestoreModal.test.js`
- Create: `frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx`
- Reference: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`

**Step 1: Write the failing test**

覆盖以下行为：

- 打开弹窗时自动加载服务端列表
- 点击“创建备份”会调用创建接口并刷新列表
- 选择本地 `.sql` 后可触发上传恢复
- 每条列表项具备“下载 / 恢复 / 删除”按钮

**Step 2: Run test to verify it fails**

Run: `npm test -- licenseBackupRestoreModal.test.js`

Expected: FAIL，提示组件不存在或行为未实现。

**Step 3: Write minimal implementation**

实现 `LicenseBackupRestoreModal.jsx`，结构和 `DBBackupRestoreModal.jsx` 对齐：

- 头部设备信息
- 工具栏
- 服务端备份表格
- 本地上传恢复区

优先复用现有 CSS 风格，必要时新增少量 class。

**Step 4: Run test to verify it passes**

Run: `npm test -- licenseBackupRestoreModal.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx frontend/src/components/license-backup/licenseBackupRestoreModal.test.js frontend/src/App.css
git commit -m "feat: add license backup restore modal"
```

### Task 7: 接入 ScanPage 并移除旧交互

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/components/ScanTable.jsx`
- Create: `frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx`

**Step 1: Write the failing test**

补一条页面测试，验证：

- 点击 `License备份/导入` 后打开新弹窗
- 页面不再依赖隐藏文件 input 触发 License 导入

**Step 2: Run test to verify it fails**

Run: `npm test -- scanPageLicenseModalState.test.js`

Expected: FAIL，提示旧的隐藏 input 逻辑仍存在或弹窗未挂载。

**Step 3: Write minimal implementation**

在 `ScanPage.jsx` 中：

- 新增 `licenseBackupModal` 状态
- 接入 `LicenseBackupRestoreModal`
- 删除 `licenseFileInputRef`
- 删除 `licenseImportDeviceRef`
- 删除旧的 `handleLicenseFileChange`
- 将 `handleBackupLicense` / `handleImportLicense` 收敛为打开弹窗

**Step 4: Run test to verify it passes**

Run: `npm test -- scanPageLicenseModalState.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/ScanPage.jsx frontend/src/components/ScanTable.jsx frontend/src/components/license-backup/LicenseBackupRestoreModal.jsx
git commit -m "feat: replace legacy license flow with dialog workflow"
```

### Task 8: 全量验证与文档补充

**Files:**
- Modify: `docs/development-guide.md`
- Modify: `docs/architecture-overview.md`

**Step 1: Write the failing test**

这一阶段不新增产品行为测试，直接补最小文档更新。

**Step 2: Run verification commands**

Run: `go test ./...`

Expected: PASS

Run: `npm run build`

Expected: PASS

如果前端已有可执行测试命令，再补跑新增测试文件。

**Step 3: Write minimal documentation**

更新文档说明：

- License 现在走服务端统一管理
- 目录层级：`license-backups` 与 `db-backups` 同级
- 扫描页入口改为单一 dialog

**Step 4: Run verification again**

Run: `go test ./... && npm run build`

Expected: 全部通过

**Step 5: Commit**

```bash
git add docs/development-guide.md docs/architecture-overview.md
git commit -m "docs: document unified license backup dialog flow"
```

Plan complete and saved to `docs/plans/2026-03-11-pos-license-backup-dialog-unification-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh session per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
