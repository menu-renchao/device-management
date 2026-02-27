import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PrivateRoute, AdminRoute, PublicRoute } from './components/auth/PrivateRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ScanPage from './pages/ScanPage';
import MobileDevicesPage from './pages/MobileDevicesPage';
import LinuxConfigPage from './pages/LinuxConfigPage';
import WarPackageManagePage from './pages/WarPackageManagePage';
import BorrowApprovalPage from './pages/BorrowApprovalPage';
import WorkspacePage from './pages/WorkspacePage';
import HelpPage from './pages/HelpPage';
import ProfilePage from './pages/ProfilePage';
import NotificationBell from './components/NotificationBell';
import './App.css';

// 导航栏组件
const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav style={navStyles.nav}>
      <div style={navStyles.left}>
        <div style={navStyles.brand}>
          <img src="/favicon.ico" alt="Logo" style={navStyles.logo} />
          <span style={navStyles.brandText}>Menusifu设备管理平台</span>
        </div>
        <div style={navStyles.links}>
          <Link to="/" style={navStyles.link}>
            <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
            </svg>
            POS设备
          </Link>
          <Link to="/mobile" style={navStyles.link}>
            <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
              <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z" fill="currentColor"/>
            </svg>
            移动设备
          </Link>
          <Link to="/war-packages" style={navStyles.link}>
            <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
              <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm-6 4h16v11H4V8zm0-5h16v2H4V3z" fill="currentColor"/>
            </svg>
            WAR包管理
          </Link>
          <Link to="/workspace" style={navStyles.link}>
            <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
            </svg>
            工作台
          </Link>
          {isAdmin() && (
            <Link to="/admin/users" style={navStyles.link}>
              <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
              </svg>
              管理中心
            </Link>
          )}
          <Link to="/help" style={navStyles.link}>
            <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
              <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" fill="currentColor"/>
            </svg>
            帮助中心
          </Link>
        </div>
      </div>
      <div style={navStyles.right}>
        <NotificationBell />
        <Link to="/profile" style={navStyles.userLink}>
          <div style={navStyles.user}>
            <div style={navStyles.avatar}>{(user?.name || user?.username)?.charAt(0).toUpperCase()}</div>
            <span style={navStyles.userName}>{user?.name || user?.username}</span>
          </div>
        </Link>
        <button onClick={handleLogout} style={navStyles.logoutBtn}>
          <svg style={navStyles.logoutIcon} viewBox="0 0 24 24" fill="none">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="currentColor"/>
          </svg>
          登出
        </button>
      </div>
    </nav>
  );
};

// 主应用布局
const MainLayout = ({ children }) => {
  return (
    <div className="app">
      <Navbar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={
            <PublicRoute><LoginPage /></PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute><RegisterPage /></PublicRoute>
          } />

          {/* 受保护路由 */}
          <Route path="/" element={
            <PrivateRoute>
              <MainLayout>
                <ScanPage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 移动设备管理 */}
          <Route path="/mobile" element={
            <PrivateRoute>
              <MainLayout>
                <MobileDevicesPage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* Linux 配置管理 */}
          <Route path="/linux-config/:merchantId" element={
            <PrivateRoute>
              <MainLayout>
                <LinuxConfigPage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* WAR 包管理 */}
          <Route path="/war-packages" element={
            <PrivateRoute>
              <MainLayout>
                <WarPackageManagePage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 工作台路由（所有登录用户可访问） */}
          <Route path="/workspace" element={
            <PrivateRoute>
              <MainLayout>
                <WorkspacePage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 帮助中心路由（所有登录用户可访问） */}
          <Route path="/help" element={
            <PrivateRoute>
              <MainLayout>
                <HelpPage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 个人中心路由（所有登录用户可访问） */}
          <Route path="/profile" element={
            <PrivateRoute>
              <MainLayout>
                <ProfilePage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 借用审核路由（所有登录用户可访问） */}
          <Route path="/borrow-approval" element={
            <PrivateRoute>
              <MainLayout>
                <BorrowApprovalPage />
              </MainLayout>
            </PrivateRoute>
          } />

          {/* 管理员路由 */}
          <Route path="/admin/users" element={
            <AdminRoute>
              <MainLayout>
                <AdminUsersPage />
              </MainLayout>
            </AdminRoute>
          } />

          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

const navStyles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    height: '52px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    width: '22px',
    height: '22px',
    objectFit: 'contain',
  },
  brandText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1D1D1F',
    letterSpacing: '-0.01em',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    color: '#1D1D1F',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '500',
    borderRadius: '6px',
    transition: 'all 0.15s ease',
  },
  linkIcon: {
    width: '15px',
    height: '15px',
    color: '#86868B',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userLink: {
    textDecoration: 'none',
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px 4px 4px',
    backgroundColor: '#F2F2F7',
    borderRadius: '14px',
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
  },
  userName: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    backgroundColor: 'transparent',
    color: '#FF3B30',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  logoutIcon: {
    width: '15px',
    height: '15px',
  },
};

export default App;
