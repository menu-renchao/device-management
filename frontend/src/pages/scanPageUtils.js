export function shouldLoadAutoScanPanel(isAdminFn) {
  if (typeof isAdminFn !== 'function') {
    return false;
  }
  return !!isAdminFn();
}

export function getAutoScanDisplayMode(isAdminFn, isDialogOpen) {
  if (!shouldLoadAutoScanPanel(isAdminFn)) {
    return 'hidden';
  }
  return isDialogOpen ? 'dialog' : 'button';
}

export function getFilterButtonActiveStyle() {
  return {
    backgroundColor: '#007AFF',
    color: '#fff',
    border: '1px solid #007AFF',
  };
}

export function getMineOnlyToggleActiveStyle() {
  return {
    border: '1px solid #007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    color: '#007AFF',
  };
}
