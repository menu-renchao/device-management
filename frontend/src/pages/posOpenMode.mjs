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
