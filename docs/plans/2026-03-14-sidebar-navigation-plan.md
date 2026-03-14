# Sidebar Navigation Shell Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace the global top navigation with a shared sidebar shell that is fixed on desktop and drawer-based on mobile, without changing existing protected routes.

**Architecture:** Extract navigation concerns out of `frontend/src/App.jsx` into a small navigation module with config and pure route-matching helpers, then render that model through a reusable `AppShell` component. Keep login/register outside the shell, keep page-level tabs such as `WorkspacePage` internal, and use CSS media queries for desktop/mobile behavior rather than route duplication.

**Tech Stack:** React 18, React Router, Vite, CSS, Vitest + jsdom + Testing Library for new frontend tests

---

### Task 1: Add a runnable frontend test harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/test/setup.js`

**Step 1: Write the failing test setup expectation**

Add a placeholder navigation-state test file import path in a new task-local note and reference `npm test -- --run` as the command we expect to fail before setup exists.

```js
// Expected future test import
import { describe, expect, it } from 'vitest';
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run`
Expected: command fails because `test` script is missing.

**Step 3: Write minimal test infrastructure**

Update `frontend/package.json` scripts and dev dependencies:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "...",
    "@testing-library/react": "...",
    "@vitejs/plugin-react": "^4.0.3",
    "jsdom": "...",
    "vite": "^4.4.5",
    "vitest": "..."
  }
}
```

Extend `frontend/vite.config.js` with:

```js
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.js'
}
```

Create `frontend/src/test/setup.js`:

```js
import '@testing-library/jest-dom';
```

**Step 4: Run test to verify the runner starts**

Run: `npm test -- --run`
Expected: Vitest starts and reports no tests or only missing future test files.

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/test/setup.js
git commit -m "test: add frontend vitest harness"
```

### Task 2: Define navigation config and route-matching helpers

**Files:**
- Create: `frontend/src/components/navigation/navigationConfig.js`
- Create: `frontend/src/components/navigation/navigationState.js`
- Create: `frontend/src/components/navigation/navigationState.test.js`

**Step 1: Write the failing test**

Create `frontend/src/components/navigation/navigationState.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { getActiveNavKey, getPageTitle } from './navigationState';

describe('navigationState', () => {
  it('maps detail routes back to pos navigation', () => {
    expect(getActiveNavKey('/linux-config/123')).toBe('scan');
    expect(getActiveNavKey('/db-config/123')).toBe('scan');
  });

  it('maps profile to account title', () => {
    expect(getActiveNavKey('/profile')).toBe('profile');
    expect(getPageTitle('/profile')).toBe('个人中心');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/components/navigation/navigationState.test.js`
Expected: FAIL because the module does not exist.

**Step 3: Write minimal implementation**

Create `navigationConfig.js` with the shared navigation model:

```js
export const primaryNavItems = [
  { key: 'scan', label: 'POS设备', to: '/' },
  { key: 'mobile', label: '移动设备', to: '/mobile' },
  { key: 'warPackages', label: 'WAR包管理', to: '/war-packages' },
  { key: 'workspace', label: '工作台', to: '/workspace' },
  { key: 'featureRequests', label: '意见收集', to: '/feature-requests' },
  { key: 'help', label: '帮助中心', to: '/help' }
];
```

Create `navigationState.js`:

```js
export function getActiveNavKey(pathname) {
  if (pathname.startsWith('/mobile')) return 'mobile';
  if (pathname.startsWith('/war-packages')) return 'warPackages';
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/feature-requests')) return 'featureRequests';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/admin/users')) return 'adminUsers';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/linux-config') || pathname.startsWith('/db-config')) return 'scan';
  return 'scan';
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run frontend/src/components/navigation/navigationState.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/navigation/navigationConfig.js frontend/src/components/navigation/navigationState.js frontend/src/components/navigation/navigationState.test.js
git commit -m "test: cover navigation route mapping"
```

### Task 3: Build the reusable app shell component

**Files:**
- Create: `frontend/src/components/navigation/AppShell.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/NotificationBell.jsx`

**Step 1: Write the failing component test**

Create `frontend/src/components/navigation/AppShell.test.jsx`:

```jsx
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'demo' },
    logout: vi.fn(),
    isAdmin: () => false
  })
}));

describe('AppShell', () => {
  it('renders sidebar navigation and current page title', () => {
    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppShell><div>content</div></AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('工作台')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/components/navigation/AppShell.test.jsx`
Expected: FAIL because `AppShell` does not exist.

**Step 3: Write minimal implementation**

Create `AppShell.jsx` with:

```jsx
export default function AppShell({ children }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeKey = getActiveNavKey(location.pathname);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">...</aside>
      <div className="app-shell-main">
        <header className="app-mobile-header">...</header>
        <main className="app-main">{children}</main>
      </div>
      {mobileOpen ? <button className="app-drawer-backdrop" /> : null}
    </div>
  );
}
```

Refactor `frontend/src/App.jsx` so protected routes render:

```jsx
<PrivateRoute>
  <AppShell>
    <ScanPage />
  </AppShell>
</PrivateRoute>
```

Adjust `NotificationBell.jsx` only if it assumes top-nav-only sizing or positioning.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run frontend/src/components/navigation/AppShell.test.jsx frontend/src/components/navigation/navigationState.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/navigation/AppShell.jsx frontend/src/components/navigation/AppShell.test.jsx frontend/src/components/NotificationBell.jsx
git commit -m "feat: add shared sidebar app shell"
```

### Task 4: Add desktop and mobile shell styling

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Write the failing style-oriented smoke test**

Extend `frontend/src/components/navigation/AppShell.test.jsx` to assert shell class names exist:

```jsx
expect(document.querySelector('.app-sidebar')).not.toBeNull();
expect(document.querySelector('.app-mobile-header')).not.toBeNull();
```

**Step 2: Run test to verify current rendering is incomplete**

Run: `npm test -- --run frontend/src/components/navigation/AppShell.test.jsx`
Expected: FAIL until the final shell structure is present.

**Step 3: Write minimal styles**

Add shell styles to `frontend/src/App.css`:

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    position: fixed;
    transform: translateX(-100%);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }
}
```

**Step 4: Run tests and build**

Run: `npm test -- --run frontend/src/components/navigation/AppShell.test.jsx`
Expected: PASS

Run: `npm run build`
Expected: Vite build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/App.css
git commit -m "style: add responsive sidebar shell styles"
```

### Task 5: Preserve page-level navigation and tighten responsive behavior

**Files:**
- Modify: `frontend/src/pages/WorkspacePage.jsx`
- Modify: `frontend/src/pages/ScanPage.jsx`

**Step 1: Write the failing regression test**

Add or extend a pure helper test around existing workspace state if needed so the page-level tab selection remains URL-driven:

```js
expect(getWorkspaceTab('approvals', { isAdmin: true })).toBe('approvals');
```

If an existing test already covers this behavior, skip creating a duplicate and document that reuse in the commit message.

**Step 2: Run targeted tests**

Run: `npm test -- --run frontend/src/pages/workspacePageState.test.js`
Expected: PASS before layout changes.

**Step 3: Write minimal implementation**

Keep `WorkspacePage` tabs internal and make only layout-safe changes:

```jsx
<div style={{ ...styles.tabsContainer, overflowX: 'auto', maxWidth: '100%' }}>
```

Apply only small wrapping or spacing fixes in `ScanPage.jsx` if the new shell narrows the main content area on tablet widths.

**Step 4: Run tests and build**

Run: `npm test -- --run frontend/src/pages/workspacePageState.test.js frontend/src/components/navigation/navigationState.test.js`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/WorkspacePage.jsx frontend/src/pages/ScanPage.jsx
git commit -m "fix: preserve page-level navigation inside sidebar shell"
```

### Task 6: Verify the shell manually and document acceptance

**Files:**
- Modify: `docs/plans/2026-03-14-sidebar-navigation-design.md`

**Step 1: Run the app locally**

Run: `npm run dev`
Expected: Vite dev server starts successfully.

**Step 2: Verify desktop flows**

Check:

```text
1. '/' shows fixed sidebar and highlights POS设备
2. '/workspace' highlights 工作台 while page tabs still work
3. '/profile' highlights 个人中心
4. admin account reveals 管理中心; non-admin does not
```

**Step 3: Verify mobile flows**

Check in responsive mode:

```text
1. menu button opens drawer
2. backdrop closes drawer
3. choosing a nav item closes drawer
4. notification and logout remain reachable
```

**Step 4: Run final verification**

Run: `npm test -- --run`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-14-sidebar-navigation-design.md
git commit -m "docs: record sidebar navigation verification"
```
