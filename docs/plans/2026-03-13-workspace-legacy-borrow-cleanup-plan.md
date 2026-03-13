# Workspace Legacy Borrow Cleanup Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Remove legacy borrow-table compatibility, default the workspace to approvals, and make POS borrow requests render reliably in "My Requests".

**Architecture:** The backend will stop invoking legacy table migration entirely and keep `borrow_requests` as the only active source of truth. The frontend will move workspace tab normalization and my-request splitting/display behavior into tiny pure helpers so behavior can be covered with `node:test` without introducing a larger test framework.

**Tech Stack:** Go, Gin, GORM, React, Vite, Node `node:test`

---

### Task 1: Remove Legacy Borrow Migration Wiring

**Files:**
- Modify: `backend-go/cmd/server/main.go`
- Modify: `backend-go/cmd/server/auto_migrate_models_test.go`
- Modify: `backend-go/internal/repository/borrow_request_repo.go`
- Modify: `backend-go/internal/repository/borrow_request_repo_test.go`

1. Write failing tests asserting startup source no longer calls `MigrateLegacyBorrowRequests` and no legacy migration helper remains required.
2. Run targeted tests and verify they fail.
3. Remove the startup call and delete legacy migration helpers/tests.
4. Re-run targeted tests and make them pass.

### Task 2: Default Workspace To Approvals

**Files:**
- Create: `frontend/src/pages/workspacePageState.js`
- Create: `frontend/src/pages/workspacePageState.test.js`
- Modify: `frontend/src/pages/WorkspacePage.jsx`

1. Write a failing Node test for defaulting to `approvals` when URL tab is absent or invalid.
2. Run the test and verify it fails.
3. Move tab normalization into a helper and update `WorkspacePage` to use it.
4. Re-run the test and make it pass.

### Task 3: Make My Requests POS Rendering Robust

**Files:**
- Create: `frontend/src/components/workspace/myRequestsState.js`
- Create: `frontend/src/components/workspace/myRequestsState.test.js`
- Modify: `frontend/src/components/workspace/MyRequestsTab.jsx`

1. Write a failing Node test covering POS/mobile request splitting and device-name fallback behavior.
2. Run the test and verify it fails.
3. Move request splitting/display helpers into a pure module and use it from `MyRequestsTab`.
4. Re-run the test and make it pass.

### Task 4: Verify And Review

**Files:**
- No new production files

1. Run `go test ./...`
2. Run the frontend Node tests directly
3. Run `npm run build`
4. Review the diff and summarize rollout impact
