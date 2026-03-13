# POS Default Category Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make POS default `PC` classification explicit so list rendering, filter options, and category filtering all treat default devices consistently.

**Architecture:** Keep `device_properties` as the POS classification metadata table, but stop encoding the default category through missing rows. Add repository-level normalization so missing rows read as `PC`, keep new writes explicit, and move historical backfill into a standalone SQL script instead of runtime business code.

**Tech Stack:** Go, GORM, SQLite, Gin

---

### Task 1: Add repository regression tests

**Files:**
- Create: `backend-go/internal/repository/device_repo_test.go`
- Test: `backend-go/internal/repository/device_repo_test.go`

**Step 1: Write the failing test**

- Add a test that inserts one POS device without a `device_properties` row and one POS device with `property='收银'`.
- Assert `ListScanResults(..., properties=["PC"], ...)` returns the default device.
- Assert `GetDistinctProperties()` includes `PC`.

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run TestDeviceRepository`

Expected: FAIL because repository filtering/options do not currently treat missing properties as `PC`.

**Step 3: Write minimal implementation**

- Add repository helpers for:
  - normalizing category filter matching with `COALESCE(device_properties.property, 'PC')`
  - listing distinct properties with `PC` included when any POS device lacks an explicit property row
  - backfilling missing property rows to `PC`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run TestDeviceRepository`

Expected: PASS

### Task 2: Provide one-off SQL backfill script

**Files:**
- Create: `scripts/sql/2026-03-13-backfill-pos-default-properties.sql`
- Test: `backend-go/cmd/server/auto_migrate_models_test.go`

**Step 1: Write the failing test**

- Add a test that asserts startup code does not invoke a POS default property backfill hook.

**Step 2: Run test to verify it fails**

Run: `go test ./cmd/server -run TestMainDoesNotInvokePOSDefaultPropertyBackfill`

Expected: FAIL because startup still performs runtime backfill.

**Step 3: Write minimal implementation**

- Remove the runtime backfill from `main.go`.
- Add a standalone SQL script that inserts `PC` rows for devices missing a category record.

**Step 4: Run test to verify it passes**

Run: `go test ./cmd/server -run TestMainDoesNotInvokePOSDefaultPropertyBackfill`

Expected: PASS

### Task 3: Run focused verification

**Files:**
- Test: `backend-go/internal/repository/device_repo_test.go`
- Test: `backend-go/cmd/server/auto_migrate_models_test.go`

**Step 1: Run focused tests**

Run: `go test ./internal/repository ./cmd/server`

Expected: PASS

**Step 2: Check formatting**

Run: `gofmt -w backend-go/internal/repository/device_repo.go backend-go/internal/repository/device_repo_test.go backend-go/cmd/server/main.go backend-go/cmd/server/auto_migrate_models_test.go`

Expected: no diff after rerun
