# POS Open Entries Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Extend the scan page `打开` action so users can open nine fixed POS web entries from the row action area while keeping `打开POS` as the single-click default and preserving existing direct/proxy behavior.

**Architecture:** Keep the Go `pos-access` API unchanged and move all entry selection into frontend state helpers. The scan table becomes a split-button control, while `ScanPage` resolves access info once per click, composes the final URL from the selected entry path plus the current open mode base URL, and navigates the placeholder popup as it does today.

**Tech Stack:** React, node:test, Axios, Vite

---

### Task 1: Add frontend tests for POS entry helpers

**Files:**
- Modify: `frontend/src/pages/posOpenMode.test.mjs`
- Modify: `frontend/package.json`

**Step 1: Write the failing test**

Add tests for:

- `readPOSOpenEntry` falls back to `pos`
- `writePOSOpenEntry` persists normalized values
- `resolvePOSOpenTarget` appends the selected entry path to direct and proxy URLs
- proxy URL composition still appends `token` after the entry path is applied

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because entry helpers and path composition do not exist yet.

**Step 3: Write minimal implementation**

Add entry constants, storage helpers, and URL composition support to `frontend/src/pages/posOpenMode.mjs`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

### Task 2: Wire entry state into ScanPage

**Files:**
- Modify: `frontend/src/pages/ScanPage.jsx`

**Step 1: Write the failing test**

No component-level automated test exists for `ScanPage`, so the red step is covered by Task 1 helper tests. Add the smallest state and handler changes required to consume the new helper API.

**Step 2: Run targeted test baseline**

Run: `npm test`
Expected: PASS before component refactor.

**Step 3: Write minimal implementation**

Update `ScanPage.jsx` to:

- read and store the recent POS entry per user
- expose `handleOpenDevice(device, entryKey = 'pos')`
- persist the clicked non-default entry
- resolve the target URL through the new helper API

**Step 4: Run test to verify it stays green**

Run: `npm test`
Expected: PASS

### Task 3: Replace row open action with split button

**Files:**
- Modify: `frontend/src/components/ScanTable.jsx`

**Step 1: Write the failing test**

No isolated test harness exists for `ScanTable`, so use the helper red/green cycle from Task 1 and then implement the UI refactor in one minimal pass.

**Step 2: Run targeted test baseline**

Run: `npm test`
Expected: PASS before changing row UI.

**Step 3: Write minimal implementation**

Refactor the action cell to:

- render a primary `打开POS` button
- render a chevron button beside it
- show a compact anchored menu with all nine entries
- call `onOpenDevice(device, entryKey)` for both primary and menu actions
- close the menu on click, scroll, or resize as the existing more-actions menu already does

**Step 4: Run tests and build**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

### Task 4: Final verification

**Files:**
- Verify only

**Step 1: Re-run focused verification**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 2: Inspect git diff**

Run: `git diff -- frontend/src/pages/posOpenMode.mjs frontend/src/pages/posOpenMode.test.mjs frontend/src/pages/ScanPage.jsx frontend/src/components/ScanTable.jsx docs/plans/2026-03-21-pos-open-entries-design.md docs/plans/2026-03-21-pos-open-entries-plan.md`

Expected: only POS entry support and documentation changes.
