import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPendingDBConnectionForm,
  mergeLoadedDBConnectionForm,
} from './dbConnectionFormState.js';

test('createPendingDBConnectionForm creates form with defaults', () => {
  assert.deepEqual(createPendingDBConnectionForm('192.168.1.10'), {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'shohoku',
  });
});

test('mergeLoadedDBConnectionForm uses connection data when available', () => {
  const currentForm = {
    db_type: 'mysql',
    host: '192.168.1.10',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
  };

  assert.deepEqual(
    mergeLoadedDBConnectionForm(currentForm, {
      db_type: 'mysql',
      host: '192.168.1.20',
      port: 3306,
      database_name: 'merchant_db',
      username: 'merchant_root',
      has_password: true,
    }, '192.168.1.99'),
    {
      db_type: 'mysql',
      host: '192.168.1.20',
      port: 3306,
      database_name: 'merchant_db',
      username: 'merchant_root',
    }
  );
});

test('mergeLoadedDBConnectionForm uses deviceIP when no connection exists', () => {
  const currentForm = {
    db_type: 'mysql',
    host: '',
    port: 22108,
    database_name: 'kpos',
    username: 'root',
  };

  assert.deepEqual(
    mergeLoadedDBConnectionForm(currentForm, null, '192.168.1.10'),
    {
      db_type: 'mysql',
      host: '192.168.1.10',
      port: 22108,
      database_name: 'kpos',
      username: 'root',
    }
  );
});
