# Frontend Apple Settings Redesign Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Migrate the entire frontend to a high-density design system inspired by macOS System Settings without changing business workflows.

**Architecture:** Start with global design tokens and shared UI primitives, then normalize the global shell and feedback system, and finally migrate existing pages by page type. Preserve the current business logic and API flows while replacing shells, components, and styling with a unified system. Follow TDD, small commits, and reversible increments.

**Tech Stack:** React, React Router, CSS, inline styles, shared page components, existing frontend pages

---

### Task 1: Audit the current shared UI entry points

**Files:**
- Inspect: `frontend/src/App.css`
- Inspect: `frontend/src/App.jsx`
- Inspect: `frontend/src/App.js`
- Inspect: `frontend/src/components/ConfirmDialog.jsx`
- Inspect: `frontend/src/components/ToastContainer.jsx`
- Inspect: `frontend/src/pages/LoginPage.jsx`
- Inspect: `frontend/src/pages/WorkspacePage.jsx`

**Step 1: Document the current shared style touchpoints**

Write short implementation notes that capture:

- which global CSS file is active
- which components are reused across many pages
- which pages still rely entirely on local `const styles`
- whether both `App.js` and `App.jsx` are active or if one is dead code

**Step 2: Verify the active app entry path**

Run: `rg -n "createRoot|ReactDOM|App" frontend/src -S`
Expected: a clear path showing which app entry is used.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-10-frontend-apple-settings-redesign-design.md docs/plans/2026-03-10-frontend-apple-settings-redesign-implementation-plan.md
git commit -m "docs: add frontend redesign design and implementation plan"
```

### Task 2: Add design tokens and base styles

**Files:**
- Modify: `frontend/src/App.css`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/base.css`
- Inspect: `frontend/src/main.jsx`
- Inspect: `frontend/src/index.js`

**Step 1: Write the failing visual contract checklist**

Create a checklist for the expected global token set:

- background tokens
- text tokens
- border tokens
- accent colors
- radius scale
- spacing scale
- shadow tokens
- focus ring token

**Step 2: Wire token files into the active app entry**

Import `tokens.css` and `base.css` from the active entry module.

**Step 3: Define the minimal token set**

In `frontend/src/styles/tokens.css`, add CSS custom properties for:

- `--bg-canvas`
- `--bg-surface`
- `--bg-surface-muted`
- `--border-subtle`
- `--text-primary`
- `--text-secondary`
- `--text-tertiary`
- `--accent-blue`
- `--accent-green`
- `--accent-red`
- `--accent-orange`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--space-1` through `--space-6`
- `--shadow-sm`
- `--focus-ring`

**Step 4: Apply base document styling**

In `frontend/src/styles/base.css`, define:

- page background
- default text color
- box sizing
- selection color
- button and input font inheritance
- default focus-visible treatment
- global scrollbar polish only if already appropriate in the app

**Step 5: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS with no CSS import errors.

**Step 6: Commit**

```bash
git add frontend/src/App.css frontend/src/styles/tokens.css frontend/src/styles/base.css frontend/src/main.jsx frontend/src/index.js
git commit -m "feat: add frontend design tokens and base styles"
```

### Task 3: Normalize shared feedback components

**Files:**
- Modify: `frontend/src/components/ConfirmDialog.jsx`
- Modify: `frontend/src/components/ToastContainer.jsx`
- Test: manual verification in pages that trigger toast and confirm flows

**Step 1: Write the failing behavior checklist**

List the expected shared behavior:

- same radius and border treatment
- consistent heading and body spacing
- primary and danger action hierarchy
- unified success, error, warning, and info toast look
- visible keyboard focus on confirm actions

**Step 2: Restyle `ConfirmDialog.jsx` using tokens**

Replace hard-coded colors, radius, shadow, and spacing with token-driven values.

**Step 3: Restyle `ToastContainer.jsx` using tokens**

Unify toast surface, icon area, close action, spacing, and status-color usage.

**Step 4: Manually verify flows**

Run the app and trigger:

- one success toast
- one error toast
- one warning toast
- one confirm dialog

Expected: all shared feedback matches the new design system.

**Step 5: Commit**

```bash
git add frontend/src/components/ConfirmDialog.jsx frontend/src/components/ToastContainer.jsx
git commit -m "feat: unify feedback components with design tokens"
```

### Task 4: Build the first shared page shell

**Files:**
- Create: `frontend/src/components/ui/PageShell.jsx`
- Create: `frontend/src/components/ui/SectionGroup.jsx`
- Create: `frontend/src/components/ui/Toolbar.jsx`
- Create: `frontend/src/components/ui/ui.css`
- Modify: active app style imports if needed

**Step 1: Write the failing layout contract**

Document expected behavior:

- consistent page max width
- consistent vertical rhythm
- stable header, title, and action layout
- grouped sections with light border and subdued surface

**Step 2: Create `PageShell.jsx`**

Implement a reusable layout wrapper that supports:

- `title`
- `subtitle`
- `actions`
- content children

**Step 3: Create `SectionGroup.jsx`**

Implement a reusable grouped section wrapper with optional title, description, and extra-action slot.

**Step 4: Create `Toolbar.jsx`**

Implement a compact header action row for search, filter, and action clusters.

**Step 5: Add shared CSS**

In `frontend/src/components/ui/ui.css`, add token-driven styles for these components.

**Step 6: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS with no import errors.

**Step 7: Commit**

```bash
git add frontend/src/components/ui/PageShell.jsx frontend/src/components/ui/SectionGroup.jsx frontend/src/components/ui/Toolbar.jsx frontend/src/components/ui/ui.css
git commit -m "feat: add shared page shell components"
```

### Task 5: Build the first shared control primitives

**Files:**
- Create: `frontend/src/components/ui/Button.jsx`
- Create: `frontend/src/components/ui/Field.jsx`
- Create: `frontend/src/components/ui/SegmentedControl.jsx`
- Create: `frontend/src/components/ui/StatusBadge.jsx`
- Modify: `frontend/src/components/ui/ui.css`

**Step 1: Write the failing control contract**

Document expected variants and states:

- button: primary, secondary, tertiary, danger, icon, disabled, loading
- field: label, help text, error text, focus state
- segmented control: selected and unselected states
- status badge: success, danger, warning, neutral, info

**Step 2: Implement `Button.jsx`**

Build a token-driven button wrapper that accepts `variant`, `size`, `loading`, and standard button props.

**Step 3: Implement `Field.jsx`**

Build a wrapper that renders label, control slot, help text, and error message with consistent spacing.

**Step 4: Implement `SegmentedControl.jsx`**

Build a compact segmented switch suitable for tabs and mode selection.

**Step 5: Implement `StatusBadge.jsx`**

Build a small badge with optional dot and tone mapping.

**Step 6: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 7: Commit**

```bash
git add frontend/src/components/ui/Button.jsx frontend/src/components/ui/Field.jsx frontend/src/components/ui/SegmentedControl.jsx frontend/src/components/ui/StatusBadge.jsx frontend/src/components/ui/ui.css
git commit -m "feat: add shared UI control primitives"
```

### Task 6: Migrate the auth pages

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/pages/RegisterPage.jsx`
- Inspect: `frontend/src/components/auth`

**Step 1: Write the failing visual checklist**

Expected outcomes:

- a welcome-panel feel instead of a legacy admin card feel
- token-driven inputs and buttons
- restrained background and polished spacing
- existing validation remains visible and readable

**Step 2: Refactor `LoginPage.jsx`**

Replace hard-coded styles with token-backed layout and shared controls where practical.

**Step 3: Refactor `RegisterPage.jsx`**

Apply the same visual system and preserve existing business validation logic.

**Step 4: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 5: Manual verification**

Verify:

- login form renders correctly
- validation messages still appear
- submit loading state is visible
- keyboard focus remains clear

**Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx frontend/src/pages/RegisterPage.jsx
 git commit -m "feat: restyle auth pages with apple-like system"
```

### Task 7: Migrate the workspace page pattern

**Files:**
- Modify: `frontend/src/pages/WorkspacePage.jsx`
- Modify: `frontend/src/components/workspace/MyDevicesTab.jsx`
- Modify: `frontend/src/components/workspace/MyRequestsTab.jsx`
- Modify: `frontend/src/components/workspace/MyBorrowsTab.jsx`
- Modify: `frontend/src/components/workspace/NotificationsTab.jsx`
- Modify: `frontend/src/components/workspace/PendingApprovalsTab.jsx`

**Step 1: Write the failing layout checklist**

Expected outcomes:

- page header uses `PageShell`
- content is grouped into section containers
- tabs and lists look like one product family
- status chips and actions use shared primitives where possible

**Step 2: Refactor `WorkspacePage.jsx` to use `PageShell`**

Move page header and content rhythm into shared layout components.

**Step 3: Refactor workspace tab panels**

Apply `SectionGroup`, shared button styles, and shared status treatment without changing data flow.

**Step 4: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 5: Manual verification**

Verify tab switching, notification rendering, and approval actions still work.

**Step 6: Commit**

```bash
git add frontend/src/pages/WorkspacePage.jsx frontend/src/components/workspace/*.jsx
git commit -m "feat: migrate workspace pages to shared shell"
```

### Task 8: Migrate the primary management list pages

**Files:**
- Modify: `frontend/src/pages/MobileDevicesPage.jsx`
- Modify: `frontend/src/pages/AdminUsersPage.jsx`
- Modify: `frontend/src/pages/BorrowApprovalPage.jsx`
- Inspect: `frontend/src/components/SearchBar.jsx`
- Inspect: `frontend/src/components/ScanTable.jsx`

**Step 1: Write the failing list-page checklist**

Expected outcomes:

- top action, search, and filter bar is consistent
- rows are dense but calmer
- status badges are unified
- row actions are quieter and more predictable

**Step 2: Refactor shared search and table surfaces if reused**

Update `SearchBar.jsx` and `ScanTable.jsx` if they affect multiple pages.

**Step 3: Refactor `MobileDevicesPage.jsx`**

Use the new shell and shared action hierarchy.

**Step 4: Refactor `AdminUsersPage.jsx` and `BorrowApprovalPage.jsx`**

Apply the same list-page system.

**Step 5: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 6: Manual verification**

Verify search, filter, row actions, modal opens, and status labels still work.

**Step 7: Commit**

```bash
git add frontend/src/pages/MobileDevicesPage.jsx frontend/src/pages/AdminUsersPage.jsx frontend/src/pages/BorrowApprovalPage.jsx frontend/src/components/SearchBar.jsx frontend/src/components/ScanTable.jsx
git commit -m "feat: unify management list pages"
```

### Task 9: Migrate the complex configuration pages

**Files:**
- Modify: `frontend/src/pages/LinuxConfigPage.jsx`
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Modify: `frontend/src/components/linux/*.jsx`
- Modify: `frontend/src/components/db-config/*.jsx`

**Step 1: Write the failing operations-page checklist**

Expected outcomes:

- the top context area is calmer and denser
- workflow sections feel grouped instead of card-stacked
- mode switches use segmented controls where appropriate
- progress, status, and result areas use shared feedback patterns

**Step 2: Refactor `LinuxConfigPage.jsx` shell**

Move page header, connection status, and top-level tabs into the shared layout language.

**Step 3: Refactor Linux subcomponents incrementally**

Prioritize:

- `UpgradeTab.jsx`
- `PosControlTab.jsx`
- `BackupTab.jsx`
- `LogTab.jsx`
- `VersionTab.jsx`
- related modals

**Step 4: Refactor `DBConfigPage.jsx` and db-config subcomponents**

Mirror the same operations-page conventions.

**Step 5: Run targeted manual verification**

Verify:

- SSH connect and disconnect flow
- config execution flow
- upload and download progress displays
- DB config actions and result panels

**Step 6: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 7: Commit**

```bash
git add frontend/src/pages/LinuxConfigPage.jsx frontend/src/pages/DBConfigPage.jsx frontend/src/components/linux/*.jsx frontend/src/components/db-config/*.jsx
git commit -m "feat: restyle configuration and operations pages"
```

### Task 10: Migrate the remaining secondary pages

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/HelpPage.jsx`
- Modify: `frontend/src/pages/WarPackageManagePage.jsx`
- Modify: `frontend/src/pages/WarPackageManagePage.css`
- Inspect: remaining standalone page styles under `frontend/src/pages`

**Step 1: Write the failing checklist**

Expected outcomes:

- remaining pages no longer feel visually isolated
- help content follows the same typography and grouping rules
- any legacy CSS page aligns with tokens

**Step 2: Refactor the remaining pages one by one**

Keep changes visual and structural only.

**Step 3: Run the frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 4: Manual verification**

Spot-check all routes reachable from the main navigation.

**Step 5: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx frontend/src/pages/HelpPage.jsx frontend/src/pages/WarPackageManagePage.jsx frontend/src/pages/WarPackageManagePage.css
git commit -m "feat: align remaining pages with the design system"
```

### Task 11: Final consistency pass and regression verification

**Files:**
- Inspect: all modified frontend files
- Update: docs if implementation diverges from the design

**Step 1: Run the full frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS.

**Step 2: Run a manual route sweep**

Verify these routes and views:

- login
- register
- workspace
- devices list
- admin users
- borrow approvals
- linux config
- db config
- profile
- help

Expected: no broken layout, no unreadable text, no inconsistent control styles.

**Step 3: Update docs if needed**

If implementation choices differ from the design doc, append a short `Implementation Notes` section to the design doc.

**Step 4: Commit final polish**

```bash
git add frontend/src docs/plans/2026-03-10-frontend-apple-settings-redesign-design.md docs/plans/2026-03-10-frontend-apple-settings-redesign-implementation-plan.md
git commit -m "chore: finalize frontend redesign consistency pass"
```
