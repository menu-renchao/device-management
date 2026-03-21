import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canExecuteUpgrade,
  canProceedToUpgradeStep,
  getEnabledConfigIds,
  getNextSelectedConfigIds,
  getNextSelectedConfigIdsAfterDelete,
  resolveUpgradeWarPath,
} from './upgradeTabState.js';

test('getNextSelectedConfigIds adds checked config ids and removes unchecked ids without duplicates', () => {
  assert.deepEqual(getNextSelectedConfigIds([1], 2, true), [1, 2]);
  assert.deepEqual(getNextSelectedConfigIds([1, 2], 1, false), [2]);
  assert.deepEqual(getNextSelectedConfigIds([1], 1, true), [1]);
});

test('getNextSelectedConfigIdsAfterDelete removes the deleted config id', () => {
  assert.deepEqual(getNextSelectedConfigIdsAfterDelete([1, 2, 3], 2), [1, 3]);
});

test('getEnabledConfigIds returns only enabled config ids', () => {
  assert.deepEqual(
    getEnabledConfigIds([
      { id: 1, enabled: true },
      { id: 2, enabled: false },
      { id: 3, enabled: true },
    ]),
    [1, 3]
  );
});

test('canProceedToUpgradeStep depends on mode-specific required selections', () => {
  assert.equal(canProceedToUpgradeStep({ selectMode: 'local', file: { name: 'kpos.war' } }), true);
  assert.equal(canProceedToUpgradeStep({ selectMode: 'local', file: null }), false);
  assert.equal(canProceedToUpgradeStep({ selectMode: 'history', selectedHistoryPackage: 'pkg-a' }), true);
  assert.equal(canProceedToUpgradeStep({ selectMode: 'download', downloadProgress: { status: 'completed' } }), true);
  assert.equal(canProceedToUpgradeStep({ selectMode: 'download', selectedHistoryPackage: 'pkg-a' }), true);
  assert.equal(canProceedToUpgradeStep({ selectMode: 'download', downloadProgress: { status: 'running' } }), false);
});

test('canExecuteUpgrade requires selected package for package mode only', () => {
  assert.equal(
    canExecuteUpgrade({
      upgradeMode: 'direct',
      selectMode: 'history',
      selectedHistoryPackage: 'pkg-a',
    }),
    true
  );

  assert.equal(
    canExecuteUpgrade({
      upgradeMode: 'package',
      selectMode: 'history',
      selectedHistoryPackage: 'pkg-a',
      selectedPackage: null,
    }),
    false
  );

  assert.equal(
    canExecuteUpgrade({
      upgradeMode: 'package',
      selectMode: 'history',
      selectedHistoryPackage: 'pkg-a',
      selectedPackage: 'menu-upgrade',
    }),
    true
  );
});

test('resolveUpgradeWarPath resolves local direct and package modes', () => {
  assert.deepEqual(
    resolveUpgradeWarPath({
      selectMode: 'local',
      upgradeMode: 'direct',
      file: { name: 'kpos.war' },
      selectedPackage: 'menu-upgrade',
      selectedHistoryPackage: null,
      historyPackages: [],
    }),
    { warPath: '/opt/tomcat7/webapps/kpos.war' }
  );

  assert.deepEqual(
    resolveUpgradeWarPath({
      selectMode: 'local',
      upgradeMode: 'package',
      file: { name: 'kpos.war' },
      selectedPackage: 'menu-upgrade',
      selectedHistoryPackage: null,
      historyPackages: [],
    }),
    { warPath: '/home/menu/menu-upgrade/kpos.war' }
  );
});

test('resolveUpgradeWarPath resolves history packages and surfaces clear errors', () => {
  assert.deepEqual(
    resolveUpgradeWarPath({
      selectMode: 'history',
      upgradeMode: 'direct',
      file: null,
      selectedPackage: null,
      selectedHistoryPackage: '20260321',
      historyPackages: [{ name: '20260321', file_name: 'kpos.war' }],
    }),
    { warPath: 'downloads/20260321/kpos.war' }
  );

  assert.deepEqual(
    resolveUpgradeWarPath({
      selectMode: 'history',
      upgradeMode: 'direct',
      file: null,
      selectedPackage: null,
      selectedHistoryPackage: '20260321',
      historyPackages: [],
    }),
    { error: '无法获取包文件信息，请重新选择历史包' }
  );

  assert.deepEqual(
    resolveUpgradeWarPath({
      selectMode: 'download',
      upgradeMode: 'direct',
      file: null,
      selectedPackage: null,
      selectedHistoryPackage: null,
      historyPackages: [],
    }),
    { error: '请先选择 WAR 包' }
  );
});
