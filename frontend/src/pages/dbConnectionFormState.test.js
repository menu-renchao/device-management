import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPendingDBConnectionForm,
  mergeLoadedDBConnectionForm,
} from './dbConnectionFormState.js';

test('createPendingDBConnectionForm leaves password empty while saved connection is loading', () => {
  assert.deepEqual(createPendingDBConnectionForm('192.168.1.10'), {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
    password: '',
  });
});

test('mergeLoadedDBConnectionForm keeps a user-entered password when a saved connection is returned', () => {
  const currentForm = {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
    password: 'new-secret',
  };

  assert.deepEqual(
    mergeLoadedDBConnectionForm(currentForm, {
      db_type: 'mysql',
      host: '192.168.1.20',
      port: 3306,
      database_name: 'merchant_db',
      username: 'merchant_root',
      password_set: true,
    }, '192.168.1.99'),
    {
      db_type: 'mysql',
      host: '192.168.1.20',
      port: 3306,
      database_name: 'merchant_db',
      username: 'merchant_root',
      password: 'new-secret',
    }
  );
});

test('mergeLoadedDBConnectionForm falls back to the default password only when no saved connection exists', () => {
  const currentForm = {
    db_type: 'mysql',
    host: '',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
    password: '',
  };

  assert.deepEqual(
    mergeLoadedDBConnectionForm(currentForm, null, '192.168.1.10'),
    {
      db_type: 'mysql',
      host: '192.168.1.10',
      port: 22108,
      database_name: 'kpos',
      username: 'root',
      password: 'N0mur@4$99!',
    }
  );
});
