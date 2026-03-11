# Device Detail Error State Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make the device detail modal show a clear error state when the details API returns a business error payload instead of leaving users with a blank modal.

**Architecture:** Extract response interpretation into a small utility that converts the raw API payload into one of three UI states: `success`, `error`, or `empty`. Keep the modal responsible only for fetching and rendering, while tests cover the payload parsing logic directly with Node's built-in test runner.

**Tech Stack:** React 18, Axios, Vite, Node `node:test`

---

### Task 1: Add a failing parser test

**Files:**
- Create: `frontend/src/components/detailModalState.js`
- Create: `frontend/src/components/detailModalState.test.js`

**Step 1: Write the failing test**

Add a test that passes this payload into a parser helper:

```js
{
  success: true,
  data: {
    error: 'Failed after max retries'
  }
}
```

Assert the helper returns:

```js
{
  status: 'error',
  message: 'Failed after max retries'
}
```

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/detailModalState.test.js`

Expected: FAIL because the parser helper does not exist yet.

**Step 3: Write minimal implementation**

Create a helper that:
- Returns `error` when `payload.data.error` is a non-empty string
- Returns `success` when `payload.success === true` and there is meaningful detail content
- Returns `empty` otherwise

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/detailModalState.test.js`

Expected: PASS

### Task 2: Use parser result in the detail modal

**Files:**
- Modify: `frontend/src/components/DetailModal.jsx`
- Modify: `frontend/src/components/detailModalState.js`

**Step 1: Write the failing test**

Add a second parser test covering an empty detail payload so the modal can distinguish `empty` from `error`.

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/components/detailModalState.test.js`

Expected: FAIL for the new scenario.

**Step 3: Write minimal implementation**

Update `DetailModal.jsx` to:
- Use the parser helper after the API call
- Store parsed detail data on success
- Show a user-facing error message when the parser returns `error`
- Show a friendly empty-state message when the parser returns `empty`

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/components/detailModalState.test.js`

Expected: PASS

### Task 3: Verify the frontend still builds

**Files:**
- Modify: `frontend/src/components/DetailModal.jsx`
- Test: `frontend/src/components/detailModalState.test.js`

**Step 1: Run focused tests**

Run: `node --test frontend/src/components/detailModalState.test.js`

Expected: PASS

**Step 2: Run build verification**

Run: `npm run build`

Expected: Vite build completes successfully.
