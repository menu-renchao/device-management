export const POS_OPEN_MODE_DIRECT = 'direct';
export const POS_OPEN_MODE_PROXY = 'proxy';
export const DEFAULT_POS_OPEN_MODE = POS_OPEN_MODE_DIRECT;

export const DEFAULT_POS_OPEN_ENTRY = 'pos';

export const POS_OPEN_ENTRIES = [
  { key: 'pos', label: 'POS', path: 'kpos/front2/myhome.html', description: 'Default' },
  { key: 'emenu', label: 'EMENU', path: 'kpos/emenu/#/', description: 'Self ordering' },
  { key: 'kiosk', label: 'KIOSK', path: 'kpos/kiosklite#/', description: 'Kiosk' },
  { key: 'kds', label: 'KDS', path: 'kpos/kitchen/#/tab/kitchen', description: 'Kitchen' },
  { key: 'rds', label: 'RDS', path: 'kpos/kitchen/#/tab/runner/', description: 'Runner' },
  { key: 'cds', label: 'CDS', path: 'kpos/dual/new/', description: 'Customer display' },
  { key: 'waitlist', label: 'WAITLIST', path: 'kpos/waitlist/#/', description: 'Waitlist' },
  { key: 'paging', label: 'PAGING', path: 'kpos/call', description: 'Paging' },
  { key: 'kdsconfig', label: 'KDS CONFIG', path: 'kpos/kitchen/#/tab/config', description: 'Kitchen config' },
];

const POS_OPEN_ENTRY_MAP = new Map(POS_OPEN_ENTRIES.map((entry) => [entry.key, entry]));

export function getPOSOpenModeStorageKey(userId) {
  return `scan_page_pos_open_mode_${userId || 'default'}`;
}

export function getPOSOpenEntryStorageKey(userId) {
  return `scan_page_pos_open_entry_${userId || 'default'}`;
}

export function normalizePOSOpenMode(mode) {
  return mode === POS_OPEN_MODE_PROXY ? POS_OPEN_MODE_PROXY : DEFAULT_POS_OPEN_MODE;
}

export function normalizePOSOpenEntry(entryKey) {
  return POS_OPEN_ENTRY_MAP.has(entryKey) ? entryKey : DEFAULT_POS_OPEN_ENTRY;
}

export function getPOSOpenEntry(entryKey) {
  return POS_OPEN_ENTRY_MAP.get(normalizePOSOpenEntry(entryKey));
}

export function getPOSSecondaryOpenEntries() {
  return POS_OPEN_ENTRIES.filter((entry) => entry.key !== DEFAULT_POS_OPEN_ENTRY);
}

export function readPOSOpenMode(storage, userId) {
  if (!storage || typeof storage.getItem !== 'function') {
    return DEFAULT_POS_OPEN_MODE;
  }

  return normalizePOSOpenMode(storage.getItem(getPOSOpenModeStorageKey(userId)));
}

export function writePOSOpenMode(storage, userId, mode) {
  const normalizedMode = normalizePOSOpenMode(mode);

  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(getPOSOpenModeStorageKey(userId), normalizedMode);
  }

  return normalizedMode;
}

export function readPOSOpenEntry(storage, userId) {
  if (!storage || typeof storage.getItem !== 'function') {
    return DEFAULT_POS_OPEN_ENTRY;
  }

  return normalizePOSOpenEntry(storage.getItem(getPOSOpenEntryStorageKey(userId)));
}

export function writePOSOpenEntry(storage, userId, entryKey) {
  const normalizedEntry = normalizePOSOpenEntry(entryKey);

  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(getPOSOpenEntryStorageKey(userId), normalizedEntry);
  }

  return normalizedEntry;
}

export function beginPOSOpenWindow(openWindow) {
  if (typeof openWindow !== 'function') {
    return null;
  }

  const popup = openWindow('', '_blank');
  if (!popup) {
    return null;
  }

  try {
    popup.opener = null;
  } catch {
    // Ignore cross-browser opener assignment failures.
  }

  return popup;
}

export function navigatePOSOpenWindow(popup, targetUrl) {
  if (!popup || !targetUrl) {
    return false;
  }

  try {
    if (popup.location && typeof popup.location.replace === 'function') {
      popup.location.replace(targetUrl);
      return true;
    }

    popup.location.href = targetUrl;
    return true;
  } catch {
    return false;
  }
}

export function cleanupPOSOpenWindow(popup) {
  if (!popup || popup.closed || typeof popup.close !== 'function') {
    return;
  }

  try {
    popup.close();
  } catch {
    // Ignore popup close failures.
  }
}

function joinPOSOpenURL(baseUrl, entryPath) {
  const trimmedBaseUrl = String(baseUrl || '').trim();
  const trimmedEntryPath = String(entryPath || '').trim();

  if (!trimmedBaseUrl) {
    return '';
  }
  if (!trimmedEntryPath) {
    return trimmedBaseUrl;
  }

  const normalizedBase = trimmedBaseUrl.endsWith('/') ? trimmedBaseUrl : `${trimmedBaseUrl}/`;
  const normalizedPath = trimmedEntryPath.startsWith('/') ? trimmedEntryPath.slice(1) : trimmedEntryPath;
  return `${normalizedBase}${normalizedPath}`;
}

function appendQueryParamBeforeHash(targetUrl, key, value) {
  const trimmedUrl = String(targetUrl || '').trim();
  if (!trimmedUrl) {
    return '';
  }

  const hashIndex = trimmedUrl.indexOf('#');
  const beforeHash = hashIndex >= 0 ? trimmedUrl.slice(0, hashIndex) : trimmedUrl;
  const hashFragment = hashIndex >= 0 ? trimmedUrl.slice(hashIndex) : '';
  const separator = beforeHash.includes('?') ? '&' : '?';

  return `${beforeHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hashFragment}`;
}

export function resolvePOSOpenTarget(accessInfo, mode) {
  const normalizedMode = normalizePOSOpenMode(mode);
  const targetUrl = normalizedMode === POS_OPEN_MODE_PROXY
    ? accessInfo?.proxyUrl
    : accessInfo?.directUrl;

  if (!targetUrl) {
    throw new Error(normalizedMode === POS_OPEN_MODE_PROXY ? '缺少代理访问地址' : '缺少直连访问地址');
  }

  return targetUrl;
}

export function resolvePOSOpenTargetForEntry(accessInfo, mode, entryKey, proxyToken = '') {
  const baseUrl = resolvePOSOpenTarget(accessInfo, mode);
  const entry = getPOSOpenEntry(entryKey);
  const targetUrl = joinPOSOpenURL(baseUrl, entry?.path);

  if (normalizePOSOpenMode(mode) !== POS_OPEN_MODE_PROXY) {
    return targetUrl;
  }

  const trimmedToken = String(proxyToken || '').trim();
  if (!trimmedToken) {
    throw new Error('Missing POS proxy token');
  }

  return appendQueryParamBeforeHash(targetUrl, 'token', trimmedToken);
}
