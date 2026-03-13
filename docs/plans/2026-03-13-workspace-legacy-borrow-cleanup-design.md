# Workspace Legacy Borrow Cleanup Design

**Goal:** Remove the last legacy borrow-table compatibility path, make the workspace always default to the approvals tab, and ensure POS borrow requests render correctly in "My Requests".

**Scope**

- Remove startup-time reads from `device_borrow_requests` and `mobile_borrow_requests`
- Keep `borrow_requests` as the only active borrow-request source
- Make `WorkspacePage` default to `approvals` whenever no valid tab is provided
- Make `MyRequestsTab` resilient to both snake_case and camelCase request payload fields so POS entries always render

**Approach**

The backend cleanup is small and isolated: remove the legacy migration call from startup and delete the now-unused repository migration helpers and tests. The workspace behavior fix is handled in the frontend with small pure helper modules so we can cover tab-default logic and request splitting/rendering behavior with lightweight Node tests instead of introducing a heavier frontend test framework.

**Testing**

- Backend: source-level startup regression checks and repository test cleanup
- Frontend: `node:test` coverage for workspace tab defaults and request splitting/display helpers
- Integration confidence: `go test ./...` and `npm run build`
