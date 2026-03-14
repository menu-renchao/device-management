import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppShell from './AppShell';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'demo' },
    logout: vi.fn(),
    isAdmin: () => false,
  }),
}));

vi.mock('../NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">bell</div>,
}));

describe('AppShell', () => {
  it('renders sidebar navigation, current page title, and wrapped content', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getAllByText('工作台').length).toBeGreaterThan(0);
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(container.querySelector('.app-sidebar')).not.toBeNull();
    expect(container.querySelector('.app-mobile-header')).not.toBeNull();
  });
});
