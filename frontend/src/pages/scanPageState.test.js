import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatLastScanTime,
  getOnlyMyDevicesStorageKey,
  getPurposeText,
  getScanConfirmConfig,
  toggleMultiValueFilter,
} from './scanPageState.js';

test('getOnlyMyDevicesStorageKey scopes the toggle by user id', () => {
  assert.equal(getOnlyMyDevicesStorageKey(12), 'scan_page_only_my_devices_12');
  assert.equal(getOnlyMyDevicesStorageKey(), 'scan_page_only_my_devices_default');
});

test('toggleMultiValueFilter adds checked values and removes unchecked values', () => {
  assert.deepEqual(toggleMultiValueFilter(['linux'], 'windows', true), ['linux', 'windows']);
  assert.deepEqual(toggleMultiValueFilter(['linux', 'windows'], 'linux', false), ['windows']);
});

test('toggleMultiValueFilter avoids duplicate values when checked repeatedly', () => {
  assert.deepEqual(toggleMultiValueFilter(['linux'], 'linux', true), ['linux']);
});

test('formatLastScanTime returns relative values for recent timestamps', () => {
  const now = new Date('2026-03-21T20:00:00+08:00');

  assert.equal(formatLastScanTime('2026-03-21T19:59:45+08:00', now), '刚刚');
  assert.equal(formatLastScanTime('2026-03-21T19:40:00+08:00', now), '20分钟前');
  assert.equal(formatLastScanTime('2026-03-21T17:00:00+08:00', now), '3小时前');
});

test('formatLastScanTime returns locale date for older timestamps and empty string for invalid values', () => {
  const now = new Date('2026-03-21T20:00:00+08:00');

  assert.equal(formatLastScanTime('2026-03-19T10:00:00+08:00', now), '2026/3/19');
  assert.equal(formatLastScanTime('', now), '');
  assert.equal(formatLastScanTime('not-a-date', now), '');
});

test('getPurposeText normalizes strings, object wrappers, and primitive values', () => {
  assert.equal(getPurposeText('  test  '), 'test');
  assert.equal(getPurposeText({ String: '  borrow  ' }), 'borrow');
  assert.equal(getPurposeText({ value: '  debug  ' }), 'debug');
  assert.equal(getPurposeText(123), '123');
  assert.equal(getPurposeText(null), '');
});

test('getScanConfirmConfig returns action-specific title, message, and confirm text', () => {
  assert.deepEqual(
    getScanConfirmConfig('delete', { name: 'POS-A' }),
    {
      title: '确认删除',
      message: '确定要删除设备 POS-A 吗？此操作不可恢复。',
      confirmText: '删除',
    }
  );

  assert.deepEqual(
    getScanConfirmConfig('claim', { merchantId: 'M100' }),
    {
      title: '确认认领',
      message: '确定要认领设备 M100 吗？认领申请将提交给管理员审核。',
      confirmText: '认领',
    }
  );
});

test('getScanConfirmConfig falls back to a generic config for unknown actions', () => {
  assert.deepEqual(getScanConfirmConfig('unknown', {}), {
    title: '确认',
    message: '',
    confirmText: '确定',
  });
});
