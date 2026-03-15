import test from 'node:test';
import assert from 'node:assert/strict';

import { getDeviceStatusPresentation } from './scanTableState.js';

test('getDeviceStatusPresentation returns online status for valid online device', () => {
  assert.deepEqual(
    getDeviceStatusPresentation({
      isOnline: true,
      merchantId: 'M123',
    }),
    {
      text: '在线',
      toneClassName: 'online',
      dotClassName: 'online-indicator',
    }
  );
});

test('getDeviceStatusPresentation returns offline text when device is offline', () => {
  assert.deepEqual(
    getDeviceStatusPresentation(
      {
        isOnline: false,
        merchantId: 'M123',
      },
      '03-15 10:20'
    ),
    {
      text: '离线 03-15 10:20',
      toneClassName: 'offline',
      dotClassName: 'offline-indicator',
    }
  );
});

test('getDeviceStatusPresentation does not return service exception for blank merchant ID', () => {
  assert.deepEqual(
    getDeviceStatusPresentation({
      isOnline: true,
      merchantId: '   ',
    }),
    {
      text: '在线',
      toneClassName: 'online',
      dotClassName: 'online-indicator',
    }
  );
});
