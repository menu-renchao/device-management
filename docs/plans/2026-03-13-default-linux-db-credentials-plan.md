# Default Linux/DB Credentials Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Pre-fill the Linux SSH and MySQL connection forms with the requested default username/password values.

**Architecture:** Add a small shared frontend defaults module that exposes factory helpers for Linux and DB connection forms. Update the two page components to consume those helpers so initialization and fallback behavior stay consistent and testable.

**Tech Stack:** React 18, Vite, plain JavaScript, `node:test`

---

### Task 1: Add failing tests for shared credential defaults

**Files:**
- Create: `frontend/src/pages/connectionDefaults.test.js`
- Test: `frontend/src/pages/connectionDefaults.test.js`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultDBConnectionForm,
  createDefaultLinuxConnectionForm,
  DEFAULT_DB_PASSWORD,
  DEFAULT_DB_USER,
  DEFAULT_LINUX_PASSWORD,
  DEFAULT_LINUX_USER,
} from './connectionDefaults.js';

test('createDefaultLinuxConnectionForm applies requested SSH defaults', () => {
  assert.equal(DEFAULT_LINUX_USER, 'menu');
  assert.equal(DEFAULT_LINUX_PASSWORD, 'M2ei#a$19!');
  assert.deepEqual(createDefaultLinuxConnectionForm('192.168.1.10'), {
    host: '192.168.1.10',
    port: 22,
    user: 'menu',
    password: 'M2ei#a$19!',
  });
});

test('createDefaultDBConnectionForm applies requested MySQL defaults', () => {
  assert.equal(DEFAULT_DB_USER, 'root');
  assert.equal(DEFAULT_DB_PASSWORD, 'N0mur@4$99!');
  assert.deepEqual(createDefaultDBConnectionForm('192.168.1.10'), {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
    password: 'N0mur@4$99!',
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/connectionDefaults.test.js`
Expected: FAIL because `connectionDefaults.js` does not exist yet.

**Step 3: Commit**

```bash
git add frontend/src/pages/connectionDefaults.test.js
git commit -m "test: cover default linux and db credentials"
```

### Task 2: Implement shared default helpers

**Files:**
- Create: `frontend/src/pages/connectionDefaults.js`
- Test: `frontend/src/pages/connectionDefaults.test.js`

**Step 1: Write minimal implementation**

```javascript
export const DEFAULT_LINUX_PORT = 22;
export const DEFAULT_LINUX_USER = 'menu';
export const DEFAULT_LINUX_PASSWORD = 'M2ei#a$19!';

export const DEFAULT_DB_TYPE = 'mysql';
export const DEFAULT_DB_PORT = 22108;
export const DEFAULT_DB_NAME = 'kpos';
export const DEFAULT_DB_USER = 'root';
export const DEFAULT_DB_PASSWORD = 'N0mur@4$99!';

export function createDefaultLinuxConnectionForm(host = '') {
  return {
    host: (host || '').trim(),
    port: DEFAULT_LINUX_PORT,
    user: DEFAULT_LINUX_USER,
    password: DEFAULT_LINUX_PASSWORD,
  };
}

export function createDefaultDBConnectionForm(host = '') {
  return {
    db_type: DEFAULT_DB_TYPE,
    host: (host || '').trim(),
    port: DEFAULT_DB_PORT,
    database_name: DEFAULT_DB_NAME,
    username: DEFAULT_DB_USER,
    password: DEFAULT_DB_PASSWORD,
  };
}
```

**Step 2: Run test to verify it passes**

Run: `node --test frontend/src/pages/connectionDefaults.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/connectionDefaults.js frontend/src/pages/connectionDefaults.test.js
git commit -m "feat: add shared connection defaults"
```

### Task 3: Wire DBConfigPage to shared defaults

**Files:**
- Modify: `frontend/src/pages/DBConfigPage.jsx`
- Test: `frontend/src/pages/connectionDefaults.test.js`

**Step 1: Update imports and initialization**

Use `createDefaultDBConnectionForm` and related constants instead of local duplicate constants.

**Step 2: Preserve saved connection behavior**

When loading a saved DB connection, keep `password: ''` for existing saved passwords, and use `connection.username || DEFAULT_DB_USER` so empty saved usernames still show the requested default.

**Step 3: Run verification**

Run: `node --test frontend/src/pages/connectionDefaults.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/DBConfigPage.jsx frontend/src/pages/connectionDefaults.js frontend/src/pages/connectionDefaults.test.js
git commit -m "feat: prefill default db credentials"
```

### Task 4: Wire LinuxConfigPage to shared defaults

**Files:**
- Modify: `frontend/src/pages/LinuxConfigPage.jsx`
- Test: `frontend/src/pages/connectionDefaults.test.js`

**Step 1: Update imports and initialization**

Use `createDefaultLinuxConnectionForm` so the SSH form starts with host/IP, port, username, and password already filled.

**Step 2: Run verification**

Run: `node --test frontend/src/pages/connectionDefaults.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/LinuxConfigPage.jsx frontend/src/pages/connectionDefaults.js frontend/src/pages/connectionDefaults.test.js
git commit -m "feat: prefill default linux credentials"
```

### Task 5: Run final verification

**Files:**
- Test: `frontend/src/pages/connectionDefaults.test.js`

**Step 1: Run the full targeted verification**

Run: `node --test frontend/src/pages/connectionDefaults.test.js frontend/src/pages/scanPageUtils.test.js frontend/src/services/api.test.js`
Expected: PASS with zero failures

**Step 2: Review diff**

Run: `git diff -- frontend/src/pages/connectionDefaults.js frontend/src/pages/connectionDefaults.test.js frontend/src/pages/DBConfigPage.jsx frontend/src/pages/LinuxConfigPage.jsx docs/plans/2026-03-13-default-linux-db-credentials-design.md docs/plans/2026-03-13-default-linux-db-credentials-plan.md`
Expected: Only the intended frontend defaults and planning docs changed.
