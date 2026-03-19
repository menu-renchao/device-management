import {
  DEFAULT_DB_NAME,
  DEFAULT_DB_PASSWORD,
  DEFAULT_DB_PORT,
  DEFAULT_DB_TYPE,
  DEFAULT_DB_USER,
} from './connectionDefaults.js';

export function createPendingDBConnectionForm(host = '') {
  return {
    db_type: DEFAULT_DB_TYPE,
    host: (host || '').trim(),
    port: DEFAULT_DB_PORT,
    database_name: DEFAULT_DB_NAME,
    username: DEFAULT_DB_USER,
    password: '',
  };
}

export function mergeLoadedDBConnectionForm(currentForm, connection, deviceIP = '') {
  const nextHost = (deviceIP || currentForm?.host || '').trim();
  const hasDraftPassword = (currentForm?.password || '').trim() !== '';

  if (!connection) {
    return {
      db_type: currentForm?.db_type || DEFAULT_DB_TYPE,
      host: nextHost,
      port: currentForm?.port || DEFAULT_DB_PORT,
      database_name: currentForm?.database_name || DEFAULT_DB_NAME,
      username: currentForm?.username || DEFAULT_DB_USER,
      password: hasDraftPassword ? currentForm.password : DEFAULT_DB_PASSWORD,
    };
  }

  return {
    db_type: connection.db_type || DEFAULT_DB_TYPE,
    host: connection.host || nextHost,
    port: connection.port || DEFAULT_DB_PORT,
    database_name: connection.database_name || DEFAULT_DB_NAME,
    username: connection.username || DEFAULT_DB_USER,
    password: hasDraftPassword ? currentForm.password : '',
  };
}
