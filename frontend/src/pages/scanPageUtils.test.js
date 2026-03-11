import test from 'node:test';
import assert from 'node:assert/strict';

import * as scanPageUtils from './scanPageUtils.js';

const {
  getAutoScanDisplayMode,
  shouldLoadAutoScanPanel,
  getFilterButtonActiveStyle,
  getMineOnlyToggleActiveStyle
} = scanPageUtils;

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

test('getFilterButtonActiveStyle uses border shorthand instead of borderColor override', () => {
  assert.equal(typeof getFilterButtonActiveStyle, 'function');

  assert.deepEqual(getFilterButtonActiveStyle(), {
    backgroundColor: '#007AFF',
    color: '#fff',
    border: '1px solid #007AFF',
  });
});

test('getMineOnlyToggleActiveStyle uses border shorthand instead of borderColor override', () => {
  assert.equal(typeof getMineOnlyToggleActiveStyle, 'function');

  assert.deepEqual(getMineOnlyToggleActiveStyle(), {
    border: '1px solid #007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    color: '#007AFF',
  });
});
