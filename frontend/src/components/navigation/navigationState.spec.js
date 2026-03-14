import { describe, expect, it } from 'vitest';

import { getActiveNavKey, getPageTitle } from './navigationState';

describe('navigationState', () => {
  it('maps detail routes back to the pos navigation item', () => {
    expect(getActiveNavKey('/linux-config/123')).toBe('scan');
    expect(getActiveNavKey('/db-config/123')).toBe('scan');
  });

  it('maps profile routes to the account navigation item and title', () => {
    expect(getActiveNavKey('/profile')).toBe('profile');
    expect(getPageTitle('/profile')).toBe('个人中心');
  });

  it('maps primary routes to their matching navigation keys', () => {
    expect(getActiveNavKey('/')).toBe('scan');
    expect(getActiveNavKey('/workspace')).toBe('workspace');
    expect(getActiveNavKey('/feature-requests')).toBe('featureRequests');
    expect(getActiveNavKey('/admin/users')).toBe('adminUsers');
  });
});
