# Platform Remediation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the platform's permission boundaries, borrow workflow, and workspace entry structure so scanning, approvals, Linux operations, and DB operations all follow a single secure business model.

**Architecture:** Introduce a unified `borrow_requests` domain model and a reusable asset-access service in the Go backend, then move route handlers and workspace aggregation onto those abstractions. Keep the frontend on the existing React stack, but remove duplicated approval pages and point all borrow and approval flows at the unified APIs.

**Tech Stack:** Go, Gin, GORM, SQLite, React, Vite, Axios

---

### Task 1: Add Unified Borrow Request Model And Migration Path

**Files:**
- Create: `backend-go/internal/models/borrow_request.go`
- Create: `backend-go/internal/repository/borrow_request_repo.go`
- Create: `backend-go/internal/repository/borrow_request_repo_test.go`
- Modify: `backend-go/cmd/server/main.go`
- Modify: `backend-go/internal/models/device_borrow_request.go`
- Modify: `backend-go/internal/models/mobile_borrow_request.go`

**Step 1: Write the failing tests**

```go
func TestBorrowRequestRepository_CreateAndListByAssetType(t *testing.T) {
	db := newTestDB(t)
	repo := NewBorrowRequestRepository(db)

	req := &models.BorrowRequest{
		AssetType:   "pos",
		MerchantID:  strPtr("M100"),
		RequesterID: 1,
		Status:      "pending",
		Purpose:     "store support",
		EndTime:     time.Now().Add(2 * time.Hour),
	}

	require.NoError(t, repo.Create(req))

	items, err := repo.List(BorrowRequestListOptions{Status: "pending"})
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, "pos", items[0].AssetType)
}

func TestBorrowRequestRepository_MigrateLegacyRequests(t *testing.T) {
	db := newLegacyBorrowRequestDB(t)
	repo := NewBorrowRequestRepository(db)

	require.NoError(t, repo.MigrateLegacyBorrowRequests())

	items, err := repo.List(BorrowRequestListOptions{})
	require.NoError(t, err)
	require.Len(t, items, 2)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/repository -run "TestBorrowRequestRepository" -v`
Expected: FAIL because `BorrowRequest` and `BorrowRequestRepository` do not exist yet.

**Step 3: Write minimal implementation**

```go
type BorrowRequest struct {
	ID              uint
	AssetType       string
	AssetID         *uint
	MerchantID      *string
	RequesterID     uint
	ApproverUserID  *uint
	Status          string
	Purpose         string
	EndTime         time.Time
	RejectionReason *string
	ProcessedAt     *time.Time
	ProcessedBy     *uint
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (BorrowRequest) TableName() string { return "borrow_requests" }
```

Implement repository methods for `Create`, `GetByID`, `List`, `ListByRequester`, `ListPendingByApprover`, and `MigrateLegacyBorrowRequests`. Update `main.go` to auto-migrate the new model and invoke the legacy-to-new migration once at startup.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/repository -run "TestBorrowRequestRepository" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/models/borrow_request.go backend-go/internal/repository/borrow_request_repo.go backend-go/internal/repository/borrow_request_repo_test.go backend-go/cmd/server/main.go backend-go/internal/models/device_borrow_request.go backend-go/internal/models/mobile_borrow_request.go
git commit -m "feat: add unified borrow request model"
```

### Task 2: Add Asset Access Service And Centralize Permission Checks

**Files:**
- Create: `backend-go/internal/services/asset_access_service.go`
- Create: `backend-go/internal/services/asset_access_service_test.go`
- Modify: `backend-go/internal/handlers/linux.go`
- Modify: `backend-go/internal/handlers/db_config.go`
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/mobile.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing tests**

```go
func TestAssetAccessService_AllowsAdminOwnerAndOccupier(t *testing.T) {
	svc := newAssetAccessServiceForTest(t)

	require.True(t, svc.CanAccess(testAdminID, AssetScope{AssetType: "pos", MerchantID: "M100"}, ActionLinuxRead))
	require.True(t, svc.CanAccess(testOwnerID, AssetScope{AssetType: "pos", MerchantID: "M100"}, ActionLinuxRead))
	require.True(t, svc.CanAccess(testOccupierID, AssetScope{AssetType: "pos", MerchantID: "M100"}, ActionLinuxRead))
	require.False(t, svc.CanAccess(testOtherUserID, AssetScope{AssetType: "pos", MerchantID: "M100"}, ActionLinuxRead))
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run "TestAssetAccessService" -v`
Expected: FAIL because the service does not exist.

**Step 3: Write minimal implementation**

```go
type Action string

const (
	ActionScanView  Action = "scan:view"
	ActionLinuxRead Action = "linux:read"
	ActionLinuxWrite Action = "linux:write"
	ActionDBRead    Action = "db:read"
	ActionDBWrite   Action = "db:write"
	ActionBorrowApprove Action = "borrow:approve"
)
```

Implement a service that resolves the current user's effective relationship to a POS or mobile asset, then expose helpers such as `RequirePOSAction`, `RequireMobileAction`, and `RequireBorrowApproval`. Replace scattered `checkDevicePermission` logic in Linux, DB, device, and mobile handlers with the shared service. Wire the service through `main.go`.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run "TestAssetAccessService" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/asset_access_service.go backend-go/internal/services/asset_access_service_test.go backend-go/internal/handlers/linux.go backend-go/internal/handlers/db_config.go backend-go/internal/handlers/device.go backend-go/internal/handlers/mobile.go backend-go/cmd/server/main.go
git commit -m "feat: centralize asset access control"
```

### Task 3: Replace Legacy Borrow Handlers With Unified Borrow Service

**Files:**
- Create: `backend-go/internal/services/borrow_service.go`
- Create: `backend-go/internal/services/borrow_service_test.go`
- Create: `backend-go/internal/handlers/borrow.go`
- Modify: `backend-go/internal/handlers/workspace.go`
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/mobile.go`
- Modify: `backend-go/internal/repository/device_repo.go`
- Modify: `backend-go/internal/repository/mobile_repo.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing tests**

```go
func TestBorrowService_SubmitAndApprovePOSRequest(t *testing.T) {
	svc := newBorrowServiceForTest(t)

	req, err := svc.Submit(BorrowSubmitInput{
		AssetType:   "pos",
		MerchantID:  "M100",
		RequesterID: 2,
		Purpose:     "temporary support",
		EndTime:     time.Now().Add(4 * time.Hour),
	})
	require.NoError(t, err)

	approved, err := svc.Approve(req.ID, 1)
	require.NoError(t, err)
	require.Equal(t, "approved", approved.Status)
}

func TestBorrowService_SubmitAndRejectMobileRequest(t *testing.T) {
	svc := newBorrowServiceForTest(t)
	req, err := svc.Submit(BorrowSubmitInput{
		AssetType:   "mobile",
		AssetID:     uintPtr(10),
		RequesterID: 2,
		Purpose:     "field repair",
		EndTime:     time.Now().Add(8 * time.Hour),
	})
	require.NoError(t, err)

	rejected, err := svc.Reject(req.ID, 1, "busy")
	require.NoError(t, err)
	require.Equal(t, "rejected", rejected.Status)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run "TestBorrowService" -v`
Expected: FAIL because the unified borrow service does not exist.

**Step 3: Write minimal implementation**

```go
type BorrowSubmitInput struct {
	AssetType   string
	AssetID     *uint
	MerchantID  string
	RequesterID uint
	Purpose     string
	EndTime     time.Time
}
```

Implement a single borrow service that:
- submits requests to `borrow_requests`
- resolves approvers from POS owner / mobile owner / admin fallback
- approves by updating occupancy on POS or mobile records
- rejects with a single status transition path

Add `BorrowHandler` with unified endpoints and convert workspace aggregation to read from the new repository. Keep legacy device/mobile borrow endpoints as thin compatibility shims during the cutover.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run "TestBorrowService" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/services/borrow_service.go backend-go/internal/services/borrow_service_test.go backend-go/internal/handlers/borrow.go backend-go/internal/handlers/workspace.go backend-go/internal/handlers/device.go backend-go/internal/handlers/mobile.go backend-go/internal/repository/device_repo.go backend-go/internal/repository/mobile_repo.go backend-go/cmd/server/main.go
git commit -m "feat: unify borrow workflow and workspace queries"
```

### Task 4: Lock Down Scan, Linux, DB, And Admin Initialization

**Files:**
- Modify: `backend-go/cmd/server/main.go`
- Modify: `backend-go/internal/config/config.go`
- Modify: `backend-go/internal/handlers/linux.go`
- Modify: `backend-go/internal/handlers/db_config.go`
- Create: `backend-go/internal/config/config_test.go`
- Create: `backend-go/internal/handlers/linux_permission_test.go`

**Step 1: Write the failing tests**

```go
func TestInitRequiresExplicitAdminBootstrap(t *testing.T) {
	resetEnv(t)
	_, err := LoadBootstrapAdminConfig()
	require.Error(t, err)
}

func TestLinuxStatusRequiresAssetPermission(t *testing.T) {
	router := newLinuxRouterForTest(t)
	resp := performRequest(router, "GET", "/api/linux/status?merchant_id=M100", unauthorizedButConnectedUserToken)
	require.Equal(t, http.StatusForbidden, resp.Code)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/config ./internal/handlers -run "TestInitRequiresExplicitAdminBootstrap|TestLinuxStatusRequiresAssetPermission" -v`
Expected: FAIL because admin bootstrap rules and Linux permission guards are not implemented.

**Step 3: Write minimal implementation**

```go
type BootstrapAdminConfig struct {
	Username string
	Password string
	Email    string
	Name     string
}
```

Update startup to require explicit bootstrap env vars before creating the first admin, otherwise fail fast. Move scan routes under `middleware.Auth()`. Add shared permission guards to all Linux read/write endpoints, DB connection endpoints, execute history endpoints, scan detail endpoints, and realtime log websocket entry.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/config ./internal/handlers -run "TestInitRequiresExplicitAdminBootstrap|TestLinuxStatusRequiresAssetPermission" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/cmd/server/main.go backend-go/internal/config/config.go backend-go/internal/config/config_test.go backend-go/internal/handlers/linux.go backend-go/internal/handlers/db_config.go backend-go/internal/handlers/linux_permission_test.go
git commit -m "fix: tighten platform permissions and bootstrap rules"
```

### Task 5: Collapse Frontend Borrow Entry Points And Remove Sensitive Defaults

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/pages/WorkspacePage.jsx`
- Modify: `frontend/src/components/workspace/PendingApprovalsTab.jsx`
- Modify: `frontend/src/components/workspace/MyRequestsTab.jsx`
- Modify: `frontend/src/components/workspace/MyBorrowsTab.jsx`
- Modify: `frontend/src/components/workspace/MyDevicesTab.jsx`
- Modify: `frontend/src/pages/ScanPage.jsx`
- Modify: `frontend/src/pages/LinuxConfigPage.jsx`
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Delete: `frontend/src/pages/BorrowApprovalPage.jsx`

**Step 1: Write the failing UI check**

```bash
npm run build
```

Expected after code changes: the build should fail first if imports still reference `BorrowApprovalPage`, if workspace tabs still expect legacy payloads, or if API helpers are inconsistent.

**Step 2: Implement the minimal frontend changes**

```jsx
const [activeTab, setActiveTab] = useState(tabFromUrl || 'requests');
```

Replace the duplicated borrow approval page with a redirect to `/workspace?tab=approvals`, switch all borrow and approval API helpers to the unified backend endpoints, remove hardcoded Linux and DB credentials, and update workspace components to consume a single borrow payload shape while still rendering POS and mobile badges.

**Step 3: Run frontend verification**

Run: `npm run build`
Expected: PASS

**Step 4: Add a small compatibility redirect**

```jsx
<Route path="/borrow-approval" element={<Navigate to="/workspace?tab=approvals" replace />} />
```

Keep old links working while eliminating the standalone page implementation.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/services/api.js frontend/src/pages/WorkspacePage.jsx frontend/src/components/workspace/PendingApprovalsTab.jsx frontend/src/components/workspace/MyRequestsTab.jsx frontend/src/components/workspace/MyBorrowsTab.jsx frontend/src/components/workspace/MyDevicesTab.jsx frontend/src/pages/ScanPage.jsx frontend/src/pages/LinuxConfigPage.jsx frontend/src/pages/DBConfigPage.jsx frontend/src/pages/BorrowApprovalPage.jsx
git commit -m "feat: unify workspace borrow flows"
```

### Task 6: Final Verification And Legacy Cleanup

**Files:**
- Modify: `backend-go/internal/handlers/device.go`
- Modify: `backend-go/internal/handlers/mobile.go`
- Modify: `backend-go/internal/handlers/workspace.go`
- Modify: `docs/plans/2026-03-12-platform-remediation-design.md`
- Modify: `docs/plans/2026-03-12-platform-remediation-plan.md`

**Step 1: Remove dead legacy paths**

Delete or inline any legacy-only borrow helper code that is no longer reachable after frontend and route cutover.

**Step 2: Run backend verification**

Run: `go test ./...`
Expected: PASS

**Step 3: Run frontend verification**

Run: `npm run build`
Expected: PASS

**Step 4: Check git status**

Run: `git status --short`
Expected: only intended remediation files are modified.

**Step 5: Commit**

```bash
git add backend-go frontend docs/plans/2026-03-12-platform-remediation-design.md docs/plans/2026-03-12-platform-remediation-plan.md
git commit -m "refactor: complete platform remediation"
```
