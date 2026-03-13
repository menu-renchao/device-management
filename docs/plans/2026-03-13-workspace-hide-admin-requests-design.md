# Workspace Hide Admin Requests Design

**Goal:** Hide the workspace "My Requests" tab for admins and redirect admin `requests` tab URLs back to `approvals`.

**Scope**

- Hide the `requests` workspace tab when the current user is an admin
- Normalize admin `?tab=requests` URLs to `approvals`
- Keep the existing `requests` tab behavior unchanged for non-admin users
- Leave `MyRequestsTab` in place for future reuse and non-admin access

**Approach**

This change stays entirely in the frontend workspace tab state and page composition. We will keep tab normalization as a pure helper so the admin-specific fallback can be covered with a lightweight `node:test` unit test. `WorkspacePage` will derive the visible tab list from the current role and use the helper to keep the URL and active tab aligned.

**Testing**

- Frontend: `node:test` coverage for admin tab availability and admin `requests` fallback
- Confidence check: run the targeted workspace page state test file after the implementation
