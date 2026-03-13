# Workspace Hide Admin Requests Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Remove the workspace "My Requests" entry for admins and prevent admins from landing on the now-hidden `requests` tab.

**Architecture:** The change remains in the frontend. A small pure state helper will describe which workspace tabs are available for admins versus non-admins and how requested tabs should be normalized. `WorkspacePage` will use that helper to render the tab strip and keep the query string on a valid tab.

**Tech Stack:** React, React Router, Vite, Node `node:test`

---

### Task 1: Add Admin Workspace Tab State Tests

**Files:**
- Modify: `frontend/src/pages/workspacePageState.test.js`

1. Write a failing test that asserts admins do not get a `requests` tab in the available tab list.
2. Write a failing test that asserts admin `requests` tabs normalize to `approvals`.
3. Run `node --test frontend/src/pages/workspacePageState.test.js` and verify the new assertions fail.

### Task 2: Implement Admin Tab Filtering

**Files:**
- Modify: `frontend/src/pages/workspacePageState.js`
- Modify: `frontend/src/pages/WorkspacePage.jsx`

1. Add a pure helper that returns the workspace tabs available for a given admin flag.
2. Update tab normalization so admins fall back from `requests` to `approvals`.
3. Update `WorkspacePage` to derive the visible tabs from the current user role and use the new normalization helper.
4. Keep the non-admin tab list and content rendering unchanged.

### Task 3: Verify

**Files:**
- No new production files

1. Run `node --test frontend/src/pages/workspacePageState.test.js`
2. Review the workspace diff to confirm only admin behavior changed
