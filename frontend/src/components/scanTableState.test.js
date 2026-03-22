import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { getDeviceStatusPresentation, getDeviceTypeIconPresentation } from './scanTableState.js';

test('getDeviceTypeIconPresentation maps linux and windows to fixed svg assets', () => {
  assert.deepEqual(getDeviceTypeIconPresentation('linux'), {
    src: '/linux.svg',
    alt: 'Linux',
    fallback: '🐧',
  });

  assert.deepEqual(getDeviceTypeIconPresentation('Windows 10'), {
    src: '/windows.svg',
    alt: 'Windows',
    fallback: '🪟',
  });
});

test('getDeviceTypeIconPresentation keeps fallback icon for unsupported device types', () => {
  assert.deepEqual(getDeviceTypeIconPresentation('android'), {
    src: '',
    alt: 'Device',
    fallback: '🖥',
  });
});

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

test('ScanTable renders linux and windows device icons with fixed svg images', () => {
  const scanTableSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ScanTable.jsx'),
    'utf8'
  );

  assert.match(scanTableSource, /src=\{deviceTypeIcon\.src\}/);
  assert.match(scanTableSource, /deviceTypeIcon\.src \? \(/);
  assert.match(scanTableSource, /className="ip-type-icon-image"/);
});
