# POS 扫描隐藏服务异常实现计划

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Stop persisting and displaying POS scan results that have no valid `merchantId`, and provide a cleanup command to remove historical service-exception rows.

**Architecture:** The backend will reject invalid scan results before persistence and add a repository-level filter so device list APIs never return empty-merchant scan rows. The frontend will remove the "service exception" rendering branch, and a standalone Go cleanup command will delete historical `scan_results` rows whose `merchant_id` is empty after trimming.

**Tech Stack:** Go, Gin, GORM, SQLite, React, Vite

---

### Task 1: Block Invalid Scan Results From Persistence

**Files:**
- Modify: `backend-go/internal/handlers/scan.go`
- Create: `backend-go/internal/handlers/scan_service_exception_test.go`

**Step 1: Write the failing test**

Add a handler-level test that inserts no initial data, calls `saveScanResult` with:

```go
map[string]interface{}{
    "ip": "10.0.0.8",
    "merchantId": "   ",
    "name": "Broken POS",
    "version": "1.0.0",
}
```

and then asserts `scan_results` row count stays `0`.

Add a second test that seeds a valid record, calls `saveScanResult` again with the same IP but blank `merchantId`, and asserts the existing valid record is not overwritten or duplicated.

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run ServiceException -count=1`

Expected: FAIL because blank-merchant results are still inserted or updated today.

**Step 3: Write minimal implementation**

In `saveScanResult`:

- Read `merchantId`
- Apply `strings.TrimSpace`
- Return immediately when the trimmed value is empty

Keep the existing create/update behavior unchanged for valid merchant IDs.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run ServiceException -count=1`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/scan.go backend-go/internal/handlers/scan_service_exception_test.go
git commit -m "fix: skip persisting service-exception scan results"
```

### Task 2: Filter Historical Invalid Rows From Device Queries

**Files:**
- Modify: `backend-go/internal/repository/device_repo.go`
- Modify: `backend-go/internal/repository/device_repo_test.go`

**Step 1: Write the failing test**

Add a repository test that seeds:

- one `scan_results` row with `merchant_id = "M123"`
- one row with `merchant_id = ""`
- one row with `merchant_id = "   "` if SQLite fixture handling allows whitespace storage
- one row with `merchant_id = NULL`

Call `ListScanResults(...)` and assert only the valid `M123` row is returned and counted.

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run ListScanResults -count=1`

Expected: FAIL because the current query returns empty-merchant rows.

**Step 3: Write minimal implementation**

Update the base query in `ListScanResults` to exclude invalid merchant IDs with a SQLite-safe condition such as:

```sql
merchant_id IS NOT NULL AND TRIM(merchant_id) != ''
```

Keep search, type, property, and mine-only filters operating on the already filtered dataset.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run ListScanResults -count=1`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/repository/device_repo.go backend-go/internal/repository/device_repo_test.go
git commit -m "fix: filter invalid scan rows from device list"
```

### Task 3: Remove Service-Exception Rendering In Scan Table

**Files:**
- Create: `frontend/src/components/scanTableState.js`
- Create: `frontend/src/components/scanTableState.test.js`
- Modify: `frontend/src/components/ScanTable.jsx`

**Step 1: Write the failing test**

Create a tiny pure helper:

```js
export function getDeviceStatusPresentation(device) {}
```

Write a Node test that asserts:

- valid online device -> `{ text: '在线', tone: 'online' }`
- offline device -> text starts with `离线`
- online device with blank `merchantId` does not return `服务异常`

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/scanTableState.test.js`

Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**

- Move status-text decision into `scanTableState.js`
- Return only `在线` / `离线`
- Update `ScanTable.jsx` to consume the helper instead of inline branching

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/scanTableState.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/scanTableState.js frontend/src/components/scanTableState.test.js frontend/src/components/ScanTable.jsx
git commit -m "fix: remove service-exception scan status display"
```

### Task 4: Add Historical Cleanup Command

**Files:**
- Create: `backend-go/cmd/cleanup-service-exception/main.go`
- Create: `backend-go/cmd/cleanup-service-exception/main_test.go`

**Step 1: Write the failing test**

Create a command-focused test around a small helper function, for example:

```go
func cleanupServiceExceptionRows(db *gorm.DB) (matched int64, deleted int64, err error)
```

Seed:

- one valid `scan_results` row with merchant ID
- two invalid rows with empty and whitespace merchant IDs

Assert the helper reports `matched = 2`, `deleted = 2`, and leaves the valid row intact.

**Step 2: Run test to verify it fails**

Run: `go test ./cmd/cleanup-service-exception -count=1`

Expected: FAIL because the helper and command do not exist yet.

**Step 3: Write minimal implementation**

- Add the helper used by the test
- Open the configured SQLite database
- Count invalid rows with `merchant_id IS NULL OR TRIM(merchant_id) = ''`
- Delete those rows
- Print a short summary to stdout

**Step 4: Run test to verify it passes**

Run: `go test ./cmd/cleanup-service-exception -count=1`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/cmd/cleanup-service-exception/main.go backend-go/cmd/cleanup-service-exception/main_test.go
git commit -m "feat: add service-exception cleanup command"
```

### Task 5: Verify End-To-End

**Files:**
- No new production files

**Step 1: Run targeted backend tests**

Run: `go test ./internal/handlers ./internal/repository ./cmd/cleanup-service-exception -count=1`

Expected: PASS

**Step 2: Run targeted frontend test**

Run: `node --test frontend/src/components/scanTableState.test.js`

Expected: PASS

**Step 3: Run broader project verification**

Run: `go test ./...`

Expected: PASS, or capture any unrelated pre-existing failures separately.

Run: `npm run build`

Workdir: `frontend`

Expected: successful Vite production build.

**Step 4: Manual verification**

1. Start a scan against a network segment that includes at least one invalid response.
2. Confirm that the device list API does not return empty-merchant rows.
3. Confirm that the scan page no longer shows a "服务异常" status badge.
4. Run the cleanup command in a safe environment and confirm it reports deleted historical rows.

**Step 5: Final review**

Review the diff for:

- accidental changes to `backend-go/data.db`
- any remaining frontend references to `服务异常`
- any query paths that still read empty-merchant scan rows directly
