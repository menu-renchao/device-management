export const DEFAULT_LINUX_PORT = 22;
export const DEFAULT_LINUX_USER = 'menu';
export const DEFAULT_LINUX_PASSWORD = 'M2ei#a$19!';

export const DEFAULT_DB_TYPE = 'mysql';
export const DEFAULT_DB_PORT = 22108;
export const DEFAULT_DB_NAME = 'kpos';
export const DEFAULT_DB_USER = 'root';
export const DEFAULT_DB_PASSWORD = 'N0mur@4$99!';

export function createDefaultLinuxConnectionForm(host = '') {
  return {
    host: (host || '').trim(),
    port: DEFAULT_LINUX_PORT,
    user: DEFAULT_LINUX_USER,
    password: DEFAULT_LINUX_PASSWORD,
  };
}

export function createDefaultDBConnectionForm(host = '') {
  return {
    db_type: DEFAULT_DB_TYPE,
    host: (host || '').trim(),
    port: DEFAULT_DB_PORT,
    database_name: DEFAULT_DB_NAME,
    username: DEFAULT_DB_USER,
    password: DEFAULT_DB_PASSWORD,
  };
}
