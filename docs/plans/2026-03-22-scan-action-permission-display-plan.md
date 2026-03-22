# Scan Action Permission Display Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Unify how restricted device-management actions are shown to non-admin users in the scan table action menu.

**Architecture:** Keep the permission and visibility rules in pure helper functions inside `frontend/src/components/scanTableState.js`, then let `frontend/src/components/ScanTable.jsx` render from that derived state. This keeps the behavior testable without needing JSX rendering tests.

**Tech Stack:** React, Vite, Node built-in test runner

---

### Task 1: Define the unified rule in tests

**Files:**
- Modify: `frontend/src/components/scanTableState.test.js`
- Test: `frontend/src/components/scanTableState.test.js`

**Step 1: Write the failing test**

Add tests that describe the new rule:
- Linux config, DB config, License backup/import, and DB backup/restore all stay visible for eligible devices when the action exists.
- When a normal user lacks permission, the entries are disabled instead of hidden.
- When `merchantId` is missing, the same entries stay visible but disabled with a missing-MID reason.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/scanTableState.test.js`

Expected: FAIL because the helper for unified action state does not exist yet.

### Task 2: Implement the shared permission-state helper

**Files:**
- Modify: `frontend/src/components/scanTableState.js`

**Step 1: Write minimal implementation**

Add pure helpers that:
- Normalize the permission reason for device-management actions
- Return `visible`, `disabled`, and `title` for each menu action

**Step 2: Run test to verify it passes**

Run: `npm test -- src/components/scanTableState.test.js`

Expected: PASS for the new permission-state tests.

### Task 3: Wire ScanTable to the shared helper

**Files:**
- Modify: `frontend/src/components/ScanTable.jsx`

**Step 1: Replace inline branching**

Use the helper output to render menu items so the four entries follow the same display rule.

**Step 2: Run focused tests**

Run: `npm test -- src/components/scanTableState.test.js`

Expected: PASS

### Task 4: Run regression verification

**Files:**
- Test: `frontend/src/components/scanTableState.test.js`
- Test: `frontend/src/components/detailModalState.test.js`
- Test: `frontend/src/pages/scanPageState.test.js`

**Step 1: Run the frontend test suite**

Run: `npm test`

Expected: PASS with exit code 0.
