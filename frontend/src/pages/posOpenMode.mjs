export const POS_OPEN_MODE_DIRECT = 'direct';
export const POS_OPEN_MODE_PROXY = 'proxy';
export const DEFAULT_POS_OPEN_MODE = POS_OPEN_MODE_DIRECT;

export function getPOSOpenModeStorageKey(userId) {
  return `scan_page_pos_open_mode_${userId || 'default'}`;
}

export function normalizePOSOpenMode(mode) {
  return mode === POS_OPEN_MODE_PROXY ? POS_OPEN_MODE_PROXY : DEFAULT_POS_OPEN_MODE;
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

function appendToken(url, token) {
  if (!token) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export function resolvePOSOpenTarget(accessInfo, mode, token = '') {
  const normalizedMode = normalizePOSOpenMode(mode);
  const targetUrl = normalizedMode === POS_OPEN_MODE_PROXY
    ? accessInfo?.proxyUrl
    : accessInfo?.directUrl;

  if (!targetUrl) {
    throw new Error(normalizedMode === POS_OPEN_MODE_PROXY ? '缺少代理访问地址' : '缺少直连访问地址');
  }

  if (normalizedMode === POS_OPEN_MODE_PROXY) {
    return appendToken(targetUrl, token);
  }

  return targetUrl;
}
