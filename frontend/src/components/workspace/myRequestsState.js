function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getRequestAssetType(request) {
  return readString(request?.asset_type) || readString(request?.assetType) || readString(request?.deviceType);
}

export function splitRequestsByAssetType(requests = []) {
  const posRequests = [];
  const mobileRequests = [];

  requests.forEach((request) => {
    if (getRequestAssetType(request) === 'pos') {
      posRequests.push(request);
      return;
    }
    if (getRequestAssetType(request) === 'mobile') {
      mobileRequests.push(request);
    }
  });

  return { posRequests, mobileRequests };
}

export function getRequestDisplayName(request) {
  return (
    readString(request?.device_name) ||
    readString(request?.deviceName) ||
    readString(request?.merchant_id) ||
    readString(request?.merchantId) ||
    (request?.asset_id ? `#${request.asset_id}` : '') ||
    (request?.assetId ? `#${request.assetId}` : '') ||
    '--'
  );
}

export function getRequestValue(request, snakeKey, camelKey) {
  return request?.[snakeKey] ?? request?.[camelKey] ?? null;
}
