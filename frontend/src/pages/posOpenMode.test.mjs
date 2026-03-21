import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginPOSOpenWindow,
  cleanupPOSOpenWindow,
  DEFAULT_POS_OPEN_ENTRY,
  DEFAULT_POS_OPEN_MODE,
  POS_OPEN_ENTRIES,
  POS_OPEN_MODE_DIRECT,
  POS_OPEN_MODE_PROXY,
  getPOSOpenEntryStorageKey,
  getPOSOpenModeStorageKey,
  getPOSSecondaryOpenEntries,
  navigatePOSOpenWindow,
  readPOSOpenEntry,
  readPOSOpenMode,
  resolvePOSOpenTarget,
  resolvePOSOpenTargetForEntry,
  writePOSOpenEntry,
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

test('getPOSOpenEntryStorageKey scopes value by user id', () => {
  assert.equal(getPOSOpenEntryStorageKey(12), 'scan_page_pos_open_entry_12');
  assert.equal(getPOSOpenEntryStorageKey(), 'scan_page_pos_open_entry_default');
});

test('readPOSOpenMode falls back to direct mode for invalid storage values', () => {
  const storage = createStorage({
    [getPOSOpenModeStorageKey(7)]: 'unexpected',
  });

  assert.equal(readPOSOpenMode(storage, 7), DEFAULT_POS_OPEN_MODE);
});

test('readPOSOpenEntry falls back to POS for invalid storage values', () => {
  const storage = createStorage({
    [getPOSOpenEntryStorageKey(7)]: 'unexpected',
  });

  assert.equal(readPOSOpenEntry(storage, 7), DEFAULT_POS_OPEN_ENTRY);
});

test('writePOSOpenMode persists normalized mode values', () => {
  const storage = createStorage();

  assert.equal(writePOSOpenMode(storage, 5, POS_OPEN_MODE_PROXY), POS_OPEN_MODE_PROXY);
  assert.equal(readPOSOpenMode(storage, 5), POS_OPEN_MODE_PROXY);
  assert.equal(writePOSOpenMode(storage, 5, 'anything-else'), POS_OPEN_MODE_DIRECT);
  assert.equal(readPOSOpenMode(storage, 5), POS_OPEN_MODE_DIRECT);
});

test('writePOSOpenEntry persists normalized entry values', () => {
  const storage = createStorage();

  assert.equal(writePOSOpenEntry(storage, 5, 'kds'), 'kds');
  assert.equal(readPOSOpenEntry(storage, 5), 'kds');
  assert.equal(writePOSOpenEntry(storage, 5, 'anything-else'), DEFAULT_POS_OPEN_ENTRY);
  assert.equal(readPOSOpenEntry(storage, 5), DEFAULT_POS_OPEN_ENTRY);
});

test('POS_OPEN_ENTRIES exposes the fixed nine supported entry keys', () => {
  assert.deepEqual(
    POS_OPEN_ENTRIES.map((entry) => entry.key),
    ['pos', 'emenu', 'kiosk', 'kds', 'rds', 'cds', 'waitlist', 'paging', 'kdsconfig']
  );
});

test('getPOSSecondaryOpenEntries excludes the default POS entry from the menu', () => {
  assert.deepEqual(
    getPOSSecondaryOpenEntries().map((entry) => entry.key),
    ['emenu', 'kiosk', 'kds', 'rds', 'cds', 'waitlist', 'paging', 'kdsconfig']
  );
});

test('resolvePOSOpenTarget returns the base URL that matches the selected mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(resolvePOSOpenTarget(accessInfo, POS_OPEN_MODE_DIRECT), accessInfo.directUrl);
  assert.equal(resolvePOSOpenTarget(accessInfo, POS_OPEN_MODE_PROXY), accessInfo.proxyUrl);
});

test('resolvePOSOpenTargetForEntry appends the POS entry path for direct mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(
    resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_DIRECT, 'pos'),
    'http://192.168.1.88:22080/kpos/front2/myhome.html'
  );
});

test('resolvePOSOpenTargetForEntry appends the selected non-POS entry path for direct mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(
    resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_DIRECT, 'kds'),
    'http://192.168.1.88:22080/kpos/kitchen/#/tab/kitchen'
  );
});

test('resolvePOSOpenTargetForEntry appends entry path and explicit token for proxy mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(
    resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_PROXY, 'kdsconfig', 'test-token'),
    '/api/device/M123/pos-proxy/kpos/kitchen/?token=test-token#/tab/config'
  );
});

test('resolvePOSOpenTargetForEntry appends explicit token for proxy mode before hash fragments', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: 'http://m123.pos.example.com:5000/',
  };

  assert.equal(
    resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_PROXY, 'kdsconfig', 'abc123'),
    'http://m123.pos.example.com:5000/kpos/kitchen/?token=abc123#/tab/config'
  );
});

test('resolvePOSOpenTargetForEntry requires an explicit token for proxy mode', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: 'http://m123.pos.example.com:5000/',
  };

  assert.throws(
    () => resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_PROXY, 'pos', ''),
    /token/i
  );
});

test('beginPOSOpenWindow opens a blank page immediately for later navigation', () => {
  let callArgs = null;
  const popup = { opener: 'parent-window' };

  const result = beginPOSOpenWindow((url, target) => {
    callArgs = [url, target];
    return popup;
  });

  assert.equal(result, popup);
  assert.deepEqual(callArgs, ['', '_blank']);
  assert.equal(popup.opener, null);
});

test('navigatePOSOpenWindow prefers replace when the popup supports it', () => {
  const replaceCalls = [];
  const popup = {
    location: {
      href: '',
      replace(url) {
        replaceCalls.push(url);
      },
    },
  };

  assert.equal(navigatePOSOpenWindow(popup, 'http://192.168.1.88:22080/'), true);
  assert.deepEqual(replaceCalls, ['http://192.168.1.88:22080/']);
});

test('cleanupPOSOpenWindow closes an opened placeholder popup', () => {
  let closeCalls = 0;
  const popup = {
    closed: false,
    close() {
      closeCalls += 1;
      this.closed = true;
    },
  };

  cleanupPOSOpenWindow(popup);

  assert.equal(closeCalls, 1);
  assert.equal(popup.closed, true);
});

test('resolvePOSOpenTarget throws when the configured URL is missing', () => {
  assert.throws(
    () => resolvePOSOpenTarget({ proxyUrl: '/api/device/M123/pos-proxy/' }, POS_OPEN_MODE_DIRECT),
    /访问地址/
  );
});

test('resolvePOSOpenTargetForEntry falls back to POS when the entry key is invalid', () => {
  const accessInfo = {
    directUrl: 'http://192.168.1.88:22080/',
    proxyUrl: '/api/device/M123/pos-proxy/',
  };

  assert.equal(
    resolvePOSOpenTargetForEntry(accessInfo, POS_OPEN_MODE_DIRECT, 'unknown-entry'),
    'http://192.168.1.88:22080/kpos/front2/myhome.html'
  );
});
