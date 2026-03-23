import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getDeviceActionMenuState,
  getDeviceStatusPresentation,
  getDeviceTypeIconPresentation,
} from './scanTableState.js';

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

test('ScanTable exposes a separate menu transfer action', () => {
  const scanTableSource = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'ScanTable.jsx'),
    'utf8'
  );

  assert.match(scanTableSource, /onManageMenuTransfer/);
  assert.match(scanTableSource, /菜单导入\/导出/);
});

test('getDeviceActionMenuState keeps config and backup actions visible but disabled for normal users without permission', () => {
  const state = getDeviceActionMenuState({
    device: {
      merchantId: 'M123',
      type: 'linux',
      owner: { id: 101 },
      occupancy: { userId: 102 },
    },
    currentUserId: 200,
    isAdmin: false,
    hasLicenseBackupHandler: true,
    hasDatabaseBackupHandler: true,
  });

  assert.deepEqual(state.linuxConfig, {
    visible: true,
    disabled: true,
    title: '无权限：仅管理员、负责人或借用人可操作',
  });
  assert.deepEqual(state.dbConfig, {
    visible: true,
    disabled: true,
    title: '无权限：仅管理员、负责人或借用人可操作',
  });
  assert.deepEqual(state.licenseBackup, {
    visible: true,
    disabled: true,
    title: '无权限：仅管理员、负责人或借用人可操作',
  });
  assert.deepEqual(state.databaseBackup, {
    visible: true,
    disabled: true,
    title: '无权限：仅管理员、负责人或借用人可操作',
  });
});

test('getDeviceActionMenuState keeps backup actions visible with missing merchant ID reason', () => {
  const state = getDeviceActionMenuState({
    device: {
      merchantId: '   ',
      type: 'windows',
    },
    currentUserId: 200,
    isAdmin: false,
    hasLicenseBackupHandler: true,
    hasDatabaseBackupHandler: true,
  });

  assert.equal(state.linuxConfig.visible, false);
  assert.deepEqual(state.dbConfig, {
    visible: true,
    disabled: true,
    title: '缺少商家ID，无法操作'
  });
  assert.deepEqual(state.licenseBackup, {
    visible: true,
    disabled: true,
    title: '缺少商家ID，无法操作'
  });
  assert.deepEqual(state.databaseBackup, {
    visible: true,
    disabled: true,
    title: '缺少商家ID，无法操作'
  });
});

test('getDeviceActionMenuState exposes menu transfer action when handler is available', () => {
  const state = getDeviceActionMenuState({
    device: {
      merchantId: 'M123',
      type: 'windows',
    },
    currentUserId: 200,
    isAdmin: true,
    hasMenuTransferHandler: true,
  });

  assert.deepEqual(state.menuTransfer, {
    visible: true,
    disabled: false,
    title: '打开菜单导入与导出弹窗'
  });
});
