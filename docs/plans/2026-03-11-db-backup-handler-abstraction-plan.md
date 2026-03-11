# DB Backup Handler Abstraction Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make `DeviceHandler` depend on a DB backup interface instead of `*services.DBBackupService`, while keeping runtime behavior unchanged and adding handler-level fake-based tests.

**Architecture:** Introduce a `dbBackupManager` interface in the handler layer that matches the DB backup capabilities the handler actually uses. Keep `services.DBBackupService` unchanged so it satisfies the interface naturally, then update constructor injection and add focused handler tests that prove the handler now depends only on the abstraction.

**Tech Stack:** Go, Gin, GORM, sqlite test database

---

### Task 1: Add failing DB backup handler tests

**Files:**
- Create: `backend-go/internal/handlers/device_db_backup_test.go`
- Reference: `backend-go/internal/handlers/device_license_backup_test.go`

**Step 1: Write the failing test**

Add fake-based handler tests for:
- listing DB backups returns items
- creating a DB backup returns backup metadata
- deleting a DB backup maps missing files to `404`
- restoring from server requires permission

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run "Test(List|Backup|Delete|Restore)Database" -count=1`
Expected: FAIL because the new fake DB backup manager test helper does not compile against the current handler dependency shape.

**Step 3: Write minimal implementation**

Do not change service behavior yet; only add the tests and fake type.

**Step 4: Run test to verify it still fails for the expected reason**

Run: `go test ./internal/handlers -run "Test(List|Backup|Delete|Restore)Database" -count=1`
Expected: FAIL at compile time or type-check time due to the handler still depending on `*services.DBBackupService`.

### Task 2: Refactor handler dependency to interface

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test**

Use the tests from Task 1 as the failing proof.

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run "Test(List|Backup|Delete|Restore)Database" -count=1`
Expected: FAIL before the interface refactor is applied.

**Step 3: Write minimal implementation**

Add a `dbBackupManager` interface in `device.go`, switch `DeviceHandler.dbBackupService` and `NewDeviceHandler` to that interface, and keep `services.DBBackupService` usage unchanged at the call sites.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run "Test(List|Backup|Delete|Restore)Database" -count=1`
Expected: PASS.

### Task 3: Run broader verification

**Files:**
- Verify only

**Step 1: Run handler package tests**

Run: `go test ./internal/handlers -count=1`
Expected: PASS.

**Step 2: Run targeted command package compile/test**

Run: `go test ./cmd/server -count=1`
Expected: PASS.

**Step 3: Commit**

Run:

```bash
git add docs/plans/2026-03-11-db-backup-handler-abstraction-plan.md backend-go/internal/handlers/device.go backend-go/internal/handlers/device_db_backup_test.go backend-go/cmd/server/main.go
git commit -m "refactor: abstract db backup handler dependency"
```
