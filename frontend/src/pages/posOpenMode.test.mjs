import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_POS_OPEN_MODE,
  POS_OPEN_MODE_DIRECT,
  POS_OPEN_MODE_PROXY,
  getPOSOpenModeStorageKey,
  readPOSOpenMode,
  resolvePOSOpenTarget,
  writePOSOpenMode,
} from './posOpenMode.mjs';

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

test('getPOSOpenModeStorageKey scopes value by user id', () => {
  assert.equal(getPOSOpenModeStorageKey(12), 'scan_page_pos_open_mode_12');
  assert.equal(getPOSOpenModeStorageKey(), 'scan_page_pos_open_mode_default');
});

test('readPOSOpenMode falls back to direct mode for invalid storage values', () => {
  const storage = createStorage({
    [getPOSOpenModeStorageKey(7)]: 'unexpected',
  });

  assert.equal(readPOSOpenMode(storage, 7), DEFAULT_POS_OPEN_MODE);
});

test('writePOSOpenMode persists normalized mode values', () => {
  const storage = createStorage();

  assert.equal(writePOSOpenMode(storage, 5, POS_OPEN_MODE_PROXY), POS_OPEN_MODE_PROXY);
  assert.equal(readPOSOpenMode(storage, 5), POS_OPEN_MODE_PROXY);
  assert.equal(writePOSOpenMode(storage, 5, 'anything-else'), POS_OPEN_MODE_DIRECT);
  assert.equal(readPOSOpenMode(storage, 5), POS_OPEN_MODE_DIRECT);
});

test('resolvePOSOpenTarget returns the URL that matches the selected mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(resolvePOSOpenTarget(accessInfo, POS_OPEN_MODE_DIRECT), accessInfo.directUrl);
  assert.equal(resolvePOSOpenTarget(accessInfo, POS_OPEN_MODE_PROXY), accessInfo.proxyUrl);
});

test('resolvePOSOpenTarget appends token for proxy mode browser navigation', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(
    resolvePOSOpenTarget(accessInfo, POS_OPEN_MODE_PROXY, 'token-123'),
    '/api/device/M123/pos-proxy/?token=token-123'
  );
});

test('resolvePOSOpenTarget throws when the configured URL is missing', () => {
  assert.throws(
    () => resolvePOSOpenTarget({ proxyUrl: '/api/device/M123/pos-proxy/' }, POS_OPEN_MODE_DIRECT),
    /缺少直连访问地址/
  );
});
