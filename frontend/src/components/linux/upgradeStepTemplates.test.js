import test from 'node:test';
import assert from 'node:assert/strict';

import { createUpgradeSteps } from './upgradeStepTemplates.js';

test('createUpgradeSteps returns direct upgrade steps with upload/copy as second step', () => {
  const steps = createUpgradeSteps('direct');

  assert.equal(steps[1].name, '上传/复制 WAR 包');
  assert.equal(steps[1].status, 'pending');
});

test('createUpgradeSteps returns package upgrade steps with copy/upload as second step', () => {
  const steps = createUpgradeSteps('package');

  assert.equal(steps[1].name, '复制/上传 WAR 包');
  assert.equal(steps[1].status, 'pending');
});
