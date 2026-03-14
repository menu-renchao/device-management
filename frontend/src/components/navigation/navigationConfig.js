export const primaryNavItems = [
  {
    key: 'scan',
    label: 'POS设备',
    to: '/',
  },
  {
    key: 'mobile',
    label: '移动设备',
    to: '/mobile',
  },
  {
    key: 'warPackages',
    label: 'WAR包管理',
    to: '/war-packages',
  },
  {
    key: 'workspace',
    label: '工作台',
    to: '/workspace',
  },
  {
    key: 'featureRequests',
    label: '意见收集',
    to: '/feature-requests',
  },
  {
    key: 'help',
    label: '帮助中心',
    to: '/help',
  },
];

export const adminNavItems = [
  {
    key: 'adminUsers',
    label: '管理中心',
    to: '/admin/users',
  },
];

export const accountNavItems = [
  {
    key: 'notifications',
    label: '通知',
    to: '/workspace?tab=notifications',
  },
  {
    key: 'profile',
    label: '个人中心',
    to: '/profile',
  },
];

export const pageTitles = {
  scan: 'POS设备',
  mobile: '移动设备',
  warPackages: 'WAR包管理',
  workspace: '工作台',
  featureRequests: '意见收集',
  help: '帮助中心',
  adminUsers: '管理中心',
  profile: '个人中心',
  notifications: '通知',
};
