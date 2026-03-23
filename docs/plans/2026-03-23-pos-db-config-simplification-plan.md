# POS DB Config Simplification Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace per-device stored POS database credentials with one `.env`-driven runtime configuration, using the current device IP as the only dynamic host value.

**Architecture:** The backend will expose one read-only connection view and one test endpoint backed by `device.IP + POS_DB_*`, while SQL template execution uses the same resolver directly. The frontend will stop collecting database credentials and instead render the effective connection summary returned by the backend.

**Tech Stack:** Go Gin, GORM, SQLite metadata DB, MySQL driver, React 18, Vite.

---

### Task 1: Add POS DB environment config

**Files:**
- Modify: `backend-go/internal/config/config.go`
- Modify: `backend-go/internal/config/config_test.go`
- Modify: `.env.example`

**Step 1: Write the failing test**

Add tests in `backend-go/internal/config/config_test.go` to verify:
- `POS_DB_TYPE` defaults to `mysql`
- `POS_DB_PORT`, `POS_DB_NAME`, `POS_DB_USER`, `POS_DB_PASSWORD` can be loaded from env
- the parsed config is available on `config.AppConfig`

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/config -run TestInitLoadsPOSDatabaseConfig -count=1
```

Expected: FAIL because the POS DB config fields do not exist yet.

**Step 3: Write minimal implementation**

Update `backend-go/internal/config/config.go` to:
- add a `POSDatabaseConfig` section on `Config`
- register defaults for `POS_DB_TYPE`, `POS_DB_PORT`, `POS_DB_NAME`, `POS_DB_USER`, `POS_DB_PASSWORD`
- populate `AppConfig.POSDatabase`

Update `.env.example` to document the new variables.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/config -run TestInitLoadsPOSDatabaseConfig -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/config/config.go backend-go/internal/config/config_test.go .env.example
git commit -m "refactor: add pos db env configuration"
```

### Task 2: Add runtime resolver for current device IP plus env defaults

**Files:**
- Create: `backend-go/internal/services/pos_db_runtime.go`
- Create: `backend-go/internal/services/pos_db_runtime_test.go`

**Step 1: Write the failing test**

Add tests covering:
- resolving runtime connection data from `merchant_id`
- using the current device IP as `host`
- returning an error when the device is missing
- returning an error when the device IP is empty

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/services -run TestPOSDBRuntime -count=1
```

Expected: FAIL because the runtime resolver does not exist.

**Step 3: Write minimal implementation**

Create `backend-go/internal/services/pos_db_runtime.go` with a resolver that:
- depends on `DeviceRepository`
- reads `config.AppConfig.POSDatabase`
- builds a `DBConnectionInput` using `device.IP` as `host`

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/services -run TestPOSDBRuntime -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/pos_db_runtime.go backend-go/internal/services/pos_db_runtime_test.go
git commit -m "refactor: add pos db runtime resolver"
```

### Task 3: Refactor DBConfigService away from stored connections

**Files:**
- Modify: `backend-go/internal/services/db_config_service.go`
- Modify: `backend-go/internal/services/db_config_service_test.go`
- Delete: `backend-go/pkg/crypto/password_cipher.go`
- Delete: `backend-go/pkg/crypto/password_cipher_test.go`

**Step 1: Write the failing test**

Add tests that verify:
- `GetConnection` returns runtime-derived connection info without any saved row
- `TestConnectionForMerchant` no longer needs request payload password fields
- `ExecuteTemplates` no longer reads `device_db_connections`

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/services -run TestDBConfigService -count=1
```

Expected: FAIL because the service still depends on stored encrypted connections.

**Step 3: Write minimal implementation**

Update `backend-go/internal/services/db_config_service.go` to:
- remove `DeviceDBConnectionRepository` from the service
- remove `UpsertConnection`
- remove `UseSavedPassword`
- remove password decrypt and cipher-secret logic
- delegate runtime connection building to the new resolver

Delete the unused crypto helper and its tests.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/services -run TestDBConfigService -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/db_config_service.go backend-go/internal/services/db_config_service_test.go
git rm backend-go/pkg/crypto/password_cipher.go backend-go/pkg/crypto/password_cipher_test.go
git commit -m "refactor: remove stored pos db connection logic"
```

### Task 4: Simplify DB config handlers and routes

**Files:**
- Modify: `backend-go/internal/handlers/db_config.go`
- Create: `backend-go/internal/handlers/db_config_test.go`
- Modify: `backend-go/cmd/server/main.go`
- Modify: `backend-go/cmd/server/auto_migrate_models_test.go`

**Step 1: Write the failing test**

Add tests for:
- `GET /api/db-config/connections/:merchantId` returning runtime-derived readonly data
- `POST /api/db-config/connections/:merchantId/test` working without request body credentials
- `PUT /api/db-config/connections/:merchantId` no longer being registered
- `autoMigrateModels()` no longer including `DeviceDBConnection`

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/handlers -run TestDBConfig -count=1
go test ./cmd/server -run TestAutoMigrateModels -count=1
```

Expected: FAIL because the old save route and old model wiring still exist.

**Step 3: Write minimal implementation**

Update the handler and server wiring to:
- keep `GET` and `POST test` routes
- remove `PUT /connections/:merchantId`
- return readonly connection info with password status only
- stop initializing the old repository and stop auto-migrating the old model

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/handlers -run TestDBConfig -count=1
go test ./cmd/server -run TestAutoMigrateModels -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/db_config.go backend-go/internal/handlers/db_config_test.go backend-go/cmd/server/main.go backend-go/cmd/server/auto_migrate_models_test.go
git commit -m "refactor: simplify pos db config endpoints"
```

### Task 5: Remove obsolete model and repository files

**Files:**
- Delete: `backend-go/internal/models/device_db_connection.go`
- Delete: `backend-go/internal/repository/device_db_connection_repo.go`

**Step 1: Write the failing test**

Use compile-level verification to ensure no remaining code references the obsolete model or repository.

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./... -count=1
```

Expected: FAIL until all references to the deleted files are removed.

**Step 3: Write minimal implementation**

Delete the obsolete model and repository, then update any remaining references to compile cleanly.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./... -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git rm backend-go/internal/models/device_db_connection.go backend-go/internal/repository/device_db_connection_repo.go
git commit -m "refactor: delete obsolete device db connection storage"
```

### Task 6: Simplify frontend DB config page to display-only

**Files:**
- Modify: `frontend/src/components/db-config/ConnectionPanel.jsx`
- Modify: `frontend/src/components/db-config/connectionPanelState.js`
- Modify: `frontend/src/components/db-config/connectionPanelState.test.js`
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Modify: `frontend/src/pages/connectionDefaults.js`
- Modify: `frontend/src/pages/connectionDefaults.test.js`
- Modify: `frontend/src/pages/dbConnectionFormState.js`
- Modify: `frontend/src/pages/dbConnectionFormState.test.js`
- Modify: `frontend/src/pages/dbConnectionRequestState.js`
- Modify: `frontend/src/pages/dbConnectionRequestState.test.js`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/services/api.test.js`

**Step 1: Write the failing test**

Add tests that verify:
- the connection panel renders readonly information instead of editable inputs
- no frontend path calls `saveConnection`
- testing a connection no longer sends user-entered DB credentials
- template execution no longer synchronizes connection form state first

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand
```

Expected: FAIL because the page still models editable per-device connection state.

**Step 3: Write minimal implementation**

Update the frontend to:
- fetch readonly connection data from `GET /db-config/connections/:merchantId`
- keep the test endpoint call
- remove the save endpoint call
- remove password input, saved-password semantics, and hardcoded DB password defaults
- render a password status label rather than a password field

Simplify or retire helper modules so they match the new display-only flow.

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/db-config/ConnectionPanel.jsx frontend/src/components/db-config/connectionPanelState.js frontend/src/components/db-config/connectionPanelState.test.js frontend/src/pages/DBConfigPage.jsx frontend/src/pages/connectionDefaults.js frontend/src/pages/connectionDefaults.test.js frontend/src/pages/dbConnectionFormState.js frontend/src/pages/dbConnectionFormState.test.js frontend/src/pages/dbConnectionRequestState.js frontend/src/pages/dbConnectionRequestState.test.js frontend/src/services/api.js frontend/src/services/api.test.js
git commit -m "refactor: make db config page display only"
```

### Task 7: Final verification and doc refresh

**Files:**
- Modify: `docs/plans/2026-03-23-pos-db-config-simplification-design.md`

**Step 1: Run backend verification**

Run:

```bash
go test ./... -count=1
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
- open the DB config page for one device
- confirm the connection section is display-only
- run connection test successfully
- execute one SQL template successfully
- confirm no save-connection request is sent

**Step 4: Commit**

```bash
git add docs/plans/2026-03-23-pos-db-config-simplification-design.md
git commit -m "docs: finalize pos db config simplification plan"
```
