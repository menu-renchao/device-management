import React, { useEffect, useState } from 'react';
import { getNotifications } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

const NotificationsTab = () => {
  const { markAsRead, markAllAsRead, fetchUnreadCount } = useNotification();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('获取通知列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    const success = await markAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    const iconPaths = {
      borrow_request: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
      borrow_warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
      borrow_expired: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
      borrow_approved: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
      borrow_rejected: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z',
      claim_approved: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
      claim_rejected: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z',
      claim_request: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    };
    return iconPaths[type] || 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z';
  };

  const getTypeColor = (type) => {
    const colors = {
      borrow_request: '#007AFF',
      borrow_warning: '#FF9500',
      borrow_expired: '#FF3B30',
      borrow_approved: '#34C759',
      borrow_rejected: '#FF3B30',
      claim_approved: '#34C759',
      claim_rejected: '#FF3B30',
      claim_request: '#5856D6',
    };
    return colors[type] || '#007AFF';
  };

  const getTypeTag = (type) => {
    const tags = {
      borrow_request: { text: '待审核', bg: 'rgba(0, 122, 255, 0.12)', color: '#007AFF' },
      borrow_warning: { text: '即将到期', bg: 'rgba(255, 149, 0, 0.12)', color: '#FF9500' },
      borrow_expired: { text: '已过期', bg: 'rgba(255, 59, 48, 0.12)', color: '#FF3B30' },
      borrow_approved: { text: '已通过', bg: 'rgba(52, 199, 89, 0.12)', color: '#34C759' },
      borrow_rejected: { text: '已拒绝', bg: 'rgba(255, 59, 48, 0.12)', color: '#FF3B30' },
      claim_approved: { text: '认领通过', bg: 'rgba(52, 199, 89, 0.12)', color: '#34C759' },
      claim_rejected: { text: '认领拒绝', bg: 'rgba(255, 59, 48, 0.12)', color: '#FF3B30' },
      claim_request: { text: '待认领', bg: 'rgba(88, 86, 214, 0.12)', color: '#5856D6' },
    };
    return tags[type] || { text: '通知', bg: 'rgba(0, 122, 255, 0.12)', color: '#007AFF' };
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <span>加载中...</span>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (notifications.length === 0) {
    return (
      <div style={styles.empty}>
        <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
        </svg>
        <p>暂无系统通知</p>
      </div>
    );
  }

  return (
    <div>
      {unreadCount > 0 && (
        <div style={styles.header}>
          <span style={styles.unreadBadge}>
            <svg style={styles.bellIcon} viewBox="0 0 24 24" fill="none">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
            </svg>
            {unreadCount} 条未读
          </span>
          <button onClick={handleMarkAllAsRead} style={styles.markAllBtn}>
            全部标记已读
          </button>
        </div>
      )}

      <div style={styles.list}>
        {notifications.map((item) => {
          const tag = getTypeTag(item.type);
          return (
            <div
              key={item.id}
              style={{
                ...styles.item,
                backgroundColor: item.isRead ? 'transparent' : '#f6ffed',
              }}
            >
              <div style={styles.itemIcon}>
                <svg style={{ ...styles.icon, color: getTypeColor(item.type) }} viewBox="0 0 24 24" fill="none">
                  <path d={getTypeIcon(item.type)} fill="currentColor"/>
                </svg>
              </div>
              <div style={styles.itemContent}>
                <div style={styles.itemHeader}>
                  <span style={{ ...styles.itemTitle, fontWeight: item.isRead ? 'normal' : 'bold' }}>
                    {item.title}
                  </span>
                  <span style={{ ...styles.typeTag, backgroundColor: tag.bg, color: tag.color }}>
                    {tag.text}
                  </span>
                </div>
                <div style={styles.itemDesc}>{item.content}</div>
                <div style={styles.itemTime}>{formatTime(item.createdAt)}</div>
              </div>
              {!item.isRead && (
                <button
                  onClick={() => handleMarkAsRead(item.id)}
                  style={styles.markReadBtn}
                >
                  <svg style={styles.checkIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                  </svg>
                  已读
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#86868B',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '12px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#86868B',
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    color: '#C7C7CC',
    marginBottom: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  unreadBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderRadius: '6px',
    color: '#007AFF',
    fontSize: '13px',
  },
  bellIcon: {
    width: '14px',
    height: '14px',
  },
  markAllBtn: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#007AFF',
    cursor: 'pointer',
    fontSize: '13px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
  },
  itemIcon: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#F2F2F7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: '20px',
    height: '20px',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  itemTitle: {
    fontSize: '14px',
    color: '#1D1D1F',
  },
  typeTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
  },
  itemDesc: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '4px',
  },
  itemTime: {
    fontSize: '12px',
    color: '#999',
  },
  markReadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#007AFF',
    cursor: 'pointer',
    fontSize: '12px',
    flexShrink: 0,
  },
  checkIcon: {
    width: '14px',
    height: '14px',
  },
};

export default NotificationsTab;
