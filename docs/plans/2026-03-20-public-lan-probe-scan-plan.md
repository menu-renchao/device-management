# Public LAN Probe Scan Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a cloud-controlled LAN probe architecture so customer devices behind NAT can be scanned from inside the customer LAN and synchronized back into the existing device inventory.

**Architecture:** The public backend becomes a control plane for probes and scan jobs, while a Windows probe process running inside the customer LAN performs CIDR scanning locally and uploads progress and results. Existing inventory persistence stays in the backend, but current scan execution code is refactored into a reusable package shared by the cloud and the probe.

**Tech Stack:** Go, Gin, GORM, SQLite, net/http, Windows service or trayless background agent, React, Axios, Vite

---

### Task 1: Add probe data models and repositories

**Files:**
- Create: `backend-go/internal/models/probe_agent.go`
- Create: `backend-go/internal/models/probe_scan_job.go`
- Create: `backend-go/internal/models/probe_scan_job_result.go`
- Create: `backend-go/internal/repository/probe_agent_repo.go`
- Create: `backend-go/internal/repository/probe_scan_job_repo.go`
- Create: `backend-go/internal/repository/probe_scan_job_result_repo.go`
- Modify: `backend-go/cmd/server/main.go`
- Test: `backend-go/internal/repository/probe_agent_repo_test.go`

**Step 1: Write the failing test**

```go
func TestCreateProbeAgent(t *testing.T) {
	db := newTestDB(t)
	repo := NewProbeAgentRepository(db)
	agent := &models.ProbeAgent{Name: "store-a-probe", MachineCode: "HOST-001", Status: "offline"}

	if err := repo.Create(agent); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if agent.ID == 0 {
		t.Fatal("expected agent id to be assigned")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run TestCreateProbeAgent -v`

Expected: FAIL with missing probe models or repository symbols.

**Step 3: Write minimal implementation**

Add models and repositories for probe agents, jobs, and raw results. Register the models in `backend-go/cmd/server/main.go` auto-migration.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run TestCreateProbeAgent -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/models/probe_agent.go backend-go/internal/models/probe_scan_job.go backend-go/internal/models/probe_scan_job_result.go backend-go/internal/repository/probe_agent_repo.go backend-go/internal/repository/probe_scan_job_repo.go backend-go/internal/repository/probe_scan_job_result_repo.go backend-go/cmd/server/main.go backend-go/internal/repository/probe_agent_repo_test.go
git commit -m "feat: add probe data models and repositories"
```

### Task 2: Add probe token issuing and validation helpers

**Files:**
- Create: `backend-go/internal/services/probe_auth_service.go`
- Create: `backend-go/internal/services/probe_auth_service_test.go`
- Modify: `backend-go/internal/config/config.go`

**Step 1: Write the failing test**

```go
func TestIssueAndValidateProbeToken(t *testing.T) {
	svc := NewProbeAuthService("test-secret")
	token, hash, err := svc.IssueToken()
	if err != nil {
		t.Fatalf("IssueToken returned error: %v", err)
	}
	if token == "" || hash == "" {
		t.Fatal("expected non-empty token and hash")
	}
	if err := svc.ValidateToken(token, hash); err != nil {
		t.Fatalf("ValidateToken returned error: %v", err)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestIssueAndValidateProbeToken -v`

Expected: FAIL with missing auth service.

**Step 3: Write minimal implementation**

Create a probe auth service that issues cryptographically secure tokens and verifies them against a stored hash. Add config for the signing or hashing secret if needed.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestIssueAndValidateProbeToken -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/probe_auth_service.go backend-go/internal/services/probe_auth_service_test.go backend-go/internal/config/config.go
git commit -m "feat: add probe token auth service"
```

### Task 3: Add probe registration and heartbeat APIs

**Files:**
- Create: `backend-go/internal/handlers/probe_agent.go`
- Create: `backend-go/internal/handlers/probe_agent_test.go`
- Create: `backend-go/internal/middleware/probe_auth.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test**

```go
func TestRegisterProbeAgentReturnsToken(t *testing.T) {
	router := gin.New()
	handler := newTestProbeAgentHandler(t)
	router.POST("/api/probe-agent/register", handler.Register)

	body := strings.NewReader(`{"name":"store-a-probe","machine_code":"HOST-001"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/probe-agent/register", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestRegisterProbeAgentReturnsToken -v`

Expected: FAIL with missing handler or dependencies.

**Step 3: Write minimal implementation**

Add registration and heartbeat handlers. Registration issues the probe token and returns it once. Heartbeat authenticates the probe and updates status metadata such as `last_seen_at`, `hostname`, `local_ip`, and `version`.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestRegisterProbeAgentReturnsToken -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/probe_agent.go backend-go/internal/handlers/probe_agent_test.go backend-go/internal/middleware/probe_auth.go backend-go/cmd/server/main.go
git commit -m "feat: add probe register and heartbeat endpoints"
```

### Task 4: Add admin probe listing and job creation APIs

**Files:**
- Modify: `backend-go/internal/handlers/scan.go`
- Create: `backend-go/internal/handlers/probe_jobs_test.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test**

```go
func TestCreateProbeScanJob(t *testing.T) {
	router := gin.New()
	handler := newTestScanHandlerForProbeJobs(t)
	router.POST("/api/probes/:id/scan-jobs", withAdminUser(handler.CreateProbeScanJob))

	body := strings.NewReader(`{"cidr_blocks":["192.168.1.0/24"]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/probes/1/scan-jobs", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestCreateProbeScanJob -v`

Expected: FAIL with missing handler method.

**Step 3: Write minimal implementation**

Add handler methods for probe listing, job creation, job history, and cancellation. Reuse CIDR normalization and validation. Create jobs with `pending` status and fixed default port `22080`.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestCreateProbeScanJob -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/scan.go backend-go/internal/handlers/probe_jobs_test.go backend-go/cmd/server/main.go
git commit -m "feat: add admin probe job APIs"
```

### Task 5: Extract reusable scan execution package from current scan service

**Files:**
- Create: `backend-go/internal/scanner/runner.go`
- Create: `backend-go/internal/scanner/types.go`
- Create: `backend-go/internal/scanner/runner_test.go`
- Modify: `backend-go/internal/services/scan_service.go`

**Step 1: Write the failing test**

```go
func TestRunnerGeneratesResultsForOpenHost(t *testing.T) {
	runner := NewRunner()
	_, err := runner.Run(context.Background(), RunConfig{
		CIDRBlocks: []string{"192.168.1.0/30"},
		Port:       22080,
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/scanner -run TestRunnerGeneratesResultsForOpenHost -v`

Expected: FAIL with missing package or runner.

**Step 3: Write minimal implementation**

Move host generation, TCP port probe, POS metadata fetch, OS detection, and result shaping out of `backend-go/internal/services/scan_service.go` into a reusable scanner package with progress and result callbacks.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/scanner -run TestRunnerGeneratesResultsForOpenHost -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/scanner/runner.go backend-go/internal/scanner/types.go backend-go/internal/scanner/runner_test.go backend-go/internal/services/scan_service.go
git commit -m "refactor: extract reusable scanner runner"
```

### Task 6: Add probe polling and job state machine APIs

**Files:**
- Modify: `backend-go/internal/handlers/probe_agent.go`
- Create: `backend-go/internal/handlers/probe_agent_jobs_test.go`
- Modify: `backend-go/internal/repository/probe_scan_job_repo.go`

**Step 1: Write the failing test**

```go
func TestProbePollsNextPendingJob(t *testing.T) {
	router := gin.New()
	handler := newTestProbeAgentHandlerWithPendingJob(t)
	router.GET("/api/probe-agent/jobs/next", withProbeAuth(handler.NextJob))

	req := httptest.NewRequest(http.MethodGet, "/api/probe-agent/jobs/next", nil)
	req.Header.Set("Authorization", "Bearer probe-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestProbePollsNextPendingJob -v`

Expected: FAIL with missing job polling support.

**Step 3: Write minimal implementation**

Add probe job methods for pulling the next pending job, marking a job as running, updating progress, and finishing a job. Allow only one running job per probe at a time.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestProbePollsNextPendingJob -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/probe_agent.go backend-go/internal/handlers/probe_agent_jobs_test.go backend-go/internal/repository/probe_scan_job_repo.go
git commit -m "feat: add probe job polling APIs"
```

### Task 7: Add result batch ingestion and inventory upsert reuse

**Files:**
- Modify: `backend-go/internal/handlers/probe_agent.go`
- Modify: `backend-go/internal/handlers/scan.go`
- Modify: `backend-go/internal/repository/probe_scan_job_result_repo.go`
- Create: `backend-go/internal/handlers/probe_agent_results_test.go`

**Step 1: Write the failing test**

```go
func TestUploadResultBatchStoresRawResultsAndUpdatesInventory(t *testing.T) {
	router := gin.New()
	handler := newTestProbeAgentHandlerForResults(t)
	router.POST("/api/probe-agent/jobs/:jobId/results/batch", withProbeAuth(handler.UploadResultBatch))

	body := strings.NewReader(`{"items":[{"ip":"192.168.1.20","merchantId":"M1001","name":"POS-A","version":"1.0.0","type":"Windows","status":"success","fullData":{}}]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/probe-agent/jobs/1/results/batch", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer probe-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/handlers -run TestUploadResultBatchStoresRawResultsAndUpdatesInventory -v`

Expected: FAIL with missing upload handler.

**Step 3: Write minimal implementation**

Add batch upload handling, store raw rows in `probe_scan_job_results`, and refactor the current `saveScanResult` logic in `backend-go/internal/handlers/scan.go` into a reusable inventory upsert helper.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/handlers -run TestUploadResultBatchStoresRawResultsAndUpdatesInventory -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/probe_agent.go backend-go/internal/handlers/scan.go backend-go/internal/repository/probe_scan_job_result_repo.go backend-go/internal/handlers/probe_agent_results_test.go
git commit -m "feat: add probe result ingestion"
```

### Task 8: Create the Windows probe application skeleton

**Files:**
- Create: `probe-go/cmd/probe/main.go`
- Create: `probe-go/internal/config/config.go`
- Create: `probe-go/internal/client/cloud_client.go`
- Create: `probe-go/internal/runtime/agent.go`
- Create: `probe-go/go.mod`
- Test: `probe-go/internal/client/cloud_client_test.go`

**Step 1: Write the failing test**

```go
func TestCloudClientBuildsAuthorizedRequest(t *testing.T) {
	client := NewCloudClient("https://example.com", "probe-token")
	req, err := client.newRequest(context.Background(), http.MethodGet, "/api/probe-agent/jobs/next", nil)
	if err != nil {
		t.Fatalf("newRequest returned error: %v", err)
	}
	if got := req.Header.Get("Authorization"); got == "" {
		t.Fatal("expected authorization header")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./...`

Workdir: `probe-go`

Expected: FAIL with missing probe app files.

**Step 3: Write minimal implementation**

Initialize a separate Go module for the probe app with config loading, cloud client auth header support, and runtime loop scaffolding for heartbeat and job polling.

**Step 4: Run test to verify it passes**

Run: `go test ./...`

Workdir: `probe-go`

Expected: PASS

**Step 5: Commit**

```bash
git add probe-go
git commit -m "feat: scaffold windows probe app"
```

### Task 9: Implement probe-side scan execution and uploads

**Files:**
- Modify: `probe-go/internal/runtime/agent.go`
- Modify: `probe-go/internal/client/cloud_client.go`
- Create: `probe-go/internal/runtime/agent_test.go`
- Create: `probe-go/internal/scanner/adapter.go`

**Step 1: Write the failing test**

```go
func TestAgentRunsJobAndUploadsResults(t *testing.T) {
	fakeCloud := newFakeCloudClient()
	agent := NewAgent(fakeCloud, newFakeScanner())

	err := agent.RunJob(context.Background(), JobPayload{
		ID:         1,
		CIDRBlocks: []string{"192.168.1.0/24"},
		Port:       22080,
	})
	if err != nil {
		t.Fatalf("RunJob returned error: %v", err)
	}
	if fakeCloud.uploadedBatchCount == 0 {
		t.Fatal("expected uploaded batches")
	}
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/runtime -run TestAgentRunsJobAndUploadsResults -v`

Workdir: `probe-go`

Expected: FAIL with missing job runtime behavior.

**Step 3: Write minimal implementation**

Wire the probe runtime to poll jobs, mark them as started, call the scanner, upload progress, upload batched result sets, and finish jobs with `success` or `failed`.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/runtime -run TestAgentRunsJobAndUploadsResults -v`

Workdir: `probe-go`

Expected: PASS

**Step 5: Commit**

```bash
git add probe-go/internal/runtime/agent.go probe-go/internal/client/cloud_client.go probe-go/internal/runtime/agent_test.go probe-go/internal/scanner/adapter.go
git commit -m "feat: implement probe job execution flow"
```

### Task 10: Add frontend probe list and manual scan UI

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/pages/ScanPage.jsx`
- Create: `frontend/src/pages/probeScanUtils.js`
- Create: `frontend/src/pages/probeScanUtils.test.js`

**Step 1: Write the failing test**

```js
import { normalizeProbeScanRequest } from './probeScanUtils';

test('normalizes CIDR text into request payload', () => {
  expect(normalizeProbeScanRequest({
    probeId: '2',
    cidrText: '192.168.1.0/24\n192.168.2.0/24',
  })).toEqual({
    probeId: 2,
    cidr_blocks: ['192.168.1.0/24', '192.168.2.0/24'],
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- probeScanUtils.test.js`

Workdir: `frontend`

Expected: FAIL with missing helper module.

**Step 3: Write minimal implementation**

Add probe APIs to the frontend service layer. Update [ScanPage.jsx](D:/menusifu/device_management/frontend/src/pages/ScanPage.jsx) so admins choose a probe, configure CIDR blocks, trigger probe jobs, and view recent job history while keeping the current device table intact.

**Step 4: Run build to verify it passes**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/pages/ScanPage.jsx frontend/src/pages/probeScanUtils.js frontend/src/pages/probeScanUtils.test.js
git commit -m "feat: add probe-based scan controls"
```

### Task 11: Add probe heartbeat visibility and job history UI

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/services/api.js`

**Step 1: Write the failing test**

```js
import { getProbeStatusTone } from './probeScanUtils';

test('maps offline probe status to warning tone', () => {
  expect(getProbeStatusTone('offline')).toEqual(expect.objectContaining({
    color: expect.any(String),
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- probeScanUtils.test.js`

Workdir: `frontend`

Expected: FAIL before helper exists.

**Step 3: Write minimal implementation**

Enhance the scan page to show probe status, last heartbeat time, and recent jobs with clear failure reasons.

**Step 4: Run build to verify it passes**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 5: Commit**

```bash
git add frontend/src/pages/ScanPage.jsx frontend/src/services/api.js frontend/src/pages/probeScanUtils.js frontend/src/pages/probeScanUtils.test.js
git commit -m "feat: add probe status and job history ui"
```

### Task 12: End-to-end verification and rollout hardening

**Files:**
- Modify: `backend-go/internal/handlers/probe_agent.go` as needed
- Modify: `backend-go/internal/services/scan_service.go` as needed
- Modify: `probe-go/internal/runtime/agent.go` as needed
- Modify: `frontend/src/pages/ScanPage.jsx` as needed
- Modify: `docs/plans/2026-03-20-public-lan-probe-scan-plan.md` if verification notes must be updated

**Step 1: Run backend tests**

Run: `go test ./...`

Workdir: `backend-go`

Expected: all tests pass

**Step 2: Run probe tests**

Run: `go test ./...`

Workdir: `probe-go`

Expected: all tests pass

**Step 3: Run frontend build**

Run: `npm run build`

Workdir: `frontend`

Expected: build success

**Step 4: Manual verification**

1. Register a new probe from a Windows machine inside a private LAN
2. Confirm the probe appears online in the management UI
3. Create a scan job for one RFC1918 CIDR block
4. Confirm the probe picks up the job and transitions it to `running`
5. Confirm progress updates appear in the UI
6. Confirm discovered POS devices are written into the existing device list
7. Confirm offline or failed probe states are visible and actionable
8. Confirm the backend rejects public CIDR blocks or non-`22080` ports

**Step 5: Fix only observed rollout issues**

Only patch proven issues from verification, such as duplicate result uploads, stale probe status transitions, CIDR validation gaps, job ownership mismatches, or frontend polling edge cases. Do not add WebSocket push, auto-upgrade, or distributed scheduling in this phase.

**Step 6: Commit**

```bash
git add backend-go probe-go frontend docs/plans/2026-03-20-public-lan-probe-scan-plan.md
git commit -m "feat: complete public lan probe scan flow"
```
