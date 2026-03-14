import { pageTitles } from './navigationConfig';

export function getActiveNavKey(pathname) {
  if (pathname.startsWith('/mobile')) {
    return 'mobile';
  }

  if (pathname.startsWith('/war-packages')) {
    return 'warPackages';
  }

  if (pathname.startsWith('/workspace')) {
    return 'workspace';
  }

  if (pathname.startsWith('/feature-requests')) {
    return 'featureRequests';
  }

  if (pathname.startsWith('/help')) {
    return 'help';
  }

  if (pathname.startsWith('/admin/users')) {
    return 'adminUsers';
  }

  if (pathname.startsWith('/profile')) {
    return 'profile';
  }

  if (pathname.startsWith('/linux-config') || pathname.startsWith('/db-config')) {
    return 'scan';
  }

  return 'scan';
}

export function getPageTitle(pathname) {
  return pageTitles[getActiveNavKey(pathname)] || pageTitles.scan;
}
