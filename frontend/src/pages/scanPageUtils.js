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
