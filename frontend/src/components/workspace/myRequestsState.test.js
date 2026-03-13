import test from 'node:test';
import assert from 'node:assert/strict';

import { getRequestDisplayName, splitRequestsByAssetType } from './myRequestsState.js';

test('splitRequestsByAssetType separates POS and mobile requests from unified borrow payloads', () => {
  const result = splitRequestsByAssetType([
    { id: 1, asset_type: 'pos', merchant_id: 'M100', device_name: 'POS-100' },
    { id: 2, asset_type: 'mobile', asset_id: 9, device_name: 'iPad-9' },
  ]);

  assert.equal(result.posRequests.length, 1);
  assert.equal(result.mobileRequests.length, 1);
  assert.equal(result.posRequests[0].id, 1);
  assert.equal(result.mobileRequests[0].id, 2);
});

test('getRequestDisplayName falls back to merchant id for POS requests without a device name', () => {
  assert.equal(
    getRequestDisplayName({ asset_type: 'pos', merchant_id: 'M200', device_name: '' }),
    'M200'
  );
});

test('getRequestDisplayName supports camelCase fields from compatibility payloads', () => {
  assert.equal(
    getRequestDisplayName({ assetType: 'mobile', deviceName: 'iPad-12', device_name: '' }),
    'iPad-12'
  );
});
