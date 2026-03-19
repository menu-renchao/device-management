import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultDBConnectionForm,
  createDefaultLinuxConnectionForm,
  DEFAULT_DB_PASSWORD,
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

test('createDefaultDBConnectionForm applies requested MySQL defaults', () => {
  assert.equal(DEFAULT_DB_USER, 'shohoku');
  assert.equal(DEFAULT_DB_PASSWORD, 'N0mur@4$99!');
  assert.deepEqual(createDefaultDBConnectionForm('192.168.1.10'), {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'shohoku',
    password: 'N0mur@4$99!',
  });
});
