# Menu Domain Import Export Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated menu-domain import/export module that performs full menu-domain replacement without relying on `mysqldump/mysql` or arbitrary SQL file execution.

**Architecture:** Add a new menu package subsystem alongside the existing full-database backup subsystem. The backend exports/imports menu-domain data through direct MySQL connections and explicit table-order workflows, while the frontend exposes a dedicated menu transfer modal separate from full-database restore.

**Tech Stack:** Go Gin, GORM, MySQL driver, React 18, Vite, existing auth/toast infrastructure.

---

### Task 1: Freeze scope and menu-domain table spec

**Files:**
- Create: `docs/plans/2026-03-23-menu-domain-import-export-design.md`
- Create: `backend-go/internal/services/menu_domain_spec.go`
- Test: `backend-go/internal/services/menu_domain_spec_test.go`

**Step 1: Write the failing test**

```go
func TestMenuDomainSpec_FieldDisplayNameTypesRestricted(t *testing.T) {
	spec := NewMenuDomainSpec()
	if !spec.AllowsFieldDisplayNameType("MENU_GROUP") {
		t.Fatal("expected MENU_GROUP to be allowed")
	}
	if spec.AllowsFieldDisplayNameType("SYSTEM") {
		t.Fatal("expected SYSTEM to be rejected")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestMenuDomainSpec_FieldDisplayNameTypesRestricted`
Expected: FAIL with missing symbol or incorrect behavior.

**Step 3: Write minimal implementation**

Create a menu domain spec containing:
- table whitelist
- `field_display_name` allowed types
- clear order
- import order

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestMenuDomainSpec_FieldDisplayNameTypesRestricted`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-23-menu-domain-import-export-design.md backend-go/internal/services/menu_domain_spec.go backend-go/internal/services/menu_domain_spec_test.go
git commit -m "feat: define menu domain spec"
```

### Task 2: Add menu package storage models and repository support

**Files:**
- Create: `backend-go/internal/models/menu_package.go`
- Modify: `backend-go/internal/repository/...`
- Test: `backend-go/internal/repository/..._test.go`

**Step 1: Write the failing test**

Add repository tests for:
- create package file record
- list by merchant
- list grouped by accessible merchant IDs
- create import/export job record

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository/...`
Expected: FAIL because menu package models/repo methods do not exist.

**Step 3: Write minimal implementation**

Add:
- `device_menu_package_files`
- `device_menu_import_jobs`
- `device_menu_export_jobs`

Implement repository methods for CRUD and list/group queries.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository/...`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/models backend-go/internal/repository
git commit -m "feat: add menu package persistence"
```

### Task 3: Implement menu package export service

**Files:**
- Create: `backend-go/internal/services/menu_export_service.go`
- Modify: `backend-go/internal/services/...`
- Test: `backend-go/internal/services/menu_export_service_test.go`

**Step 1: Write the failing test**

Cover:
- export reads only whitelisted tables
- `field_display_name` rows filtered by allowed types
- output package metadata contains merchant/version/export timestamp

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestMenuExport`
Expected: FAIL because export service does not exist.

**Step 3: Write minimal implementation**

Implement:
- direct MySQL reads
- JSON package assembly
- server-side package file creation
- package metadata record creation

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestMenuExport`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/menu_export_service.go backend-go/internal/services/menu_export_service_test.go
git commit -m "feat: implement menu package export"
```

### Task 4: Implement menu package validator

**Files:**
- Create: `backend-go/internal/services/menu_import_validator.go`
- Test: `backend-go/internal/services/menu_import_validator_test.go`

**Step 1: Write the failing test**

Cover:
- valid package accepted
- unknown table rejected
- unknown `field_display_name.field_type` rejected
- wrong `scope.type` rejected
- missing `format_version` rejected

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestMenuImportValidator`
Expected: FAIL because validator does not exist.

**Step 3: Write minimal implementation**

Build a validator for menu package files that returns structured errors.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestMenuImportValidator`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/menu_import_validator.go backend-go/internal/services/menu_import_validator_test.go
git commit -m "feat: validate menu packages"
```

### Task 5: Implement menu-domain import service

**Files:**
- Create: `backend-go/internal/services/menu_import_service.go`
- Create: `backend-go/internal/services/menu_repair_service.go`
- Test: `backend-go/internal/services/menu_import_service_test.go`

**Step 1: Write the failing test**

Cover:
- import clears menu domain before insert
- import order respects dependencies
- non-menu tables remain untouched
- repair step nulls `menu_item.report_item_id`

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestMenuImport`
Expected: FAIL because import service does not exist.

**Step 3: Write minimal implementation**

Implement:
- package read + validate
- target DB direct connection
- staged clear/import workflow
- repair hooks:
  - language mapping fix
  - display-name rebuild
  - device/printer unbind
  - `report_item_id` fix

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestMenuImport`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/menu_import_service.go backend-go/internal/services/menu_repair_service.go backend-go/internal/services/menu_import_service_test.go
git commit -m "feat: implement menu domain import"
```

### Task 6: Add HTTP handlers and routes for menu import/export

**Files:**
- Create: `backend-go/internal/handlers/device_menu_transfer.go`
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/handlers/device_menu_transfer_test.go`

**Step 1: Write the failing test**

Cover:
- export endpoint requires permission
- list endpoint groups packages by source merchant
- import endpoint rejects unauthorized source merchant
- upload endpoint rejects non-`.menupack.json`

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestMenuTransfer`
Expected: FAIL because endpoints are missing.

**Step 3: Write minimal implementation**

Add routes:
- `POST /api/device/menu/export`
- `GET /api/device/menu/packages`
- `GET /api/device/menu/packages/all`
- `GET /api/device/menu/packages/download`
- `DELETE /api/device/menu/packages`
- `POST /api/device/menu/import/server`
- `POST /api/device/menu/import/upload`
- `GET /api/device/menu/tasks/:taskId`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestMenuTransfer`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device_menu_transfer.go backend-go/internal/handlers/device_menu_transfer_test.go backend-go/cmd/server/main.go
git commit -m "feat: expose menu transfer endpoints"
```

### Task 7: Build dedicated frontend menu transfer modal

**Files:**
- Create: `frontend/src/components/menu-transfer/MenuTransferModal.jsx`
- Create: `frontend/src/components/menu-transfer/menuTransfer.css`
- Modify: `frontend/src/services/api.js`
- Modify: relevant device action entry component(s)
- Test: `frontend/src/components/menu-transfer/MenuTransferModal.test.jsx`

**Step 1: Write the failing test**

Cover:
- modal shows package list for current MID
- modal lists cross-MID packages separately
- import confirmation says “菜单域全量覆盖”
- local upload rejects non-`.menupack.json`

**Step 2: Run test to verify it fails**

Run: `npm test -- MenuTransferModal`
Expected: FAIL because component/API methods are missing.

**Step 3: Write minimal implementation**

Implement a dedicated menu transfer modal separate from DB backup restore UI.

**Step 4: Run test to verify it passes**

Run: `npm test -- MenuTransferModal`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/menu-transfer frontend/src/services/api.js
git commit -m "feat: add menu transfer modal"
```

### Task 8: Wire entry points and remove UI ambiguity

**Files:**
- Modify: device action menu component(s)
- Modify: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`
- Test: `frontend/src/...`

**Step 1: Write the failing test**

Verify:
- “菜单导入/导出” has its own entry
- DB backup modal no longer claims to handle menu import/export

**Step 2: Run test to verify it fails**

Run: `npm test -- device-actions`
Expected: FAIL because entry separation is not implemented.

**Step 3: Write minimal implementation**

Update UI labels and action structure so:
- menu transfer uses dedicated entry
- DB backup modal remains full-database only

**Step 4: Run test to verify it passes**

Run: `npm test -- device-actions`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: separate menu transfer from database restore UI"
```

### Task 9: Add end-to-end integration verification

**Files:**
- Create: `backend-go/internal/services/menu_transfer_integration_test.go`
- Create: `docs/sql/menu-transfer/...`

**Step 1: Write the failing test**

Cover:
- export package from source dataset
- import into target dataset
- assert menu-domain tables replaced
- assert non-menu tables unchanged

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestMenuTransferIntegration`
Expected: FAIL until workflow is complete.

**Step 3: Write minimal implementation**

Add integration fixtures and helper assertions.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestMenuTransferIntegration`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/menu_transfer_integration_test.go docs/sql/menu-transfer
git commit -m "test: verify menu transfer end to end"
```

### Task 10: Final verification and documentation update

**Files:**
- Modify: `README.md`
- Modify: `docs/backend-architecture.md`
- Modify: `docs/frontend-architecture.md`

**Step 1: Run backend tests**

Run: `go test ./...`
Expected: PASS

**Step 2: Run frontend tests**

Run: `npm test`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

**Step 4: Update docs**

Document:
- difference between full DB restore and menu transfer
- menu package format
- operator workflow

**Step 5: Commit**

```bash
git add README.md docs backend-go frontend
git commit -m "docs: add menu transfer architecture and usage"
```

