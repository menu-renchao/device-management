export const DEFAULT_WORKSPACE_TAB = 'approvals';
export const AVAILABLE_WORKSPACE_TABS = ['approvals', 'requests', 'borrows', 'devices', 'notifications'];

export function getAvailableWorkspaceTabs(isAdmin = false) {
  if (!isAdmin) {
    return AVAILABLE_WORKSPACE_TABS;
  }

  return AVAILABLE_WORKSPACE_TABS.filter((tab) => tab !== 'requests');
}

export function getWorkspaceTab(tab, { isAdmin = false } = {}) {
  const availableTabs = getAvailableWorkspaceTabs(isAdmin);
  if (!tab || !availableTabs.includes(tab)) {
    return DEFAULT_WORKSPACE_TAB;
  }
  return tab;
}
