import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead } from '../services/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('获取未读数量失败:', error);
    }
  }, []);

  const decreaseUnreadCount = useCallback((count = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - count));
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await markNotificationAsRead(id);
      decreaseUnreadCount(1);
      return true;
    } catch (error) {
      console.error('标记已读失败:', error);
      return false;
    }
  }, [decreaseUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadCount(0);
      return true;
    } catch (error) {
      console.error('全部标记已读失败:', error);
      return false;
    }
  }, []);

  // 初始化时获取未读数量
  useEffect(() => {
    fetchUnreadCount();
    // 每分钟刷新一次
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const value = {
    unreadCount,
    fetchUnreadCount,
    decreaseUnreadCount,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
