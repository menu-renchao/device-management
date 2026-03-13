export const DEFAULT_WORKSPACE_TAB = 'approvals';
export const AVAILABLE_WORKSPACE_TABS = ['approvals', 'requests', 'borrows', 'devices', 'notifications'];

export function getWorkspaceTab(tab) {
  if (!tab || !AVAILABLE_WORKSPACE_TABS.includes(tab)) {
    return DEFAULT_WORKSPACE_TAB;
  }
  return tab;
}
