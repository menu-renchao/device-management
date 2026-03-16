# Cross-MID DB Import Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a guarded "导入其他设备数据" flow in POS database backup/restore so users can import server-side database backups from other authorized MIDs only after the current target device has at least one License backup.

**Architecture:** Extend the backend DB backup handler/service to distinguish target MID from source MID, add a grouped cross-MID backup listing endpoint with License readiness metadata, and update the existing restore endpoint to accept `source_merchant_id`. Reuse the current modal on the frontend, add a strongly warned cross-MID import section, and keep current-MID restore plus local upload behaviors unchanged.

**Tech Stack:** Go, Gin, existing device/license services, React, Vite, Axios, existing toast confirm flows.

---

### Task 1: Add failing backend handler tests for cross-MID listing

**Files:**
- Modify: `backend-go/internal/handlers/device_db_backup_test.go`
- Reference: `backend-go/internal/handlers/device_db_backup.go`
- Reference: `backend-go/internal/handlers/device.go`

**Step 1: Write the failing test**

Add tests that describe:

- `GET /device/db/backups/all?merchant_id=M123` returns grouped backups from other permitted MIDs
- response includes `license_backup_ready`
- groups exclude the target MID

Use a fake DB backup service that can return grouped backup data and a fake or seeded License backup state for the target MID.

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/handlers -run TestListCrossMerchantDatabaseBackups -v
```

Expected:

- FAIL because the route/handler behavior does not exist yet

**Step 3: Write minimal implementation**

In `device_db_backup.go`, add a new handler method for cross-MID listing and enough scaffolding in tests/fakes to compile.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/handlers -run TestListCrossMerchantDatabaseBackups -v
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device_db_backup_test.go backend-go/internal/handlers/device_db_backup.go
git commit -m "test: cover cross-mid db backup listing"
```

### Task 2: Add failing backend handler tests for License guard on cross-MID restore

**Files:**
- Modify: `backend-go/internal/handlers/device_db_backup_test.go`
- Reference: `backend-go/internal/handlers/device_license_backup.go`

**Step 1: Write the failing test**

Add tests that prove:

- restore is rejected when target MID has zero License backups
- restore is rejected when `source_merchant_id` equals target `merchant_id`
- restore is rejected when the source MID is not permitted

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/handlers -run "TestRestoreDatabaseFromServerRequiresLicenseBackup|TestRestoreDatabaseFromServerRejectsSameSourceMid|TestRestoreDatabaseFromServerRejectsForbiddenSourceMid" -v
```

Expected:

- FAIL for the expected missing checks

**Step 3: Write minimal implementation**

Update the restore request binding and add the guard clauses in `device_db_backup.go`.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/handlers -run "TestRestoreDatabaseFromServerRequiresLicenseBackup|TestRestoreDatabaseFromServerRejectsSameSourceMid|TestRestoreDatabaseFromServerRejectsForbiddenSourceMid" -v
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device_db_backup_test.go backend-go/internal/handlers/device_db_backup.go
git commit -m "test: guard cross-mid db restore with license and permissions"
```

### Task 3: Add failing service tests for grouped backup discovery and source-path restore

**Files:**
- Create: `backend-go/internal/services/db_backup_service_test.go`
- Modify: `backend-go/internal/services/db_backup_service.go`

**Step 1: Write the failing test**

Add tests for:

- listing grouped backups across multiple MIDs only returns `.sql` files
- files are sorted newest first inside each MID
- target MID can be excluded from the grouped listing
- restoring from server uses `source_merchant_id` to resolve the SQL file path

Use temp directories instead of real backup roots.

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/services -run "TestDBBackupServiceListBackupGroups|TestDBBackupServiceRestoreUsesSourceMerchantPath" -v
```

Expected:

- FAIL because grouped listing/source-specific restore helpers do not exist yet

**Step 3: Write minimal implementation**

Add the smallest new helper methods needed in `db_backup_service.go`.

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/services -run "TestDBBackupServiceListBackupGroups|TestDBBackupServiceRestoreUsesSourceMerchantPath" -v
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/db_backup_service.go backend-go/internal/services/db_backup_service_test.go
git commit -m "test: cover grouped db backup discovery"
```

### Task 4: Implement backend grouped listing and restore plumbing

**Files:**
- Modify: `backend-go/internal/services/db_backup_service.go`
- Modify: `backend-go/internal/handlers/device_db_backup.go`
- Modify: `backend-go/cmd/server/main.go`
- Reference: `backend-go/internal/services/license_service.go`
- Reference: `backend-go/internal/handlers/device.go`

**Step 1: Write the failing integration-oriented test**

If any behavior gap remains after Tasks 1-3, add one more handler test covering the full happy path:

- target MID has License backups
- source MID is permitted
- restore passes `host`, `source_merchant_id`, and `file_name` correctly

**Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/handlers -run TestRestoreDatabaseFromServerCrossMidSuccess -v
```

Expected:

- FAIL until plumbing is complete

**Step 3: Write minimal implementation**

Implement:

- new grouped listing handler
- target MID License readiness check
- source MID permission check
- restore request support for `source_merchant_id`
- source-path restore call into DB backup service
- route registration in `main.go`

**Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/handlers -run TestRestoreDatabaseFromServerCrossMidSuccess -v
go test ./internal/handlers -v
go test ./internal/services -v
```

Expected:

- all targeted backend tests PASS

**Step 5: Commit**

```bash
git add backend-go/cmd/server/main.go backend-go/internal/handlers/device_db_backup.go backend-go/internal/services/db_backup_service.go backend-go/internal/handlers/device_db_backup_test.go backend-go/internal/services/db_backup_service_test.go
git commit -m "feat: add guarded cross-mid db import backend"
```

### Task 5: Add failing frontend behavior for the new cross-MID import section

**Files:**
- Modify: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.css`

**Step 1: Write the failing test**

This repo currently has no frontend test runner. Do not invent one in this task. Instead, write down the UI acceptance checks as executable manual checks in the implementation notes inside the component as temporary development targets, then remove any temporary notes before finalizing.

The intended failing behaviors are:

- no button exists for `导入其他设备数据`
- no disabled state tied to License readiness exists
- no grouped cross-MID list exists

**Step 2: Run verification to prove the current UI lacks the feature**

Run:

```bash
npm run build
```

from `frontend`

Expected:

- build passes, but the feature is still absent when reviewing the code

**Step 3: Write minimal implementation**

Add:

- API method for the grouped cross-MID list
- modal state for loading, expanded section, grouped results, license readiness
- strong warning copy
- disabled button state with visible reason
- grouped source MID list with `导入到当前设备` actions

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
```

from `frontend`

Expected:

- build passes with the new UI state machine in place

**Step 5: Commit**

```bash
git add frontend/src/components/db-backup/DBBackupRestoreModal.jsx frontend/src/services/api.js frontend/src/App.css
git commit -m "feat: add cross-mid db import ui"
```

### Task 6: Wire frontend restore action to the guarded backend API

**Files:**
- Modify: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`
- Modify: `frontend/src/services/api.js`

**Step 1: Write the failing behavior check**

Add a manual verification checklist in your working notes:

- confirm dialog includes target MID, source MID, and file name
- restore request includes `source_merchant_id`
- restore action is disabled while another restore is in progress

**Step 2: Run verification to confirm current behavior is incomplete**

Run:

```bash
npm run build
```

from `frontend`

Expected:

- build passes, but restore still does not submit `source_merchant_id` until you implement it

**Step 3: Write minimal implementation**

Update the existing restore API wrapper and modal restore handler so that:

- current-MID restore keeps using the old path cleanly
- cross-MID restore explicitly sends `source_merchant_id`
- confirmation copy clearly warns about overwriting current device data

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
```

from `frontend`

Expected:

- build passes

**Step 5: Commit**

```bash
git add frontend/src/components/db-backup/DBBackupRestoreModal.jsx frontend/src/services/api.js
git commit -m "feat: submit cross-mid db restore requests"
```

### Task 7: Verify end-to-end requirements and clean up

**Files:**
- Review: `docs/plans/2026-03-16-cross-mid-db-import-design.md`
- Review: `docs/plans/2026-03-16-cross-mid-db-import-plan.md`
- Review: `backend-go/internal/handlers/device_db_backup.go`
- Review: `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`

**Step 1: Re-read the requirements checklist**

Confirm these are all satisfied:

- button exists only in database backup/restore modal
- only server backups participate
- other MID backups are grouped and shown
- License cross-machine behavior remains untouched
- import is blocked without a target-device License backup
- backend also blocks the action if frontend is bypassed

**Step 2: Run the full verification suite**

Run:

```bash
go test ./internal/handlers -v
go test ./internal/services -v
npm run build
```

Expected:

- all Go tests PASS
- frontend build PASS

**Step 3: Remove any temporary notes or debug scaffolding**

Make sure no temporary comments, logs, or placeholder states remain.

**Step 4: Run verification again**

Run:

```bash
go test ./internal/handlers -v
go test ./internal/services -v
npm run build
```

Expected:

- still PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/device_db_backup.go backend-go/internal/services/db_backup_service.go backend-go/internal/handlers/device_db_backup_test.go backend-go/internal/services/db_backup_service_test.go frontend/src/components/db-backup/DBBackupRestoreModal.jsx frontend/src/services/api.js frontend/src/App.css
git commit -m "feat: finish guarded cross-mid db import"
```

---

## Implementation Notes

- Use @test-driven-development for every backend behavior change. Each new guard or endpoint should start from a failing Go test.
- Use the existing permission pattern centered on `getPermittedDeviceForLicense`; do not invent a looser permission rule for source MID discovery.
- Do not add any License cross-MID UI or API surface.
- Keep current-MID server restore and upload restore behavior stable.
- Reuse existing `toast.confirm` and `toast.*` messaging patterns; do not introduce browser-native dialogs.
- Prefer small backend helper methods over duplicating merchant-directory traversal logic in handlers.

## Verification Commands

Backend:

```bash
go test ./internal/handlers -v
go test ./internal/services -v
```

Frontend:

```bash
npm run build
```

from `frontend`

Plan complete and saved to `docs/plans/2026-03-16-cross-mid-db-import-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh session per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
