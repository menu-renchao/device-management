# Feature Request Board Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a logged-in-only feature request board where users can submit ideas, like or unlike requests, view hot and latest rankings, and admins can update request status.

**Architecture:** Extend the existing React + Go + SQLite monolith with a new authenticated route, dedicated backend model/repository/handler flow, and two new database-backed entities for requests and likes. Keep the first release intentionally small: one page, one submission flow, one list endpoint with sort options, one like relation, and one admin-only status update action.

**Tech Stack:** React 18, React Router, Axios, Go Gin, GORM, SQLite

---

### Task 1: Capture The Approved Docs In Repo

**Files:**
- Create: `docs/plans/2026-03-12-feature-request-board-design.md`
- Create: `docs/plans/2026-03-12-feature-request-board-plan.md`

**Step 1: Verify the design doc exists**

Run: `Get-ChildItem docs/plans`
Expected: both `2026-03-12-feature-request-board-design.md` and `2026-03-12-feature-request-board-plan.md` are listed.

**Step 2: Review the approved scope before coding**

Run: `Get-Content -Raw docs/plans/2026-03-12-feature-request-board-design.md`
Expected: the doc confirms logged-in-only visibility, single-like-per-user, admin-only status changes, and route-level independent page design.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-12-feature-request-board-design.md docs/plans/2026-03-12-feature-request-board-plan.md
git commit -m "docs: add feature request board design and plan"
```

### Task 2: Add Backend Data Models First

**Files:**
- Create: `backend-go/internal/models/feature_request.go`
- Create: `backend-go/internal/models/feature_request_like.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing test target**

Define the data contract that does not exist yet:
- `feature_requests` table with title, content, status, created_by, like_count
- `feature_request_likes` table with request_id, user_id unique relation
- auto-migration creates both tables

**Step 2: Verify RED in the current codebase**

Run: `Get-ChildItem backend-go/internal/models`
Expected: there are no feature request model files yet.

**Step 3: Write minimal implementation**

Create `feature_request.go` with:
- status constants for `pending`, `planned`, `completed`, `rejected`
- `FeatureRequest` struct with GORM fields and author relation if already practical

Create `feature_request_like.go` with:
- `FeatureRequestLike` struct
- composite unique index on `request_id` and `user_id`

Register both models in the existing auto-migrate section in `backend-go/cmd/server/main.go`.

**Step 4: Run targeted backend build verification**

Run: `go test ./...`
Workdir: `backend-go`
Expected: tests pass or, if unrelated existing failures appear, the new model files compile cleanly and no new compile errors are introduced.

**Step 5: Commit**

```bash
git add backend-go/internal/models/feature_request.go backend-go/internal/models/feature_request_like.go backend-go/cmd/server/main.go
git commit -m "feat: add feature request data models"
```

### Task 3: Build Repository Support With Ranking Queries

**Files:**
- Create: `backend-go/internal/repository/feature_request_repo.go`
- Create: `backend-go/internal/repository/feature_request_repo_test.go`

**Step 1: Write the failing test**

Add repository tests covering:
- create request with default status and zero likes
- list ordered by `created_at desc` for latest
- list ordered by `like_count desc, created_at desc` for hot
- filter by status
- reject duplicate like from same user via unique relation or repo guard

**Step 2: Run the new repository tests to verify RED**

Run: `go test ./internal/repository -run FeatureRequest -v`
Workdir: `backend-go`
Expected: FAIL because the repository implementation does not exist yet.

**Step 3: Write minimal implementation**

Implement repository methods for:
- `Create`
- `List`
- `GetByID`
- `AddLike`
- `RemoveLike`
- `UpdateStatus`

Keep list queries simple and explicit:
- latest: `ORDER BY created_at DESC`
- hot: `ORDER BY like_count DESC, created_at DESC`

Make `AddLike` and `RemoveLike` transactional so relation table changes and `like_count` stay in sync.

**Step 4: Run the repository tests to verify GREEN**

Run: `go test ./internal/repository -run FeatureRequest -v`
Workdir: `backend-go`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/repository/feature_request_repo.go backend-go/internal/repository/feature_request_repo_test.go
git commit -m "feat: add feature request repository operations"
```

### Task 4: Add Backend Handlers And Authenticated Routes

**Files:**
- Create: `backend-go/internal/handlers/feature_request.go`
- Create: `backend-go/internal/handlers/feature_request_test.go`
- Modify: `backend-go/cmd/server/main.go`

**Step 1: Write the failing handler tests**

Add handler tests for:
- logged-in user can create request
- logged-in user can fetch list
- logged-in user can like and unlike
- non-admin cannot update status
- admin can update status

Use the existing authenticated test helper patterns already present in `device_*_test.go`.

**Step 2: Run the new handler tests to verify RED**

Run: `go test ./internal/handlers -run FeatureRequest -v`
Workdir: `backend-go`
Expected: FAIL because the handler and routes do not exist yet.

**Step 3: Write minimal implementation**

Implement the handler endpoints:
- `GET /api/feature-requests`
- `POST /api/feature-requests`
- `POST /api/feature-requests/:id/like`
- `DELETE /api/feature-requests/:id/like`
- `PUT /api/feature-requests/:id/status`

Response shape for list items should include:
- request base fields
- author display fields
- `like_count`
- `liked_by_me`

Reuse the authenticated user from Gin context and enforce admin-only status updates with the same role check style used elsewhere in the repo.

**Step 4: Run the handler tests to verify GREEN**

Run: `go test ./internal/handlers -run FeatureRequest -v`
Workdir: `backend-go`
Expected: PASS

**Step 5: Commit**

```bash
git add backend-go/internal/handlers/feature_request.go backend-go/internal/handlers/feature_request_test.go backend-go/cmd/server/main.go
git commit -m "feat: add feature request API endpoints"
```

### Task 5: Expose Frontend API Helpers

**Files:**
- Modify: `frontend/src/services/api.js`

**Step 1: Write the failing contract checklist**

The frontend service layer must be able to:
- fetch requests with sort and status params
- submit a new request
- like a request
- unlike a request
- update request status

**Step 2: Verify RED in current source**

Run: `Get-Content -Raw frontend/src/services/api.js`
Expected: no feature request service helpers exist yet.

**Step 3: Write minimal implementation**

Add service methods:
- `getFeatureRequests({ sort, status, page, pageSize })`
- `createFeatureRequest(payload)`
- `likeFeatureRequest(id)`
- `unlikeFeatureRequest(id)`
- `updateFeatureRequestStatus(id, status)`

Keep naming consistent with existing service exports in the file.

**Step 4: Run frontend build verification**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add feature request frontend api helpers"
```

### Task 6: Add The Feature Request Page And Route

**Files:**
- Create: `frontend/src/pages/FeatureRequestsPage.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Write the failing UI checklist**

The app currently does not provide:
- `/feature-requests` route
- navbar entry for the feature board
- board page with list loading
- sort switching between hot and latest

**Step 2: Verify RED in current app**

Run: `Get-Content -Raw frontend/src/App.jsx`
Expected: no route or nav link for feature requests exists.

**Step 3: Write minimal implementation**

Create `FeatureRequestsPage.jsx` with:
- page header
- sort toggle
- optional status filter
- list fetch on load
- empty state

Update `App.jsx` to:
- import the page
- add a new navbar link
- register a protected `/feature-requests` route inside `MainLayout`

Follow the inline-style conventions already used in this repo unless there is a clear existing CSS pattern to reuse.

**Step 4: Run frontend build verification**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/FeatureRequestsPage.jsx frontend/src/App.jsx
git commit -m "feat: add feature request board page"
```

### Task 7: Implement Submission And Like Interactions

**Files:**
- Modify: `frontend/src/pages/FeatureRequestsPage.jsx`

**Step 1: Write the failing interaction checklist**

The new page must allow:
- opening a submit form
- validating title and content
- creating a request
- liking and unliking a card
- reflecting `liked_by_me` and `like_count` changes in the UI

**Step 2: Verify RED through the current page source**

Run: `Get-Content -Raw frontend/src/pages/FeatureRequestsPage.jsx`
Expected: the page only contains static or list-only scaffolding without the approved interactions.

**Step 3: Write minimal implementation**

Extend the page to include:
- a modal or inline dialog for submission
- local form state and validation
- optimistic or immediate refresh flow after create
- like button state driven by `liked_by_me`
- consistent loading and disabled states during actions

Keep the first version simple and avoid comments, attachments, rich text, or edit/delete actions.

**Step 4: Run frontend build verification**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/FeatureRequestsPage.jsx
git commit -m "feat: add feature request submit and like flows"
```

### Task 8: Add Admin Status Controls To The Page

**Files:**
- Modify: `frontend/src/pages/FeatureRequestsPage.jsx`

**Step 1: Write the failing admin checklist**

The page must additionally support:
- status badges visible to all users
- admin-only status action controls
- immediate UI refresh after status change

**Step 2: Verify RED in current page**

Run: `Get-Content -Raw frontend/src/pages/FeatureRequestsPage.jsx`
Expected: there is no admin-only status update flow yet.

**Step 3: Write minimal implementation**

Use `useAuth()` to detect admin users and render a status select or action buttons only for admins. Keep status labels user-friendly in Chinese while sending backend enum values.

**Step 4: Run frontend build verification**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/FeatureRequestsPage.jsx
git commit -m "feat: add admin status controls for feature requests"
```

### Task 9: Final Backend And Frontend Verification

**Files:**
- Modify: `backend-go/internal/models/feature_request.go`
- Modify: `backend-go/internal/repository/feature_request_repo.go`
- Modify: `backend-go/internal/handlers/feature_request.go`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/pages/FeatureRequestsPage.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Run backend verification**

Run: `go test ./...`
Workdir: `backend-go`
Expected: all relevant backend packages compile and tests pass.

**Step 2: Run frontend verification**

Run: `npm run build`
Workdir: `frontend`
Expected: Vite build succeeds.

**Step 3: Review the diff**

Run: `git diff -- docs/plans/2026-03-12-feature-request-board-design.md docs/plans/2026-03-12-feature-request-board-plan.md backend-go/cmd/server/main.go backend-go/internal/models backend-go/internal/repository backend-go/internal/handlers frontend/src/services/api.js frontend/src/pages/FeatureRequestsPage.jsx frontend/src/App.jsx`
Expected: only the feature request board documentation and implementation changes are present.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-12-feature-request-board-design.md docs/plans/2026-03-12-feature-request-board-plan.md backend-go/cmd/server/main.go backend-go/internal/models backend-go/internal/repository backend-go/internal/handlers frontend/src/services/api.js frontend/src/pages/FeatureRequestsPage.jsx frontend/src/App.jsx
git commit -m "feat: add feature request board"
```

---

Plan complete and saved to `docs/plans/2026-03-12-feature-request-board-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh session per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
