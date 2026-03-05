# POS License 备份/导入功能 Implementation Plan

**Goal:** 在 POS 设备列表“更多”菜单新增 `License备份` 与 `License导入`，对齐参考实现逻辑，满足固定连接参数、权限控制、离线失败提示、`.sql` 导入事务回滚等需求。

**Architecture:** 后端在 `device` 领域新增 License 专用服务与接口；前端在 `ScanTable + ScanPage + api.js` 完成入口、确认、上传下载与结果提示。导入执行全事务，失败回滚。

**Tech Stack:** Go, Gin, GORM, database/sql, go-sql-driver/mysql, React, Axios

---

## Task 0: 基线检查

**Files:**

- Modify: 无

**Steps:**

1. Run `git status -sb`，确认当前分支状态
2. Run `cd backend-go && go test ./...`，确认后端基线可用
3. Run `cd frontend && npm run build`，确认前端基线可用

**Expected:**

- 后端测试与前端构建通过

---

## Task 1: 后端新增 License 服务（SQL 生成与导入执行）

**Files:**

- Create: `backend-go/internal/services/license_service.go`
- Create: `backend-go/internal/services/license_service_test.go`

**目标：**

- 固定参数连接目标 MySQL
- 生成备份 SQL（完全对齐参考实现范围）
- 导入 SQL 事务执行（失败回滚）

**关键实现点：**

1. 连接构建（固定）
   - host: 设备IP
   - port: 22108
   - db: kpos
   - user/password: 固定凭据
2. 备份
   - `company_profile` 查询 + `UPDATE` 语句生成
   - `system_configuration` 指定键 `DELETE + INSERT`
   - 追加额外 SQL 段
   - 输出 `License{merchantId}_{timestamp}.sql`
3. 导入
   - SQL 安全切分（考虑字符串内分号）
   - 跳过空语句/注释
   - 事务执行，任一失败回滚

**验证：**

- `go test ./internal/services -run TestLicenseService -v`

---

## Task 2: 后端接入 Device Handler 与路由

**Files:**

- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`

**目标：**

- 暴露接口
  - `POST /api/device/license/backup`
  - `POST /api/device/license/import`
- 复用现有设备权限口径（管理员/负责人/借用人）

**关键实现点：**

1. 请求参数校验
   - 备份：`merchant_id` 必填
   - 导入：`merchant_id` + `file(.sql)` 必填
2. 权限校验
   - 复用设备域现有规则
3. 设备定位
   - 通过 `merchant_id` 查 `scan_results` 获取设备IP
4. 响应
   - 备份：附件下载（`Content-Disposition`）
   - 导入：返回 `executed_count` / `failed_index`

**验证：**

- `go test ./internal/handlers -run TestDeviceHandler -v`
- `go test ./...`

---

## Task 3: 前端 API 封装

**Files:**

- Modify: `frontend/src/services/api.js`

**目标：**

- 新增 License API 方法

**建议方法：**

1. `deviceAPI.backupLicense(merchantId)`  
   - 发送 JSON 请求，`responseType: 'blob'`
2. `deviceAPI.importLicense(merchantId, file)`  
   - `FormData` 上传 `.sql`

**验证：**

- 前端类型与调用链路可编译

---

## Task 4: 前端“更多”菜单新增入口

**Files:**

- Modify: `frontend/src/components/ScanTable.jsx`
- （如需）Modify: `frontend/src/App.css`

**目标：**

- 在“更多”中新增：
  - `License备份`
  - `License导入`

**规则：**

- 仅 `hasMerchantId` 时显示（离线也显示）
- 点击触发回调给 `ScanPage`

---

## Task 5: 前端页面交互实现（ScanPage）

**Files:**

- Modify: `frontend/src/pages/ScanPage.jsx`

**目标：**

- 接管两个新动作
- 提供确认、上传、下载、结果提示

**关键实现点：**

1. `License备份`
   - `toast.confirm(..., { variant: 'primary' })`
   - 调 `deviceAPI.backupLicense`
   - blob 下载文件
2. `License导入`
   - 文件选择仅 `.sql`
   - `toast.confirm`（危险操作）
   - 调 `deviceAPI.importLicense`
3. 错误处理
   - 统一展示后端错误文案
   - 离线/连接失败提示可读
4. 约束
   - 不使用 `window.confirm/alert/prompt`

---

## Task 6: 联调与验收

**验证清单：**

1. 权限验证
   - 管理员/负责人/借用人可执行
   - 其他用户 403
2. 显示验证
   - 有 `merchantId` 的设备，无论在线离线都显示入口
3. 备份验证
   - 正常下载 `.sql`
   - 内容包含 `company_profile`、`system_configuration`、额外 SQL
4. 导入验证
   - `.sql` 上传成功
   - 单条失败触发事务回滚
5. 回归验证
   - 不影响现有“更多”菜单其他动作

**最终命令：**

```bash
cd backend-go && go test ./...
cd ../frontend && npm run build
```

---

## 建议提交拆分

1. `feat: add backend license backup/import service and APIs`
2. `feat: add POS more-menu license backup/import actions`
3. `test: add license service handler coverage`（如测试独立提交）

