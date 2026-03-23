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

export function canAccessDeviceConfig(device, currentUserId, isAdmin) {
  const isOwner = device?.owner?.id === currentUserId;
  const isOccupier = device?.occupancy?.userId === currentUserId;

  return isAdmin || isOwner || isOccupier;
}

export function getDeviceManagementDisabledReason(device, currentUserId, isAdmin) {
  if (normalizeMerchantId(device?.merchantId) === '') {
    return '缺少商家ID，无法操作';
  }

  if (!canAccessDeviceConfig(device, currentUserId, isAdmin)) {
    return '无权限：仅管理员、负责人或借用人可操作';
  }

  return '';
}

function createActionState(visible, disabledReason, enabledTitle) {
  if (!visible) {
    return {
      visible: false,
      disabled: false,
      title: '',
    };
  }

  return {
    visible: true,
    disabled: disabledReason !== '',
    title: disabledReason || enabledTitle,
  };
}

export function getDeviceActionMenuState({
  device,
  currentUserId,
  isAdmin,
  hasLicenseBackupHandler = false,
  hasDatabaseBackupHandler = false,
  hasMenuTransferHandler = false,
}) {
  const type = (device?.type || '').toLowerCase();
  const disabledReason = getDeviceManagementDisabledReason(device, currentUserId, isAdmin);

  return {
    linuxConfig: createActionState(type === 'linux', disabledReason, 'Linux 配置管理'),
    dbConfig: createActionState(
      type === 'linux' || type === 'windows',
      disabledReason,
      '数据库配置管理'
    ),
    licenseBackup: createActionState(
      hasLicenseBackupHandler,
      disabledReason,
      '打开 License 备份与导入弹窗'
    ),
    databaseBackup: createActionState(
      hasDatabaseBackupHandler,
      disabledReason,
      '创建备份或从服务端、本地上传恢复数据库'
    ),
    menuTransfer: createActionState(
      hasMenuTransferHandler,
      disabledReason,
      '打开菜单导入与导出弹窗'
    ),
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
