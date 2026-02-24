import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const NotificationBell = () => {
  const { unreadCount, markAsRead } = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications((data.notifications || []).slice(0, 5));
    } catch (error) {
      console.error('获取通知列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    const success = await markAsRead(id);
    if (success) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/workspace?tab=notifications');
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

  return (
    <div style={styles.container} ref={popoverRef}>
      <div style={styles.bell} onClick={() => handleOpenChange(!open)}>
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <svg style={styles.bellIcon} viewBox="0 0 24 24" fill="none">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
        </svg>
      </div>

      {open && (
        <div style={styles.popover}>
          <div style={styles.popoverHeader}>
            <span style={styles.popoverTitle}>系统通知</span>
            {unreadCount > 0 && (
              <span style={styles.unreadTag}>{unreadCount} 条未读</span>
            )}
          </div>

          <div style={styles.popoverContent}>
            {loading ? (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={styles.empty}>暂无通知</div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.notificationItem,
                    backgroundColor: item.isRead ? 'transparent' : '#f6ffed',
                  }}
                >
                  <div style={styles.notificationContent}>
                    <div style={styles.notificationTitle}>
                      <span style={{ fontWeight: item.isRead ? 'normal' : 'bold' }}>
                        {item.title}
                      </span>
                      {!item.isRead && <span style={styles.newTag}>新</span>}
                    </div>
                    <div style={styles.notificationDesc}>{item.content}</div>
                    <div style={styles.notificationTime}>{formatTime(item.createdAt)}</div>
                  </div>
                  {!item.isRead && (
                    <button
                      style={styles.readBtn}
                      onClick={(e) => handleMarkAsRead(e, item.id)}
                    >
                      <svg style={styles.checkIcon} viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={styles.popoverFooter}>
            <button style={styles.viewAllBtn} onClick={handleViewAll}>
              查看全部通知
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
  },
  bell: {
    cursor: 'pointer',
    padding: '4px 8px',
    position: 'relative',
  },
  bellIcon: {
    width: '20px',
    height: '20px',
    color: '#666',
  },
  badge: {
    position: 'absolute',
    top: '0',
    right: '2px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    backgroundColor: '#FF3B30',
    color: 'white',
    fontSize: '10px',
    fontWeight: '500',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popover: {
    position: 'absolute',
    top: '100%',
    right: '0',
    width: '320px',
    maxHeight: '400px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    marginTop: '8px',
  },
  popoverHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #F2F2F7',
  },
  popoverTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  unreadTag: {
    padding: '2px 8px',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderRadius: '4px',
    color: '#007AFF',
    fontSize: '12px',
  },
  popoverContent: {
    maxHeight: '280px',
    overflowY: 'auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid #E5E5EA',
    borderTopColor: '#007AFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    textAlign: 'center',
    padding: '30px',
    color: '#86868B',
    fontSize: '13px',
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#1D1D1F',
    marginBottom: '2px',
  },
  newTag: {
    padding: '1px 4px',
    backgroundColor: '#007AFF',
    color: 'white',
    fontSize: '10px',
    borderRadius: '3px',
  },
  notificationDesc: {
    fontSize: '12px',
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  notificationTime: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  readBtn: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#007AFF',
  },
  checkIcon: {
    width: '16px',
    height: '16px',
  },
  popoverFooter: {
    textAlign: 'center',
    padding: '10px',
    borderTop: '1px solid #F2F2F7',
  },
  viewAllBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#007AFF',
    cursor: 'pointer',
    fontSize: '13px',
  },
};

export default NotificationBell;
