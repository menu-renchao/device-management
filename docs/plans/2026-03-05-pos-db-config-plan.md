# POS 数据库配置功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 POS 设备管理中新增“数据库配置”模块，支持设备级 MySQL 连接配置、全局 SQL 模板管理、单设备执行与完整审计，满足普通用户与管理员差异化权限。

**Architecture:** 后端新增 `db-config` 领域（模型、仓储、服务、处理器、路由），执行链路为平台直连 MySQL。前端新增 `DBConfigPage` 并从 POS 列表跳转，页面内完成连接管理、模板管理和执行结果展示。风险 SQL 默认拦截，管理员可强制执行并记录审计。

**Tech Stack:** Go, Gin, GORM, SQLite, database/sql, go-sql-driver/mysql, React, Vite, Axios

---

## Task 0: 基线校验与分支准备

**Files:**
- Modify: 无（仅命令校验）

**Step 1: 检查工作区状态**

Run: `git status -sb`  
Expected: 当前分支干净或仅包含已知文档变更

**Step 2: 后端基线测试**

Run: `cd backend-go && go test ./...`  
Expected: 全部通过（当前输出多为 `[no test files]`）

**Step 3: 前端基线构建**

Run: `cd frontend && npm run build`  
Expected: 构建成功，无 TypeError/编译错误

**Step 4: 创建实现分支（可选）**

Run: `git checkout -b feat/pos-db-config`  
Expected: 分支创建成功

---

## Task 1: 后端 - SQL 分割与风险检测（TDD）

**Files:**
- Create: `backend-go/internal/services/sql_guard.go`
- Test: `backend-go/internal/services/sql_guard_test.go`

**Step 1: 写失败测试（多 SQL 分割 + 风险识别）**

```go
func TestSplitSQLStatements(t *testing.T) {
    raw := "UPDATE a SET b=1;  ;\nDELETE FROM c WHERE id=1;"
    got := SplitSQLStatements(raw)
    if len(got) != 2 {
        t.Fatalf("expected 2, got %d", len(got))
    }
}

func TestDetectSQLRisk(t *testing.T) {
    risk := DetectSQLRisk("DELETE FROM users")
    if !risk.Blocked || risk.Type != "delete_without_where" {
        t.Fatalf("unexpected risk: %+v", risk)
    }
}
```

**Step 2: 运行测试确认失败**

Run: `cd backend-go && go test ./internal/services -run "TestSplitSQLStatements|TestDetectSQLRisk" -v`  
Expected: FAIL（函数未定义）

**Step 3: 最小实现**

在 `sql_guard.go` 实现：
- `SplitSQLStatements(raw string) []string`
- `DetectSQLRisk(sql string) SQLRiskResult`
- 风险类型：`drop`、`truncate`、`delete_without_where`、`update_without_where`

**Step 4: 运行测试确认通过**

Run: `cd backend-go && go test ./internal/services -run "TestSplitSQLStatements|TestDetectSQLRisk" -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/sql_guard.go backend-go/internal/services/sql_guard_test.go
git commit -m "feat: add SQL split and risk guard utilities"
```

---

## Task 2: 后端 - 数据库连接密码加解密工具（TDD）

**Files:**
- Create: `backend-go/pkg/crypto/password_cipher.go`
- Test: `backend-go/pkg/crypto/password_cipher_test.go`

**Step 1: 写失败测试**

```go
func TestEncryptDecrypt(t *testing.T) {
    secret := "dev-secret"
    plain := "P@ssw0rd!"
    encrypted, err := EncryptPassword(plain, secret)
    if err != nil {
        t.Fatal(err)
    }
    decrypted, err := DecryptPassword(encrypted, secret)
    if err != nil {
        t.Fatal(err)
    }
    if decrypted != plain {
        t.Fatalf("want %s got %s", plain, decrypted)
    }
}
```

**Step 2: 运行测试确认失败**

Run: `cd backend-go && go test ./pkg/crypto -run TestEncryptDecrypt -v`  
Expected: FAIL（包或函数不存在）

**Step 3: 最小实现**

实现要点：
- AES-GCM 加解密
- 使用 `sha256(secret)` 生成 32 字节密钥
- 存储格式：`base64(nonce+ciphertext)`

**Step 4: 运行测试确认通过**

Run: `cd backend-go && go test ./pkg/crypto -run TestEncryptDecrypt -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/pkg/crypto/password_cipher.go backend-go/pkg/crypto/password_cipher_test.go
git commit -m "feat: add encrypted storage utility for DB credentials"
```

---

## Task 3: 后端 - 新增模型与仓储层

**Files:**
- Create: `backend-go/internal/models/device_db_connection.go`
- Create: `backend-go/internal/models/db_sql_template.go`
- Create: `backend-go/internal/models/db_sql_execute_task.go`
- Create: `backend-go/internal/repository/device_db_connection_repo.go`
- Create: `backend-go/internal/repository/db_sql_template_repo.go`
- Create: `backend-go/internal/repository/db_sql_execute_task_repo.go`
- Test: `backend-go/internal/repository/db_sql_template_repo_test.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: 写失败仓储测试**

重点覆盖：
- 模板创建/更新/删除
- 按关键词搜索（name/remark）
- 普通用户“仅可修改自己模板”的查询条件方法

Run: `cd backend-go && go test ./internal/repository -run TestDBSQLTemplateRepository -v`  
Expected: FAIL（模型与仓储不存在）

**Step 2: 实现模型**

最少字段：
- `device_db_connections`: merchant_id, host, port, database_name, username, password_encrypted, updated_by
- `db_sql_templates`: name, sql_content, remark, created_by, updated_by, deleted_at
- `db_sql_execute_tasks` + `db_sql_execute_task_items`：任务汇总与语句明细

**Step 3: 实现仓储**

实现接口：
- ConnectionRepo: `GetByMerchantID`, `Upsert`, `Delete`
- TemplateRepo: `List`, `GetByID`, `Create`, `Update`, `Delete`
- ExecuteTaskRepo: `CreateTask`, `AppendItems`, `FinishTask`, `GetTaskDetail`, `ListHistory`

**Step 4: 注册迁移与依赖注入**

修改 `main.go`：
- AutoMigrate 新模型
- 初始化 3 个新 repo（先不接 handler）

**Step 5: 运行测试**

Run:
- `cd backend-go && go test ./internal/repository -run TestDBSQLTemplateRepository -v`
- `cd backend-go && go test ./...`

Expected: PASS

**Step 6: Commit**

```bash
git add backend-go/internal/models backend-go/internal/repository backend-go/cmd/server/main.go
git commit -m "feat: add db-config models and repositories"
```

---

## Task 4: 后端 - 执行服务（连接测试、逐条执行、失败继续）

**Files:**
- Create: `backend-go/internal/services/db_config_service.go`
- Create: `backend-go/internal/services/mysql_executor.go`
- Test: `backend-go/internal/services/db_config_service_test.go`
- Modify: `backend-go/go.mod`

**Step 1: 引入 MySQL 驱动**

Run: `cd backend-go && go get github.com/go-sql-driver/mysql@latest`  
Expected: `go.mod` 与 `go.sum` 更新

**Step 2: 写失败服务测试**

测试用例（使用 fake executor）：
- 普通用户命中风险 SQL -> 拒绝执行
- 管理员强制执行 -> 允许
- 多语句执行中单条失败 -> 继续执行并汇总 `partial_failed`
- 连接失败 -> 任务 `failed`

Run: `cd backend-go && go test ./internal/services -run TestDBConfigService -v`  
Expected: FAIL（服务未实现）

**Step 3: 实现服务核心逻辑**

服务职责：
- 读取并解密设备连接
- 测试连接
- 加载模板并拆分 SQL
- 风险检查 + 权限判断
- 逐条执行（失败继续）
- 写审计任务与明细

**Step 4: 增加设备级执行互斥**

在服务内增加 `merchantID -> mutex` 机制，保证同设备串行执行。

**Step 5: 运行测试**

Run:
- `cd backend-go && go test ./internal/services -run TestDBConfigService -v`
- `cd backend-go && go test ./...`

Expected: PASS

**Step 6: Commit**

```bash
git add backend-go/go.mod backend-go/go.sum backend-go/internal/services
git commit -m "feat: add db-config execution service with risk control and audit"
```

---

## Task 5: 后端 - Handler 与路由接入

**Files:**
- Create: `backend-go/internal/handlers/db_config.go`
- Test: `backend-go/internal/handlers/db_config_test.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: 写失败 Handler 测试**

覆盖场景：
- 无设备权限返回 403
- 普通用户编辑他人模板返回 403
- 普通用户强制执行返回 403
- 执行成功返回任务汇总和明细

Run: `cd backend-go && go test ./internal/handlers -run TestDBConfigHandler -v`  
Expected: FAIL（handler 未实现）

**Step 2: 实现 Handler**

接口：
- `GET /api/db-config/connections/:merchantId`
- `PUT /api/db-config/connections/:merchantId`
- `POST /api/db-config/connections/:merchantId/test`
- `GET /api/db-config/templates`
- `GET /api/db-config/templates/:id`
- `POST /api/db-config/templates`
- `PUT /api/db-config/templates/:id`
- `DELETE /api/db-config/templates/:id`
- `POST /api/db-config/execute`
- `GET /api/db-config/execute/:taskId`
- `GET /api/db-config/execute/history`

**Step 3: 注册路由与注入**

在 `main.go`：
- 创建 `dbConfigService` 与 `dbConfigHandler`
- 挂载 `/api/db-config` 路由组（`middleware.Auth()`）

**Step 4: 运行后端全量测试**

Run: `cd backend-go && go test ./...`  
Expected: PASS

**Step 5: 本地启动验证**

Run: `cd backend-go && go run cmd/server/main.go`  
Expected: 服务正常启动，接口可访问

**Step 6: Commit**

```bash
git add backend-go/internal/handlers backend-go/cmd/server/main.go
git commit -m "feat: expose db-config APIs with role and ownership checks"
```

---

## Task 6: 前端 - API 封装与入口接入

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/ScanTable.jsx`
- Create: `frontend/src/pages/DBConfigPage.jsx`

**Step 1: 增加 API 封装**

在 `api.js` 新增 `dbConfigAPI`：
- 连接配置 CRUD + test
- 模板 CRUD + list
- execute + task detail + history

**Step 2: 增加路由**

在 `App.jsx` 添加：
- `path="/db-config/:merchantId"` -> `DBConfigPage`

**Step 3: 增加 POS 列表入口**

在 `ScanTable.jsx`：
- Linux/Windows 都显示 `数据库配置` 按钮
- 点击跳转时透传 `device` 到 `location.state`
- 设备权限不满足时沿用 toast 提示

**Step 4: 新建页面骨架**

`DBConfigPage.jsx` 先完成：
- 页面头部 + 返回按钮
- merchantId 展示
- 加载连接配置与模板列表

**Step 5: 构建验证**

Run: `cd frontend && npm run build`  
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/services/api.js frontend/src/App.jsx frontend/src/components/ScanTable.jsx frontend/src/pages/DBConfigPage.jsx
git commit -m "feat: add db-config page routing and entry from POS table"
```

---

## Task 7: 前端 - 页面功能实现（连接、模板、执行、结果）

**Files:**
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Create: `frontend/src/components/db-config/ConnectionPanel.jsx`
- Create: `frontend/src/components/db-config/TemplateModal.jsx`
- Create: `frontend/src/components/db-config/ExecuteResultPanel.jsx`

**Step 1: 连接配置区实现**

能力：
- 保存连接信息
- 测试连接
- 密码显示/隐藏
- 更新人/更新时间展示

**Step 2: 模板列表实现**

能力：
- 搜索、分页、复选
- 新增/编辑/删除（权限控制）
- 普通用户对非自己模板：按钮禁用 + 提示

**Step 3: 执行交互实现**

能力：
- 单个执行 + 批量执行
- 使用 `toast.confirm` 做二次确认（禁止 `window.confirm`）
- 风险 SQL 反馈（管理员可强制执行并填理由）
- 展示任务汇总 + SQL 明细

**Step 4: 构建验证**

Run: `cd frontend && npm run build`  
Expected: PASS

**Step 5: 手工冒烟验证**

手工场景：
- 管理员：可编辑他人模板、可强制执行风险 SQL
- 普通用户：仅可改自己模板、执行需有设备权限
- 模板多 SQL：失败继续，结果面板汇总正确

**Step 6: Commit**

```bash
git add frontend/src/pages/DBConfigPage.jsx frontend/src/components/db-config
git commit -m "feat: implement db-config UI for connection, template management and execution"
```

---

## Task 8: 联调、验收与文档补充

**Files:**
- Modify: `README.md`
- Modify: `docs/development-guide.md`
- Modify: `docs/architecture-overview.md`

**Step 1: 联调脚本执行**

Run:
- `cd backend-go && go test ./...`
- `cd frontend && npm run build`

Expected: 全通过

**Step 2: 按需求文档做验收清单**

验收重点：
- Linux/Windows 均有入口
- 权限矩阵正确
- 风险 SQL 拦截逻辑正确
- 审计记录完整

**Step 3: 更新文档**

- `README.md`：新增 DB 配置功能说明
- `docs/development-guide.md`：新增 `db-config` API 清单
- `docs/architecture-overview.md`：新增模块关系图说明

**Step 4: 最终 Commit**

```bash
git add README.md docs/development-guide.md docs/architecture-overview.md
git commit -m "docs: update architecture and guide for db-config module"
```

---

## 统一验收命令（最终）

```bash
cd backend-go && go test ./...
cd ../frontend && npm run build
```

Expected:
- 后端测试全部 PASS
- 前端构建成功
- 无新增高优先级回归问题

---

## 风险与回滚预案

1. **风险 SQL 误判**：先保守拦截，提供管理员强制执行；日志记录误判案例，后续优化规则。
2. **连接信息泄露风险**：仅存密文，不在接口与日志回传明文。
3. **并发执行冲突**：设备级互斥锁，避免同设备并发写入。
4. **性能风险**：模板列表分页，执行结果按需加载明细。

回滚策略：
- 后端：可关闭 `/api/db-config` 路由组（临时开关）并回退迁移版本。
- 前端：隐藏 `数据库配置` 入口按钮，保留原有业务路径。
