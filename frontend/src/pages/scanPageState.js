export function getOnlyMyDevicesStorageKey(userId) {
  return `scan_page_only_my_devices_${userId || 'default'}`;
}

export function toggleMultiValueFilter(currentValues = [], value, checked) {
  const values = Array.isArray(currentValues) ? currentValues : [];
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }
  return values.filter((item) => item !== value);
}

export function formatLastScanTime(isoString, now = new Date()) {
  if (!isoString || isoString === '') {
    return '';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) {
    return '刚刚';
  }
  if (diffMins < 60) {
    return `${diffMins}分钟前`;
  }
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  return date.toLocaleDateString('zh-CN');
}

export function getPurposeText(purpose) {
  if (purpose === null || purpose === undefined) {
    return '';
  }
  if (typeof purpose === 'string') {
    return purpose.trim();
  }
  if (typeof purpose === 'object') {
    if (typeof purpose.String === 'string') {
      return purpose.String.trim();
    }
    if (typeof purpose.value === 'string') {
      return purpose.value.trim();
    }
  }
  return String(purpose).trim();
}

export function getScanConfirmConfig(type, data) {
  const deviceName = data?.name || data?.merchantId || data?.ip || '';

  switch (type) {
    case 'release':
      return { title: '确认归还', message: '确定要释放此设备吗？', confirmText: '归还' };
    case 'delete':
      return {
        title: '确认删除',
        message: `确定要删除设备 ${deviceName} 吗？此操作不可恢复。`,
        confirmText: '删除',
      };
    case 'claim':
      return {
        title: '确认认领',
        message: `确定要认领设备 ${deviceName} 吗？认领申请将提交给管理员审核。`,
        confirmText: '认领',
      };
    case 'resetOwner':
      return {
        title: '确认重置',
        message: `确定要重置设备 ${deviceName} 的认领状态吗？`,
        confirmText: '重置',
      };
    default:
      return { title: '确认', message: '', confirmText: '确定' };
  }
}
