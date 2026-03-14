import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../NotificationBell';
import {
  accountNavItems,
  adminNavItems,
  primaryNavItems,
} from './navigationConfig';
import { getActiveNavKey, getPageTitle } from './navigationState';

const AppShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeKey = getActiveNavKey(location.pathname);
  const displayName = user?.name || user?.username || 'U';
  const adminItems = isAdmin() ? adminNavItems : [];

  const closeMobileNav = () => {
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    closeMobileNav();
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${mobileOpen ? ' is-open' : ''}`}>
        <div className="app-sidebar__brand">
          <img src="/favicon.ico" alt="Logo" className="app-sidebar__logo" />
          <div>
            <div className="app-sidebar__eyebrow">Menusifu</div>
            <div className="app-sidebar__title">设备管理平台</div>
          </div>
        </div>

        <nav className="app-sidebar__section" aria-label="Primary navigation">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={closeMobileNav}
              className={`app-sidebar__link${activeKey === item.key ? ' is-active' : ''}`}
            >
              <span className="app-sidebar__link-label">{item.label}</span>
            </NavLink>
          ))}

          {adminItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={closeMobileNav}
              className={`app-sidebar__link${activeKey === item.key ? ' is-active' : ''}`}
            >
              <span className="app-sidebar__link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__notification">
            <NotificationBell />
            <Link
              to={accountNavItems[0].to}
              onClick={closeMobileNav}
              className="app-sidebar__utility-link"
            >
              {accountNavItems[0].label}
            </Link>
          </div>

          <Link
            to={accountNavItems[1].to}
            onClick={closeMobileNav}
            className={`app-sidebar__account${activeKey === 'profile' ? ' is-active' : ''}`}
          >
            <div className="app-sidebar__avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="app-sidebar__account-copy">
              <span className="app-sidebar__account-name">{displayName}</span>
              <span className="app-sidebar__account-meta">{accountNavItems[1].label}</span>
            </div>
          </Link>

          <button type="button" onClick={handleLogout} className="app-sidebar__logout">
            退出登录
          </button>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-mobile-header__menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="app-mobile-header__title">{getPageTitle(location.pathname)}</div>
        </header>

        <main className="app-main">{children}</main>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="app-drawer-backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobileNav}
        />
      ) : null}
    </div>
  );
};

export default AppShell;
