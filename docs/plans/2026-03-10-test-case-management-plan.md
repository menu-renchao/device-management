# 测试用例管理平台（TCM）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 device_management 仓库内实现「测试用例管理」模块：用例库、计划与轮次、执行与结果、本地/外部缺陷联动与双向追溯；小团队权限（管理员/成员）、可选仪表盘与导出、外部缺陷链接配置。

**Architecture:** 后端 Go (Gin) 新增 `/api/tcm` 路由组，SQLite + GORM 新增 TCM 相关表与模型；前端 React 新增 `/tcm` 路由与页面，复用现有鉴权与 UI 规范（Ant Design、toast.confirm）。设计文档见 `docs/plans/2026-03-10-test-case-management-design.md`。

**Tech Stack:** Go 1.x, Gin, GORM, SQLite; React, Vite, Ant Design; 现有 auth middleware、response 包、前端 api 与 ToastContext。

---

## Phase 1：数据模型与基础 API

### Task 1：TCM 数据模型（Project / Module / TestCase）

**Files:**
- Create: `backend-go/internal/models/tcm_project.go`
- Create: `backend-go/internal/models/tcm_module.go`
- Create: `backend-go/internal/models/tcm_test_case.go`

**Step 1：新增 Project 模型**

在 `backend-go/internal/models/tcm_project.go` 中定义：

```go
package models

import "time"

type TCMProject struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"size:20;uniqueIndex;not null" json:"key"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (TCMProject) TableName() string { return "tcm_projects" }
```

**Step 2：新增 Module 模型**

在 `backend-go/internal/models/tcm_module.go` 中定义：项目下层级目录，父模块可为空表示根。

```go
package models

import "time"

type TCMModule struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	ProjectID  uint       `gorm:"not null;index" json:"project_id"`
	ParentID   *uint      `gorm:"index" json:"parent_id"`
	Name       string     `gorm:"size:200;not null" json:"name"`
	SortOrder  int        `gorm:"default:0" json:"sort_order"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (TCMModule) TableName() string { return "tcm_modules" }
```

**Step 3：新增 TestCase 模型**

在 `backend-go/internal/models/tcm_test_case.go` 中定义：标题、前置条件、步骤 JSON、优先级、类型、状态、标签 JSON、所属项目与模块。

```go
package models

import "time"

type TCMTestCase struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ProjectID     uint      `gorm:"not null;index" json:"project_id"`
	ModuleID      *uint     `gorm:"index" json:"module_id"`
	Title         string    `gorm:"size:500;not null" json:"title"`
	Precondition  string    `gorm:"type:text" json:"precondition"`
	Steps         string    `gorm:"type:text" json:"steps"` // JSON: [{order, action, expected}]
	Priority      string    `gorm:"size:20;default:medium" json:"priority"` // low/medium/high
	CaseType      string    `gorm:"size:20;default:functional" json:"case_type"` // functional/regression/exploratory
	Status        string    `gorm:"size:20;default:draft" json:"status"` // draft/reviewed/deprecated
	Tags          string    `gorm:"type:text" json:"tags"` // JSON array of strings
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (TCMTestCase) TableName() string { return "tcm_test_cases" }
```

**Step 4：在 main.go 中注册 AutoMigrate**

修改：`backend-go/cmd/server/main.go`，在 `db.AutoMigrate(...)` 中追加：

- `&models.TCMProject{}`
- `&models.TCMModule{}`
- `&models.TCMTestCase{}`

**Step 5：验证并提交**

运行 `go build ./cmd/server`，通过后提交：

```bash
git add backend-go/internal/models/tcm_*.go backend-go/cmd/server/main.go
git commit -m "feat(tcm): add Project, Module, TestCase models"
```

---

### Task 2：TCM 计划 / 轮次 / Run-Case 模型

**Files:**
- Create: `backend-go/internal/models/tcm_plan_run.go`

**Step 1：定义 TestPlan、TestRun、RunCase**

在 `backend-go/internal/models/tcm_plan_run.go` 中：

- `TCMTestPlan`：ID, ProjectID, Name, Description, CreatedAt, UpdatedAt；表名 `tcm_test_plans`。
- `TCMTestRun`：ID, PlanID, Name, Description, CreatedAt, UpdatedAt；表名 `tcm_test_runs`。
- `TCMRunCase`：ID, RunID, TestCaseID, Result(not_run/pass/fail/blocked/skip), ExecutorID(*uint), ExecutedAt(*time.Time), Comment；表名 `tcm_run_cases`。

**Step 2：注册迁移**

在 `main.go` 的 AutoMigrate 中追加 `&models.TCMTestPlan{}`, `&models.TCMTestRun{}`, `&models.TCMRunCase{}`。

**Step 3：提交**

```bash
git add backend-go/internal/models/tcm_plan_run.go backend-go/cmd/server/main.go
git commit -m "feat(tcm): add TestPlan, TestRun, RunCase models"
```

---

### Task 3：TCM 缺陷与关联模型

**Files:**
- Create: `backend-go/internal/models/tcm_bug.go`

**Step 1：本地缺陷与 Run-Case–缺陷关联**

- `TCMLocalBug`：ID, Title, Description, Status(new/open/closed), CreatedByID, CreatedAt, UpdatedAt；表名 `tcm_local_bugs`。
- `TCMRunCaseBug`：RunCaseID, BugType(local/external), LocalBugID(*uint), ExternalSource(string), ExternalKey(string)；复合主键 (run_case_id, bug_type, local_bug_id 或 external_key)；表名 `tcm_run_case_bugs`。为简化，可用自增 ID + 唯一约束表示一条关联。

**Step 2：外部缺陷仅存引用**

外部缺陷不建独立表，仅在 `TCMRunCaseBug` 中存 ExternalSource + ExternalKey；列表展示时用配置的链接模板拼 URL。

**Step 3：注册迁移并提交**

在 main.go 中追加 `&models.TCMLocalBug{}`, `&models.TCMRunCaseBug{}`，提交。

---

### Task 4：TCM Repository 层（Project / Module / TestCase）

**Files:**
- Create: `backend-go/internal/repositories/tcm_repo.go`

**Step 1：实现 Project CRUD**

- ListProjects()
- GetProjectByID(id)
- CreateProject(project)
- UpdateProject(project)
- DeleteProject(id)（若存在用例/计划需决定是否禁止或级联，先禁止删除有关联数据的项目）

**Step 2：实现 Module CRUD**

- ListModules(projectID, parentID *uint)
- CreateModule, UpdateModule, DeleteModule

**Step 3：实现 TestCase CRUD 与列表查询**

- ListTestCases(projectID, moduleID, priority, caseType, status, tag, keyword string, page, pageSize)
- GetTestCaseByID, CreateTestCase, UpdateTestCase, DeleteTestCase

**Step 4：提交**

```bash
git add backend-go/internal/repositories/tcm_repo.go
git commit -m "feat(tcm): add TCM repository for project, module, test case"
```

---

### Task 5：TCM Handler 与路由（Project / TestCase 基础 API）

**Files:**
- Create: `backend-go/internal/handlers/tcm_handler.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1：在 main.go 中初始化 TCM 依赖**

- 注入 tcmRepo（或拆成 projectRepo/caseRepo 等，此处可先统一用 tcm_repo）。
- 创建 TCMHandler，注册路由组：`tcm := api.Group("/tcm")`，使用 `middleware.Auth()`。

**Step 2：实现项目 API**

- GET `/tcm/projects` → ListProjects
- POST `/tcm/projects` → CreateProject
- GET `/tcm/projects/:id` → GetProjectByID
- PUT `/tcm/projects/:id` → UpdateProject
- DELETE `/tcm/projects/:id` → DeleteProject（无关联数据时允许）

**Step 3：实现用例 API**

- GET `/tcm/projects/:projectId/cases` → ListTestCases（query: moduleId, priority, type, status, tag, keyword, page, pageSize）
- POST `/tcm/projects/:projectId/cases` → CreateTestCase
- GET `/tcm/cases/:id` → GetTestCaseByID
- PUT `/tcm/cases/:id` → UpdateTestCase
- DELETE `/tcm/cases/:id` → DeleteTestCase

**Step 4：实现模块 API**

- GET `/tcm/projects/:projectId/modules` → ListModules（query: parentId）
- POST `/tcm/projects/:projectId/modules` → CreateModule
- PUT `/tcm/modules/:id` → UpdateModule
- DELETE `/tcm/modules/:id` → DeleteModule

**Step 5：统一使用现有 response 包返回 JSON；提交**

---

## Phase 2：用例管理前端

### Task 6：前端 TCM 路由与布局

**Files:**
- Create: `frontend/src/pages/tcm/TCMLayout.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1：新增 TCM 路由**

在 App.jsx 中增加 `/tcm` 路由（PrivateRoute），渲染 TCMLayout；TCMLayout 内使用子路由：`/tcm` 默认重定向到用例列表，`/tcm/cases`、`/tcm/plans` 等（按后续 Task 扩展）。

**Step 2：TCMLayout 左侧菜单**

菜单项：项目选择（下拉或列表）、用例库、测试计划（占位）、设置（占位）。顶部可显示当前项目名称。

**Step 3：提交**

```bash
git add frontend/src/App.jsx frontend/src/pages/tcm/TCMLayout.jsx
git commit -m "feat(tcm): add TCM route and layout"
```

---

### Task 7：TCM API 客户端与项目/模块选择

**Files:**
- Create: `frontend/src/api/tcm.js`

**Step 1：封装 TCM API**

- getProjects(), createProject(), getProject(id), updateProject(), deleteProject()
- getModules(projectId, parentId), createModule(), updateModule(), deleteModule()
- getCases(projectId, params), getCase(id), createCase(), updateCase(), deleteCase()

使用现有 axios 实例（带 auth）请求 `/api/tcm/...`。

**Step 2：在 TCMLayout 中实现项目下拉与模块树**

- 进入 TCM 时拉取项目列表；选择项目后拉取模块树（递归或扁平带 parentId）。
- 将当前 projectId 存入 state 或 context，供用例列表使用。

**Step 3：提交**

---

### Task 8：用例列表与筛选

**Files:**
- Create: `frontend/src/pages/tcm/CaseListPage.jsx`

**Step 1：列表页**

- 表格列：标题、优先级、类型、状态、模块、更新时间；操作：查看、编辑、删除。
- 筛选：模块（树选）、优先级、类型、状态、标签、关键字；分页。

**Step 2：删除前使用 toast.confirm（danger）确认；删除后刷新列表。**

**Step 3：提交**

---

### Task 9：用例详情与编辑（步骤编辑）

**Files:**
- Create: `frontend/src/pages/tcm/CaseDetailPage.jsx` 或 CaseForm 组件

**Step 1：表单字段**

标题（必填）、前置条件、步骤列表（序号 + 操作 + 预期结果，可增删改顺序）、优先级、类型、状态、标签（多选或输入）。

**Step 2：步骤用动态列表（Ant Design Form.List 或手写列表），每项 3 个输入框。**

**Step 3：新建 / 编辑共用表单；提交时调用 createCase 或 updateCase；提交后跳转列表或详情。**

**Step 4：提交**

---

## Phase 3：计划与执行

### Task 10：Plan / Run / RunCase Repository 与 API

**Files:**
- Modify: `backend-go/internal/repositories/tcm_repo.go`
- Modify: `backend-go/internal/handlers/tcm_handler.go`

**Step 1：Repository**

- TestPlan: ListPlans(projectID), GetPlanByID, CreatePlan, UpdatePlan, DeletePlan；CreatePlan 时接收 caseIds，不在此处生成 Run。
- TestRun: ListRuns(planID), GetRunByID, CreateRun(planID)：根据 Plan 关联的用例生成 RunCase 记录（Result=not_run）。
- RunCase: ListRunCases(runID), GetRunCaseByID, UpdateRunCaseResult(runCaseID, result, executorID, comment, executedAt)。

**Step 2：API**

- GET/POST `/tcm/projects/:projectId/plans`；GET/PUT/DELETE `/tcm/plans/:id`。创建 Plan 时 body 含 caseIds（或 moduleIds/tag 筛选，首版可仅 caseIds）。
- GET/POST `/tcm/plans/:planId/runs`；GET `/tcm/runs/:id`。POST run 时生成 RunCase。
- GET `/tcm/runs/:runId/cases`；PUT `/tcm/run-cases/:id/result`（body: result, comment, executedAt 可选）。

**Step 3：提交**

---

### Task 11：计划与轮次前端

**Files:**
- Create: `frontend/src/pages/tcm/PlanListPage.jsx`
- Create: `frontend/src/pages/tcm/PlanFormPage.jsx` 或 PlanForm 组件
- Create: `frontend/src/pages/tcm/RunListPage.jsx`
- Create: `frontend/src/pages/tcm/RunExecutePage.jsx`

**Step 1：计划列表**

- 按项目筛选；表格：计划名、描述、创建时间；操作：新建、编辑、删除、进入「轮次列表」。

**Step 2：新建计划**

- 选择项目后，从用例列表多选用例（或按模块/标签筛选后勾选），保存为 Plan 的 caseIds；调用 POST plans。

**Step 3：轮次列表**

- 某计划下：表格 Run 名称、创建时间、统计（总数/通过/失败/未执行）；操作：新建轮次、进入执行。

**Step 4：新建轮次**

- 输入名称、描述，POST runs，生成 RunCase 后跳转执行页。

**Step 5：执行页**

- 展示 RunCase 列表：用例标题、步骤摘要、结果、执行人、时间、备注。每行可操作：选择结果（通过/失败/阻塞/跳过）、填备注、保存。失败时可「关联缺陷」（下一 Phase 实现）。统计栏：通过率、未执行数等。

**Step 6：提交**

---

## Phase 4：缺陷与联动

### Task 12：本地缺陷与 RunCase–缺陷关联 API

**Files:**
- Modify: `backend-go/internal/repositories/tcm_repo.go`
- Modify: `backend-go/internal/handlers/tcm_handler.go`

**Step 1：Repository**

- LocalBug: Create, GetByID, List（筛选 status、关联的 runCaseId 等）, Update, Delete。
- RunCaseBug: AddLink(runCaseID, bugType, localBugID or externalSource+externalKey), RemoveLink, ListByRunCase(runCaseID), ListByBug(localBugID 或 externalKey)。

**Step 2：API**

- POST `/tcm/bugs`（body: title, description, status）创建本地缺陷；可选 body 中 runCaseId 直接关联。
- GET `/tcm/bugs`（query: status, runCaseId）；GET `/tcm/bugs/:id`；PUT `/tcm/bugs/:id`；DELETE `/tcm/bugs/:id`。
- POST `/tcm/run-cases/:id/bugs`（body: bugType=local&localBugId= 或 bugType=external&source=Jira&key=PROJ-123）；DELETE `/tcm/run-cases/:runCaseId/bugs/:linkId`。
- GET RunCase 详情时返回关联的 bugs 列表（含本地与外部）；GET Bug 详情时返回关联的 runCaseIds/case 信息。

**Step 3：提交**

---

### Task 13：缺陷联动前端

**Files:**
- Create: `frontend/src/pages/tcm/BugListPage.jsx`
- Modify: `frontend/src/pages/tcm/RunExecutePage.jsx`（或 RunCase 详情组件）

**Step 1：执行页失败时「关联缺陷」**

- 弹窗：选择「已有本地缺陷」或「填写外部单号」（下拉选来源 + 输入 key）；或「新建本地缺陷并关联」。调用 POST run-cases/:id/bugs。

**Step 2：RunCase 行展示已关联缺陷**

- 显示缺陷标题或外部 key + 链接（若配置了链接模板）；点击可跳转缺陷详情或外链。

**Step 3：缺陷列表页**

- 表格：标题/外部 key、类型（本地/外部）、状态、关联用例数；操作：查看、编辑（仅本地）、删除。详情页展示「关联的 RunCase / 用例」列表。

**Step 4：提交**

---

## Phase 5：权限、仪表盘、导出与配置

### Task 14：TCM 权限与外部链接配置

**Files:**
- Modify: `backend-go/internal/handlers/tcm_handler.go`
- Create 或 Modify: 系统配置表/接口存「外部缺陷系统」列表（名称 + 链接模板）

**Step 1：权限**

- 所有 TCM 路由已用 `middleware.Auth()`；管理员与成员均可使用 TCM 功能。若需「仅管理员可删项目/计划」等，在对应 handler 内用现有 userRepo 查 role，仅 admin 可执行删除（与设计一致：成员不可改系统设置，可理解为 TCM 内「项目/计划删除」为系统级操作，可选仅 admin）。

**Step 2：外部缺陷系统配置**

- 在 system_config 或单独表存 JSON：`[{ "name": "Jira", "linkTemplate": "https://jira.company.com/browse/{key}" }]`。GET `/tcm/settings/external-bugs` 返回列表；PUT 仅 admin 可修改。前端执行页「关联外部缺陷」时下拉来源，用 linkTemplate 渲染链接。

**Step 3：提交**

---

### Task 15：仪表盘与导出

**Files:**
- Create: `backend-go/internal/handlers/tcm_dashboard.go` 或合入 tcm_handler
- Create: `frontend/src/pages/tcm/DashboardPage.jsx`

**Step 1：仪表盘 API**

- GET `/tcm/dashboard`：返回各项目最近计划/轮次、通过率、未执行数、失败且已关联缺陷数等（按设计文档「可选简单汇总」）。

**Step 2：仪表盘页**

- 卡片或表格展示上述汇总；入口在 TCMLayout 菜单「首页」或「仪表盘」。

**Step 3：导出**

- GET `/tcm/projects/:projectId/cases/export?format=csv` 返回用例列表 CSV。
- GET `/tcm/runs/:runId/export?format=csv` 返回 RunCase 执行结果 CSV。Handler 内拼 CSV 或使用库，设置 Content-Disposition。

**Step 4：前端导出按钮**

- 用例列表页、执行结果页增加「导出」按钮，调用上述接口并触发下载。

**Step 5：提交**

---

## 执行与验收

- 按 Task 1～15 顺序实施；每 Task 内按 Step 编码、运行/联调、提交。
- 验收：能创建项目与模块、维护用例、创建计划与轮次、执行并记录结果、关联本地/外部缺陷并双向查看、查看仪表盘与导出 CSV；权限与外部链接配置符合设计。

**Plan complete and saved to `docs/plans/2026-03-10-test-case-management-plan.md`.**

实施时可选两种方式：

1. **Subagent-Driven（本会话）** — 按 Task 分发给子 agent，每 Task 完成后审查再继续。
2. **Parallel Session（新会话）** — 在新会话中打开本计划，使用 executing-plans 技能按 Task 批量执行与检查点。

请选择上述其一，或指定「先做 Phase 1」等范围后再执行。
