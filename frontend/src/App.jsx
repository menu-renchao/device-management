import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { PrivateRoute, AdminRoute, PublicRoute } from './components/auth/PrivateRoute';
import AppShell from './components/navigation/AppShell';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import AdminUsersPage from './pages/AdminUsersPage';
import DBConfigPage from './pages/DBConfigPage';
import FeatureRequestsPage from './pages/FeatureRequestsPage';
import HelpPage from './pages/HelpPage';
import LinuxConfigPage from './pages/LinuxConfigPage';
import LoginPage from './pages/LoginPage';
import MobileDevicesPage from './pages/MobileDevicesPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ScanPage from './pages/ScanPage';
import WarPackageManagePage from './pages/WarPackageManagePage';
import WorkspacePage from './pages/WorkspacePage';
import './App.css';

const MainLayout = ({ children }) => {
  return <AppShell>{children}</AppShell>;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <ScanPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/mobile"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <MobileDevicesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/linux-config/:merchantId"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <LinuxConfigPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/db-config/:merchantId"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <DBConfigPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/war-packages"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <WarPackageManagePage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/workspace"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <WorkspacePage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/feature-requests"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <FeatureRequestsPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/help"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <HelpPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/borrow-approval"
              element={
                <PrivateRoute>
                  <Navigate to="/workspace?tab=approvals" replace />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <MainLayout>
                    <AdminUsersPage />
                  </MainLayout>
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
