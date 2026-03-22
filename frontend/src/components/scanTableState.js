export function normalizeMerchantId(merchantId) {
  if (typeof merchantId !== 'string') {
    return '';
  }

  return merchantId.trim();
}

export function getDeviceTypeIconPresentation(deviceType) {
  const type = (deviceType || '').toLowerCase();

  if (type.includes('linux')) {
    return {
      src: '/linux.svg',
      alt: 'Linux',
      fallback: '🐧',
    };
  }

  if (type.includes('win')) {
    return {
      src: '/windows.svg',
      alt: 'Windows',
      fallback: '🪟',
    };
  }

  return {
    src: '',
    alt: 'Device',
    fallback: '🖥',
  };
}

export function getDeviceStatusPresentation(device, offlineTimeText = '') {
  const isOnlineDevice = device?.isOnline === true;

  if (isOnlineDevice) {
    return {
      text: '在线',
      toneClassName: 'online',
      dotClassName: 'online-indicator',
    };
  }

  return {
    text: offlineTimeText ? `离线 ${offlineTimeText}` : '离线',
    toneClassName: 'offline',
    dotClassName: 'offline-indicator',
  };
}
