import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDBConnectionPayload } from './dbConnectionRequestState.js';

test('buildDBConnectionPayload marks saved password usage explicitly when password is blank', () => {
  assert.deepEqual(
    buildDBConnectionPayload({
      form: {
        db_type: 'mysql',
        host: '192.168.0.147',
        port: 22108,
        database_name: 'kpos',
        username: 'root',
        password: '',
      },
      deviceIP: '192.168.0.147',
      hasSavedPassword: true,
    }),
    {
      db_type: 'mysql',
      host: '192.168.0.147',
      port: 22108,
      database_name: 'kpos',
      username: 'root',
      password: '',
      use_saved_password: true,
    }
  );
});

test('buildDBConnectionPayload sends a typed password and disables saved-password fallback', () => {
  assert.deepEqual(
    buildDBConnectionPayload({
      form: {
        db_type: 'mysql',
        host: '192.168.0.147',
        port: 22108,
        database_name: 'kpos',
        username: 'root',
        password: 'new-secret ',
      },
      deviceIP: '192.168.0.147',
      hasSavedPassword: true,
    }),
    {
      db_type: 'mysql',
      host: '192.168.0.147',
      port: 22108,
      database_name: 'kpos',
      username: 'root',
      password: 'new-secret',
      use_saved_password: false,
    }
  );
});
