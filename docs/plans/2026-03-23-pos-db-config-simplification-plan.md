# POS DB Config Simplification Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Remove per-device database connection storage and encryption, and unify all POS MySQL access around `device.IP + POS_DB_*` global defaults.

**Architecture:** Introduce one shared runtime resolver for POS DB connectivity, refactor SQL template execution to use it directly, then remove the old connection table, APIs, and frontend form state. Menu import/export and database backup/restore should continue converging on the same resolver.

**Tech Stack:** Go Gin, GORM, SQLite metadata DB, MySQL driver, React 18, Vite.

---

### Task 1: Add shared default POS DB runtime resolver

**Files:**
- Create: `backend-go/internal/services/pos_db_runtime.go`
- Test: `backend-go/internal/services/pos_db_runtime_test.go`

**Step 1: Write the failing test**

Add tests for:
- resolving `device.IP` from `merchant_id`
- building default connection input from `POS_DB_*`
- rejecting missing device IP

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestPOSDBRuntime`
Expected: FAIL because the resolver does not exist.

**Step 3: Write minimal implementation**

Implement a runtime resolver that:
- depends on `DeviceRepository`
- reads `config.AppConfig.POSDatabase`
- returns a connection input using `device.IP`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestPOSDBRuntime`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_db_runtime.go backend-go/internal/services/pos_db_runtime_test.go
git commit -m "refactor: add shared pos db runtime resolver"
```

### Task 2: Refactor DBConfigService to remove encrypted connection storage

**Files:**
- Modify: `backend-go/internal/services/db_config_service.go`
- Delete: `backend-go/pkg/crypto/password_cipher.go`
- Delete: `backend-go/pkg/crypto/password_cipher_test.go`
- Test: `backend-go/internal/services/db_config_service_test.go`

**Step 1: Write the failing test**

Add tests covering:
- executing templates without any `device_db_connections` record
- test-default using device IP and global defaults
- no decryption path required

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestDBConfigService`
Expected: FAIL because service still requires stored connection rows.

**Step 3: Write minimal implementation**

Change service behavior to:
- stop reading `connectionRepo` for runtime connection data
- remove `UseSavedPassword`
- remove `decryptConnection`
- remove `getCipherSecret`
- resolve MySQL connection from shared runtime resolver

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestDBConfigService`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/db_config_service.go backend-go/internal/services/db_config_service_test.go backend-go/pkg/crypto/password_cipher.go backend-go/pkg/crypto/password_cipher_test.go
git commit -m "refactor: remove encrypted device db connections"
```

### Task 3: Remove device connection APIs and add default-connection APIs

**Files:**
- Modify: `backend-go/internal/handlers/db_config.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/handlers/db_config_test.go`

**Step 1: Write the failing test**

Add handler tests for:
- `POST /api/db-config/test-default`
- optional `GET /api/db-config/default-connection`
- routes no longer serving `/connections/:merchantId`

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestDBConfig`
Expected: FAIL because old routes still exist.

**Step 3: Write minimal implementation**

Update routes and handlers:
- remove get/save per-device connection endpoints
- expose default connection info derived from `device.IP + POS_DB_*`
- expose test-default endpoint

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestDBConfig`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/db_config.go backend-go/cmd/server/main.go backend-go/internal/handlers/db_config_test.go
git commit -m "refactor: simplify db config api surface"
```

### Task 4: Simplify frontend DBConfigPage

**Files:**
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Modify: `frontend/src/pages/dbConnectionFormState.js`
- Modify: `frontend/src/pages/dbConnectionRequestState.js`
- Modify: `frontend/src/services/api.js`
- Test: `frontend/src/pages/dbConnectionFormState.test.js`
- Test: `frontend/src/pages/dbConnectionRequestState.test.js`

**Step 1: Write the failing test**

Add tests asserting:
- no editable password/username/host form is required
- page can render default connection summary
- request payload for execution no longer includes saved-password semantics

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`
Expected: FAIL because state still models editable per-device connection settings.

**Step 3: Write minimal implementation**

Simplify the page to:
- show device IP and default DB metadata
- call `test-default`
- keep template management and execution
- remove save-connection actions and form complexity

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/DBConfigPage.jsx frontend/src/pages/dbConnectionFormState.js frontend/src/pages/dbConnectionRequestState.js frontend/src/services/api.js frontend/src/pages/dbConnectionFormState.test.js frontend/src/pages/dbConnectionRequestState.test.js
git commit -m "refactor: simplify db config page to default connection model"
```

### Task 5: Delete unused device DB connection model and repository path

**Files:**
- Delete: `backend-go/internal/models/device_db_connection.go`
- Delete: `backend-go/internal/repository/device_db_connection_repo.go`
- Modify: dependent constructors/usages in `backend-go/cmd/server/main.go`
- Test: `go test ./...`

**Step 1: Write the failing test**

Add or update compile-level coverage so the app builds without `device_db_connections`.

**Step 2: Run test to verify it fails**

Run: `go test ./...`
Expected: FAIL because constructors and services still reference the old repository.

**Step 3: Write minimal implementation**

Remove repository wiring and all references to the old model/repo.

**Step 4: Run test to verify it passes**

Run: `go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/cmd/server/main.go
git rm backend-go/internal/models/device_db_connection.go backend-go/internal/repository/device_db_connection_repo.go
git commit -m "refactor: remove device db connection storage"
```

### Task 6: Add database migration to drop the obsolete table

**Files:**
- Modify: `backend-go/cmd/server/main.go` or migration bootstrap location
- Create/Modify: migration helper file if the repo has one
- Test: migration verification command

**Step 1: Write the failing test**

Add a migration-level test or one-off verification proving the obsolete table is dropped cleanly.

**Step 2: Run test to verify it fails**

Run the targeted migration verification.
Expected: FAIL because table still exists.

**Step 3: Write minimal implementation**

Add migration logic to drop `device_db_connections` if present.

**Step 4: Run test to verify it passes**

Run migration verification again.
Expected: PASS

**Step 5: Commit**

```bash
git add <migration files>
git commit -m "chore: drop obsolete device db connections table"
```

### Task 7: Unify menu and backup modules on the same resolver

**Files:**
- Modify: `backend-go/internal/services/menu_package_service.go`
- Modify: `backend-go/internal/services/db_backup_service.go`
- Modify: `backend-go/internal/services/license_service.go`
- Test: `backend-go/internal/services/..._test.go`

**Step 1: Write the failing test**

Add tests asserting all POS DB modules resolve host from device IP and credentials from the same shared resolver/config source.

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -count=1`
Expected: FAIL because modules still construct connections independently.

**Step 3: Write minimal implementation**

Refactor service constructors or helper paths so all three modules consume one shared default POS DB resolution strategy.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -count=1`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/menu_package_service.go backend-go/internal/services/db_backup_service.go backend-go/internal/services/license_service.go backend-go/internal/services/*test.go
git commit -m "refactor: unify pos db access on shared defaults"
```

### Task 8: Final verification and documentation cleanup

**Files:**
- Modify: `docs/plans/2026-03-23-pos-db-config-simplification-design.md`
- Modify: `README.md` if needed

**Step 1: Run backend verification**

Run:

```bash
go test ./...
go build ./cmd/server
```

Expected: PASS

**Step 2: Run frontend verification**

Run:

```bash
npm test -- --runInBand
npm run build
```

Expected: PASS

**Step 3: Manual smoke checks**

Verify:
- open DB config page for a device
- test default connection
- execute one SQL template
- menu export/import still works
- DB backup/restore still works

**Step 4: Commit**

```bash
git add docs/plans/2026-03-23-pos-db-config-simplification-design.md README.md
git commit -m "docs: finalize simplified pos db connection design"
```
