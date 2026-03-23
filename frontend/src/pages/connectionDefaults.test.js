import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultLinuxConnectionForm,
  DEFAULT_DB_USER,
  DEFAULT_LINUX_PASSWORD,
  DEFAULT_LINUX_USER,
} from './connectionDefaults.js';

test('createDefaultLinuxConnectionForm applies requested SSH defaults', () => {
  assert.equal(DEFAULT_LINUX_USER, 'menu');
  assert.equal(DEFAULT_LINUX_PASSWORD, 'M2ei#a$19!');
  assert.deepEqual(createDefaultLinuxConnectionForm('192.168.1.10'), {
    host: '192.168.1.10',
    port: 22,
    user: 'menu',
    password: 'M2ei#a$19!',
  });
});
