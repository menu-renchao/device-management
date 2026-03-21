import axios from 'axios';
import {
  clearStoredAuth,
  createAuthAxios,
  getStoredAccessToken,
  getStoredUser,
  storeAuthPayload,
} from './authClient';

const PUBLIC_AUTH_BASE = '/api/auth';
const AUTH_BASE = '/auth';
const ADMIN_BASE = '/admin';

export const authService = {
  register: async (username, password, email, name = '') => {
    const response = await axios.post(PUBLIC_AUTH_BASE + '/register', {
      username,
      password,
      email,
      name
    });
    return { success: response.data.success, message: response.data.message, error: response.data.error };
  },

  login: async (username, password) => {
    const response = await axios.post(PUBLIC_AUTH_BASE + '/login', {
      username,
      password
    });
    if (response.data.success && response.data.data) {
      storeAuthPayload(response.data.data);
      return { success: true, user: response.data.data.user };
    }
    return response.data;
  },

  logout: async () => {
    try {
      const authAxios = createAuthAxios();
      await authAxios.post(AUTH_BASE + '/logout');
    } finally {
      clearStoredAuth();
    }
  },

  getProfile: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(AUTH_BASE + '/profile');
    return response.data.data || response.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(AUTH_BASE + '/password', {
      old_password: oldPassword,
      new_password: newPassword
    });
    return response.data;
  },

  updateProfile: async (data) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(AUTH_BASE + '/profile', data);
    if (response.data.success && response.data.data) {
      storeAuthPayload({ user: response.data.data });
    }
    return response.data;
  },

  getCurrentUser: () => {
    return getStoredUser();
  },

  isAuthenticated: () => {
    return !!getStoredAccessToken();
  }
};

// 缂備胶濯寸槐鏇㈠箖婵犲洤宸?API
export const adminService = {
  getUsers: async (status = 'all') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`${ADMIN_BASE}/users?status=${status}`);
    return { success: response.data.success, data: response.data.data, error: response.data.error };
  },

  approveUser: async (userId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`${ADMIN_BASE}/users/${userId}/approve`);
    return response.data;
  },

  rejectUser: async (userId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`${ADMIN_BASE}/users/${userId}/reject`);
    return response.data;
  },

  resetUserPassword: async (userId, newPassword) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`${ADMIN_BASE}/users/${userId}/reset-password`, {
      new_password: newPassword
    });
    return response.data;
  },

  deleteUser: async (userId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`${ADMIN_BASE}/users/${userId}`);
    return response.data;
  },

  // 闁荤姳鐒﹂崕鎶剿囬鍕畱鐟滄垵顔忓┑鍫笉闁挎稑瀚崐?
  getDeviceProperties: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`${ADMIN_BASE}/device-properties`);
    return response.data;
  },

  setDeviceProperty: async (merchantId, property) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`${ADMIN_BASE}/device-properties`, {
      merchant_id: merchantId,
      property: property
    });
    return response.data;
  },

  deleteDeviceProperty: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`${ADMIN_BASE}/device-properties/${encodeURIComponent(merchantId)}`);
    return response.data;
  }
};
