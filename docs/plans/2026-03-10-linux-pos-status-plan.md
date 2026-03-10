# Linux POS Status Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make Linux POS status report running only when `/opt/menusifu/menusifu_pos_extention` exists in the remote process list.

**Architecture:** Add a small pure helper that evaluates process output, test it first, then update `GetPOSStatus` to query the specific process path and reuse that helper. Keep the API payload stable so the frontend does not need changes.

**Tech Stack:** Go, Gin, Go test

---

### Task 1: Add regression coverage for POS status matching

**Files:**
- Create: `backend-go/internal/services/linux_service_test.go`
- Modify: `backend-go/internal/services/linux_service.go`

**Step 1: Write the failing test**

Add tests that assert:
- output containing `/opt/menusifu/menusifu_pos_extention` returns running
- output without that path returns stopped

**Step 2: Run test to verify it fails**

Run: `go test ./internal/services -run TestPOS`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add a helper that checks for `/opt/menusifu/menusifu_pos_extention` in process output and update `GetPOSStatus` to fetch that specific process.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/services -run TestPOS`

Expected: PASS

### Task 2: Verify service package remains green

**Files:**
- Modify: `backend-go/internal/services/linux_service.go`
- Test: `backend-go/internal/services/linux_service_test.go`

**Step 1: Run focused package tests**

Run: `go test ./internal/services`

**Step 2: Confirm output is green**

Expected: PASS
