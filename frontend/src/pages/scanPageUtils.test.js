import test from 'node:test';
import assert from 'node:assert/strict';

import { getAutoScanDisplayMode, shouldLoadAutoScanPanel } from './scanPageUtils.js';

test('shouldLoadAutoScanPanel returns false when admin checker is missing', () => {
  assert.equal(shouldLoadAutoScanPanel(), false);
});

test('shouldLoadAutoScanPanel returns false for non-admin users', () => {
  assert.equal(shouldLoadAutoScanPanel(() => false), false);
});

test('shouldLoadAutoScanPanel returns true for admin users', () => {
  assert.equal(shouldLoadAutoScanPanel(() => true), true);
});

test('getAutoScanDisplayMode hides everything for non-admin users', () => {
  assert.equal(getAutoScanDisplayMode(() => false, false), 'hidden');
});

test('getAutoScanDisplayMode returns button mode by default for admins', () => {
  assert.equal(getAutoScanDisplayMode(() => true, false), 'button');
});

test('getAutoScanDisplayMode returns dialog mode when admin opens config', () => {
  assert.equal(getAutoScanDisplayMode(() => true, true), 'dialog');
});
