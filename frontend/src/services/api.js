import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器，自动带上 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 处理 401 响应的通用函数
const handleUnauthorized = () => {
  // 避免重复跳转
  if (window.location.pathname !== '/login') {
    // 清除本地存储的认证信息
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    // 跳转到登录页
    window.location.href = '/login';
  }
};

// 为全局 axios 添加响应拦截器（处理文件上传等直接使用 axios 的请求）
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

// 为 api 实例添加响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

// 创建带认证的 axios 实例
const createAuthAxios = () => {
  const token = localStorage.getItem('access_token');
  const authAxios = axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });

  // 添加响应拦截器处理 401
  authAxios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        handleUnauthorized();
      }
      return Promise.reject(error);
    }
  );

  return authAxios;
};

export const scanAPI = {
  // 获取本地IP列表
  getLocalIPs: () => api.get('/scan/ips'),

  // 开始扫描
  startScan: (localIP) => api.post('/scan/start', { local_ip: localIP }),

  // 获取扫描状态
  getScanStatus: () => api.get('/scan/status'),

  // 停止扫描
  stopScan: () => api.post('/scan/stop'),

  // 获取设备列表（支持分页和搜索）
  getDevices: (page = 1, pageSize = 50, search = '') => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (search) params.append('search', search);
    return api.get(`/devices?${params.toString()}`);
  },

  // 获取设备详情
  getDeviceDetails: (ip) => api.get(`/scan/device/${ip}/details`)
};

// 设备占用 API（需要认证）
export const deviceAPI = {
  // 获取所有占用信息
  getOccupancies: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/device/occupancy');
    return response.data;
  },

  // 设置占用
  setOccupancy: async (merchantId, purpose, startTime, endTime) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put('/device/occupancy', {
      merchant_id: merchantId,
      purpose,
      start_time: startTime,
      end_time: endTime
    });
    return response.data;
  },

  // 释放占用
  releaseOccupancy: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/device/occupancy/${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  // 删除设备（仅管理员，支持 merchantId 或 IP）
  deleteDevice: async (merchantIdOrIP) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/device/${encodeURIComponent(merchantIdOrIP)}`);
    return response.data;
  },

  // 提交认领申请
  submitClaim: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/device/claim', { merchant_id: merchantId });
    return response.data;
  },

  // 获取认领申请列表（管理员）
  getClaims: async (status = 'pending') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/device/claims?status=${status}`);
    return response.data;
  },

  // 审核通过认领申请（管理员）
  approveClaim: async (claimId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/device/claim/${claimId}/approve`);
    return response.data;
  },

  // 审核拒绝认领申请（管理员）
  rejectClaim: async (claimId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/device/claim/${claimId}/reject`);
    return response.data;
  },

  // 重置设备认领状态（管理员）
  resetOwner: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/device/${encodeURIComponent(merchantId)}/owner`);
    return response.data;
  },

  // 移动设备借用申请
  submitBorrowRequest: async (deviceId, purpose, endTime) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/mobile/borrow-requests', {
      deviceId,
      purpose,
      endTime
    });
    return response.data;
  },

  // 获取借用申请列表
  getBorrowRequests: async (status = 'pending') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/mobile/borrow-requests?status=${status}`);
    return response.data;
  },

  // 审核通过借用申请
  approveBorrowRequest: async (requestId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/mobile/borrow-requests/${requestId}/approve`);
    return response.data;
  },

  // 审核拒绝借用申请
  rejectBorrowRequest: async (requestId, reason = '') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/mobile/borrow-requests/${requestId}/reject`, { reason });
    return response.data;
  },

  // 设置移动设备负责人
  setMobileDeviceOwner: async (deviceId, ownerId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`/mobile/devices/${deviceId}/owner`, { ownerId });
    return response.data;
  },

  // POS设备借用申请
  submitPosBorrowRequest: async (merchantId, purpose, endTime) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/device/borrow-requests', {
      merchantId,
      purpose,
      endTime
    });
    return response.data;
  },

  // 获取POS设备借用申请列表
  getPosBorrowRequests: async (status = 'pending') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/device/borrow-requests?status=${status}`);
    return response.data;
  },

  // 审核通过POS设备借用申请
  approvePosBorrowRequest: async (requestId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/device/borrow-requests/${requestId}/approve`);
    return response.data;
  },

  // 审核拒绝POS设备借用申请
  rejectPosBorrowRequest: async (requestId, reason = '') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/device/borrow-requests/${requestId}/reject`, { reason });
    return response.data;
  }
};

export default api;

// Linux 设备管理 API
export const linuxAPI = {
  // 连接管理
  connect: async (merchantId, host, port, user, password) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/connect', {
      merchant_id: merchantId,
      host,
      port: port || 22,
      user,
      password
    });
    return response.data;
  },

  disconnect: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/disconnect', {
      merchant_id: merchantId
    });
    return response.data;
  },

  getStatus: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/status?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  testConnection: async (host, port, user, password) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/test-connection', {
      host,
      port: port || 22,
      user,
      password
    });
    return response.data;
  },

  // POS 控制
  stopPOS: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/pos/stop', {
      merchant_id: merchantId
    });
    return response.data;
  },

  startPOS: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/pos/start', {
      merchant_id: merchantId
    });
    return response.data;
  },

  restartPOS: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/pos/restart', {
      merchant_id: merchantId
    });
    return response.data;
  },

  restartTomcat: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/tomcat/restart', {
      merchant_id: merchantId
    });
    return response.data;
  },

  // 文件上传
  uploadWAR: async (merchantId, file, onProgress, targetPath = null) => {
    const formData = new FormData();
    formData.append('merchant_id', merchantId);
    formData.append('file', file);
    if (targetPath) {
      formData.append('target_path', targetPath);
    }

    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/linux/upload/war`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  getUploadProgress: async (taskId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/upload/progress/${taskId}`);
    return response.data;
  },

  // 备份管理
  createBackup: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/backup/create', {
      merchant_id: merchantId
    });
    return response.data;
  },

  listBackups: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/backup/list?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  restoreBackup: async (merchantId, backupPath) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/backup/restore', {
      merchant_id: merchantId,
      backup_path: backupPath
    });
    return response.data;
  },

  // 日志管理
  listLogs: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/logs/list?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  readLogContent: async (merchantId, logPath, lines = 100) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/logs/content?merchant_id=${encodeURIComponent(merchantId)}&log_path=${encodeURIComponent(logPath)}&lines=${lines}`);
    return response.data;
  },

  downloadLogUrl: (merchantId, logPath) => {
    const token = localStorage.getItem('access_token');
    return `${API_BASE_URL}/linux/logs/download?merchant_id=${encodeURIComponent(merchantId)}&log_path=${encodeURIComponent(logPath)}&token=${token}`;
  },

  // 版本信息
  getAppVersion: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/version/app?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  getCloudVersion: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/version/cloud?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  // MD5 校验
  getRemoteMD5: async (merchantId, remotePath) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/md5/remote', {
      merchant_id: merchantId,
      remote_path: remotePath
    });
    return response.data;
  },

  calculateLocalMD5: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/linux/md5/local`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // 配置管理
  getConfigFiles: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/config/list?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  getConfig: async (merchantId, configPath) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/config?merchant_id=${encodeURIComponent(merchantId)}&config_path=${encodeURIComponent(configPath)}`);
    return response.data;
  },

  updateConfig: async (merchantId, configPath, content) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/config', {
      merchant_id: merchantId,
      config_path: configPath,
      content
    });
    return response.data;
  },

  // 系统信息
  getSystemInfo: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/system/info?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  // 文件配置管理
  getFileConfigs: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/linux/file-configs');
    return response.data;
  },

  getFileConfig: async (id) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/file-configs/${id}`);
    return response.data;
  },

  createFileConfig: async (config) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/file-configs', config);
    return response.data;
  },

  updateFileConfig: async (id, config) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`/linux/file-configs/${id}`, config);
    return response.data;
  },

  deleteFileConfig: async (id) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/linux/file-configs/${id}`);
    return response.data;
  },

  toggleFileConfig: async (id, enabled) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`/linux/file-configs/${id}/toggle`, { enabled });
    return response.data;
  },

  executeFileConfigs: async (merchantId, configIds, env) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/file-configs/execute', {
      merchant_id: merchantId,
      config_ids: configIds,
      env: env
    });
    return response.data;
  },

  // WAR 包下载管理
  // type: "war" 只返回 war 包, "zip" 只返回 zip 包, 不传返回全部
  getWarPackages: async (type = '') => {
    const authAxios = createAuthAxios();
    const url = type ? `/linux/war/list?type=${type}` : '/linux/war/list';
    const response = await authAxios.get(url);
    return response.data;
  },

  startWarDownload: async (url, overwrite = false, packageType = 'war') => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/war/download', { url, overwrite, package_type: packageType });
    return response.data;
  },

  getWarDownloadProgress: async (taskId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/war/download/progress/${taskId}`);
    return response.data;
  },

  deleteWarPackage: async (name) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/linux/war/${encodeURIComponent(name)}`);
    return response.data;
  },

  getWarPackageMD5: async (name) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/war/md5/${encodeURIComponent(name)}`);
    return response.data;
  },

  getDownloadConfig: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/linux/war/config');
    return response.data;
  },

  updateDownloadConfig: async (cookie) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put('/linux/war/config', { cookie });
    return response.data;
  },

  cancelWarDownload: async (taskId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/linux/war/download/cancel/${taskId}`);
    return response.data;
  },

  // 上传本地 WAR 包到服务器
  uploadWarLocalFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/linux/war/upload-local`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  // 下载历史包到本地
  downloadWarPackageUrl: (name) => {
    const token = localStorage.getItem('access_token');
    return `${API_BASE_URL}/linux/war/file/${encodeURIComponent(name)}?token=${token}`;
  },

  // WAR 包元数据管理
  getWarPackageMetadata: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/linux/war/metadata/list');
    return response.data;
  },

  updateWarPackageMetadata: async (metadata) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put('/linux/war/metadata', metadata);
    return response.data;
  },

  setWarPackageRelease: async (packageName, isRelease) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/linux/war/metadata/release?package_name=${encodeURIComponent(packageName)}&is_release=${isRelease}`);
    return response.data;
  },

  deleteWarPackageMetadata: async (packageName) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/linux/war/metadata?package_name=${encodeURIComponent(packageName)}`);
    return response.data;
  },

  // 扫描远程升级包
  scanUpgradePackages: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/upgrade/package/scan?merchant_id=${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  // 上传升级包(zip)并解压
  uploadUpgradePackage: async (merchantId, file, onProgress) => {
    const formData = new FormData();
    formData.append('merchant_id', merchantId);
    formData.append('file', file);

    const token = localStorage.getItem('access_token');
    const response = await axios.post(`${API_BASE_URL}/linux/upgrade/package/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  // 创建升级任务（SSE 模式）
  startUpgradeTask: async (params) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/linux/upgrade/task', params);
    return response.data;
  },

  // 获取升级任务状态
  getUpgradeTaskStatus: async (taskId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/linux/upgrade/status/${taskId}`);
    return response.data;
  },

  // 获取 SSE 升级进度 URL
  getUpgradeStreamUrl: (taskId) => {
    const token = localStorage.getItem('access_token');
    return `/api/linux/upgrade/stream/${taskId}?token=${token}`;
  }
};

// 设备数据库配置 API
export const dbConfigAPI = {
  getConnection: async (merchantId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/db-config/connections/${encodeURIComponent(merchantId)}`);
    return response.data;
  },

  saveConnection: async (merchantId, payload) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`/db-config/connections/${encodeURIComponent(merchantId)}`, payload);
    return response.data;
  },

  testConnection: async (merchantId, payload) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/db-config/connections/${encodeURIComponent(merchantId)}/test`, payload);
    return response.data;
  },

  getTemplates: async (page = 1, pageSize = 20, keyword = '') => {
    const authAxios = createAuthAxios();
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    });
    if (keyword) {
      params.append('keyword', keyword);
    }
    const response = await authAxios.get(`/db-config/templates?${params.toString()}`);
    return response.data;
  },

  getTemplate: async (id) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/db-config/templates/${id}`);
    return response.data;
  },

  createTemplate: async (payload) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/db-config/templates', payload);
    return response.data;
  },

  updateTemplate: async (id, payload) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.put(`/db-config/templates/${id}`, payload);
    return response.data;
  },

  deleteTemplate: async (id) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.delete(`/db-config/templates/${id}`);
    return response.data;
  },

  executeTemplates: async (payload) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/db-config/execute', payload);
    return response.data;
  },

  getExecuteTask: async (taskId) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/db-config/execute/${encodeURIComponent(taskId)}`);
    return response.data;
  },

  getExecuteHistory: async (page = 1, pageSize = 20) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/db-config/execute/history?page=${page}&page_size=${pageSize}`);
    return response.data;
  }
};

// 工作台 API
export const workspaceAPI = {
  // 获取我的借用申请
  getMyRequests: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/workspace/my-requests');
    return response.data.data;
  },

  // 获取我的借用设备
  getMyBorrows: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/workspace/my-borrows');
    return response.data.data;
  },

  // 获取我负责的设备
  getMyDevices: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/workspace/my-devices');
    return response.data.data;
  }
};

// 通知 API
export const notificationAPI = {
  // 获取通知列表
  getNotifications: async (limit = 50) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get(`/notifications?limit=${limit}`);
    return response.data.data;
  },

  // 获取未读通知数量
  getUnreadCount: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.get('/notifications/unread-count');
    return response.data.data;
  },

  // 标记通知为已读
  markAsRead: async (id) => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post(`/notifications/${id}/read`);
    return response.data;
  },

  // 标记所有通知为已读
  markAllAsRead: async () => {
    const authAxios = createAuthAxios();
    const response = await authAxios.post('/notifications/read-all');
    return response.data;
  }
};

// 导出简化的 API 函数
export const getMyRequests = workspaceAPI.getMyRequests;
export const getMyBorrows = workspaceAPI.getMyBorrows;
export const getMyDevices = workspaceAPI.getMyDevices;

export const getNotifications = notificationAPI.getNotifications;
export const getUnreadNotificationCount = notificationAPI.getUnreadCount;
export const markNotificationAsRead = notificationAPI.markAsRead;
export const markAllNotificationsAsRead = notificationAPI.markAllAsRead;

// 释放设备占用的简化函数
export const releaseDevice = async (merchantId) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.delete(`/device/occupancy/${encodeURIComponent(merchantId)}`);
  return response.data;
};

export const releaseMobileDevice = async (deviceId) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post(`/mobile/devices/${deviceId}/release`);
  return response.data;
};

// 审核拒绝借用申请（带原因）
export const rejectPosBorrowRequestWithReason = async (requestId, reason) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post(`/device/borrow-requests/${requestId}/reject`, { reason });
  return response.data;
};

export const rejectMobileBorrowRequestWithReason = async (requestId, reason) => {
  const authAxios = createAuthAxios();
  const response = await authAxios.post(`/mobile/borrow-requests/${requestId}/reject`, { reason });
  return response.data;
};