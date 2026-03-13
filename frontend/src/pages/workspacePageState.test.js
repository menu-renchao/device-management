import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_WORKSPACE_TAB,
  getAvailableWorkspaceTabs,
  getWorkspaceTab,
} from './workspacePageState.js';

test('getWorkspaceTab defaults to approvals when tab is missing', () => {
  assert.equal(DEFAULT_WORKSPACE_TAB, 'approvals');
  assert.equal(getWorkspaceTab(null), 'approvals');
  assert.equal(getWorkspaceTab(''), 'approvals');
});

test('getWorkspaceTab falls back to approvals for unsupported tabs', () => {
  assert.equal(getWorkspaceTab('unknown'), 'approvals');
});

test('getWorkspaceTab preserves supported tabs', () => {
  assert.equal(getWorkspaceTab('approvals'), 'approvals');
  assert.equal(getWorkspaceTab('requests'), 'requests');
});

test('getAvailableWorkspaceTabs hides requests for admins', () => {
  assert.deepEqual(getAvailableWorkspaceTabs(false), [
    'approvals',
    'requests',
    'borrows',
    'devices',
    'notifications',
  ]);
  assert.deepEqual(getAvailableWorkspaceTabs(true), [
    'approvals',
    'borrows',
    'devices',
    'notifications',
  ]);
});

test('getWorkspaceTab redirects admin requests tab to approvals', () => {
  assert.equal(getWorkspaceTab('requests', { isAdmin: true }), 'approvals');
  assert.equal(getWorkspaceTab('borrows', { isAdmin: true }), 'borrows');
});
