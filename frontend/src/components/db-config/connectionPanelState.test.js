import test from 'node:test';
import assert from 'node:assert/strict';

import { getDBPasswordPlaceholder } from './connectionPanelState.js';

test('getDBPasswordPlaceholder returns saved-password text when a saved password exists', () => {
  assert.equal(getDBPasswordPlaceholder(true), '已保存密码');
});

test('getDBPasswordPlaceholder returns input hint when there is no saved password or a new password is being typed', () => {
  assert.equal(getDBPasswordPlaceholder(false), '请输入数据库密码');
  assert.equal(getDBPasswordPlaceholder(true, 'new-secret'), '请输入数据库密码');
});
