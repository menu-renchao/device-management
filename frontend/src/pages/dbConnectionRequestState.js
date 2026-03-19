import {
  DEFAULT_DB_NAME,
  DEFAULT_DB_PORT,
  DEFAULT_DB_TYPE,
} from './connectionDefaults.js';

export function buildDBConnectionPayload({ form, deviceIP = '', hasSavedPassword = false }) {
  const password = (form?.password || '').trim();

  return {
    db_type: form?.db_type || DEFAULT_DB_TYPE,
    host: (deviceIP || form?.host || '').trim(),
    port: Number(form?.port) > 0 ? Number(form.port) : DEFAULT_DB_PORT,
    database_name: (form?.database_name || '').trim() || DEFAULT_DB_NAME,
    username: (form?.username || '').trim(),
    password,
    use_saved_password: password === '' && Boolean(hasSavedPassword),
  };
}
