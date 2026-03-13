import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_WORKSPACE_TAB, getWorkspaceTab } from './workspacePageState.js';

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
