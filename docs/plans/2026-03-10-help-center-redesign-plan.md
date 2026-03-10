# Help Center Redesign Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the help center into a two-level “module tabs + in-module navigation” experience and update the content to cover all current product capabilities.

**Architecture:** Keep the existing `/help` route and implement the redesign inside `frontend/src/pages/HelpPage.jsx`. Replace the old all-in-one long document layout with structured help data, top-level category tabs, module-scoped section navigation, and card-based tutorial content. Verification will rely on a frontend build because this repo does not currently expose focused component tests for the help page.

**Tech Stack:** React, React Router, Vite

---

### Task 1: Capture The Approved Design In Repo Docs

**Files:**
- Create: `docs/plans/2026-03-10-help-center-redesign-design.md`
- Create: `docs/plans/2026-03-10-help-center-redesign-plan.md`

**Step 1: Write the design document**

Document the approved two-level navigation structure, target modules, content strategy, UI goals, and validation approach.

**Step 2: Verify the docs exist**

Run: `Get-ChildItem docs/plans`
Expected: both `2026-03-10-help-center-redesign-design.md` and `2026-03-10-help-center-redesign-plan.md` are listed.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-10-help-center-redesign-design.md docs/plans/2026-03-10-help-center-redesign-plan.md
git commit -m "docs: add help center redesign design and plan"
```

### Task 2: Define A New Help Data Model First

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx`

**Step 1: Write the failing test equivalent through a build checkpoint**

Since there is no existing component test harness for this page, treat the current page contract as the failing checkpoint:
- The page does not support top-level module switching
- The page content is outdated
- The page does not present module-scoped navigation

This task starts by replacing the old `helpContent` data shape with a category-first model that can express:
- module id and title
- module summary
- module highlights
- section ids and titles
- section body blocks for overview, steps, lists, notes, and tables

**Step 2: Verify the old structure is insufficient**

Run: `Get-Content -Raw frontend/src/pages/HelpPage.jsx`
Expected: the file shows the old single-layer content structure and outdated modules.

**Step 3: Write minimal implementation**

Refactor the in-file help content into a richer structure that supports all target modules:
- `quickstart`
- `pos`
- `mobile`
- `linux`
- `database`
- `war`
- `workspace`
- `admin`
- `profile`

Keep the data in one file for now to minimize surface area.

**Step 4: Run build to verify syntax**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/HelpPage.jsx
git commit -m "refactor: reshape help center content model"
```

### Task 3: Implement The Two-Level Navigation Layout

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx`

**Step 1: Write the failing test equivalent**

Define the UI behaviors that currently do not exist:
- top category tab switching
- left nav limited to the active module
- active section reset on module change
- content area limited to active module content

**Step 2: Verify RED via current behavior**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes before changes, but the page still lacks the approved behavior when inspected in code.

**Step 3: Write minimal implementation**

Update `HelpPage.jsx` to:
- add `activeCategory`
- derive `activeModule`
- render top tabs from categories
- render left-side section list from active module only
- render right-side content for active module only
- keep smooth scrolling within the content pane
- reset section state when category changes

**Step 4: Run build to verify GREEN**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/HelpPage.jsx
git commit -m "feat: add two-level help center navigation"
```

### Task 4: Refresh And Expand Help Content

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx`

**Step 1: Write the failing content checklist**

List missing capabilities that must appear after the update:
- POS filters, pagination, mine-only, classification, claim, license backup/import, DB backup/restore
- Mobile card/list view, image upload, owner assignment, borrow/return
- Linux connect, control, upgrade, backup, logs, version
- DB config, SQL templates, risk SQL, result panel, restart POS
- WAR package management
- Workspace tabs
- Admin user operations
- Profile editing and password change

**Step 2: Verify RED in current source**

Run: `Get-Content -Raw frontend/src/pages/HelpPage.jsx`
Expected: the new modules and feature explanations are still missing or incomplete.

**Step 3: Write minimal implementation**

Add and update content blocks so each module includes:
- module summary
- entry guidance
- key capabilities
- common workflows
- caution/permission notes

Use concise, structured Chinese copy tailored to the actual implemented pages.

**Step 4: Run build to verify GREEN**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/HelpPage.jsx
git commit -m "docs: refresh help center content for all modules"
```

### Task 5: Polish The UI For Readability And Responsiveness

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx`

**Step 1: Write the failing UI checklist**

The page should improve on the old design by adding:
- module hero area
- stronger hierarchy
- card-based content
- clearer active states
- narrow-screen fallback layout

**Step 2: Verify RED in current implementation**

Inspect the old style object and note the lack of module tabs, overview cards, and responsive adjustments.

**Step 3: Write minimal implementation**

Update styles in `HelpPage.jsx` to add:
- hero banner and summary chips
- tab-like module switcher
- scoped sidebar navigation
- better spacing, borders, and surfaces
- responsive behavior using `window.innerWidth` or CSS-friendly inline adaptations already used in repo style

Keep the styling consistent with the existing app and avoid adding new CSS files unless necessary.

**Step 4: Run build to verify GREEN**

Run: `npm run build`
Workdir: `frontend`
Expected: build passes.

**Step 5: Commit**

```bash
git add frontend/src/pages/HelpPage.jsx
git commit -m "style: improve help center readability and layout"
```

### Task 6: Final Verification

**Files:**
- Modify: `frontend/src/pages/HelpPage.jsx`

**Step 1: Run final build verification**

Run: `npm run build`
Workdir: `frontend`
Expected: Vite build succeeds with no syntax errors.

**Step 2: Review changed files**

Run: `git diff -- docs/plans/2026-03-10-help-center-redesign-design.md docs/plans/2026-03-10-help-center-redesign-plan.md frontend/src/pages/HelpPage.jsx`
Expected: only the intended redesign and content updates are present.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-10-help-center-redesign-design.md docs/plans/2026-03-10-help-center-redesign-plan.md frontend/src/pages/HelpPage.jsx
git commit -m "feat: redesign help center with updated content"
```

---

Plan complete and saved to `docs/plans/2026-03-10-help-center-redesign-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh session per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints
