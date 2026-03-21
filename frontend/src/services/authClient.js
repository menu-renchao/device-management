import axios from 'axios';

const API_BASE_URL = '/api';
const AUTH_REFRESH_PATH = '/auth/refresh';

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

export const clearStoredAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

export const storeAuthPayload = (payload = {}) => {
  if (payload.access_token) {
    localStorage.setItem('access_token', payload.access_token);
  }
  if (payload.refresh_token) {
    localStorage.setItem('refresh_token', payload.refresh_token);
  }
  if (payload.user) {
    localStorage.setItem('user', JSON.stringify(payload.user));
  }
};

export const getStoredAccessToken = () => localStorage.getItem('access_token') || '';
export const getStoredRefreshToken = () => localStorage.getItem('refresh_token') || '';

export const getStoredUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

export const handleUnauthorized = () => {
  clearStoredAuth();
  redirectToLogin();
};

const shouldSkipRefresh = (config = {}) => {
  const rawUrl = `${config.baseURL || ''}${config.url || ''}`;
  return rawUrl.includes('/auth/login')
    || rawUrl.includes('/auth/register')
    || rawUrl.includes(AUTH_REFRESH_PATH);
};

export const refreshAccessToken = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('missing refresh token');
  }

  if (!refreshPromise) {
    refreshPromise = refreshClient.post(AUTH_REFRESH_PATH, {
      refresh_token: refreshToken,
    }).then((response) => {
      const payload = response.data?.data || {};
      storeAuthPayload(payload);
      return payload.access_token;
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

export const attachAuthRequestInterceptor = (client) => {
  client.interceptors.request.use((config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
};

export const attachAuthResponseInterceptor = (client) => {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const originalRequest = error.config;

      if (status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh(originalRequest)) {
        originalRequest._retry = true;
        try {
          const token = await refreshAccessToken();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        } catch (refreshError) {
          handleUnauthorized();
          return Promise.reject(refreshError);
        }
      }

      if (status === 401) {
        handleUnauthorized();
      }
      return Promise.reject(error);
    }
  );
};

export const createAuthAxios = () => {
  const authAxios = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  attachAuthRequestInterceptor(authAxios);
  attachAuthResponseInterceptor(authAxios);
  return authAxios;
};
