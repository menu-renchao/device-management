import React, { useEffect, useState } from 'react';
import { getNotifications } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import Button from '../ui/Button';
import SectionGroup from '../ui/SectionGroup';
import StatusBadge from '../ui/StatusBadge';

const NotificationsTab = () => {
  const { markAsRead, markAllAsRead } = useNotification();
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
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    const success = await markAsRead(id);
    if (success) {
      setNotifications((previous) => previous.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTag = (type) => {
    switch (type) {
      case 'borrow_warning':
        return { tone: 'warning', label: '即将到期' };
      case 'borrow_expired':
      case 'borrow_rejected':
      case 'claim_rejected':
        return { tone: 'danger', label: '需要处理' };
      case 'borrow_approved':
      case 'claim_approved':
        return { tone: 'success', label: '已通过' };
      case 'claim_request':
        return { tone: 'warning', label: '待认领' };
      case 'borrow_request':
      default:
        return { tone: 'info', label: '新通知' };
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <SectionGroup
      title="系统通知"
      description="以更安静的列表方式查看系统提醒、审批结果和到期预警。"
      extra={
        unreadCount > 0 ? (
          <Button variant="secondary" onClick={handleMarkAllAsRead}>
            全部标记已读
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div style={styles.state}>Loading...</div>
      ) : notifications.length === 0 ? (
        <div style={styles.state}>暂无系统通知</div>
      ) : (
        <div style={styles.list}>
          {notifications.map((item) => {
            const tag = getTag(item.type);
            return (
              <div key={item.id} style={{ ...styles.item, backgroundColor: item.isRead ? 'var(--bg-surface)' : 'rgba(0, 122, 255, 0.04)' }}>
                <div style={styles.itemHeader}>
                  <div style={styles.headerLeft}>
                    <div style={styles.itemTitle}>{item.title}</div>
                    <StatusBadge tone={tag.tone}>{tag.label}</StatusBadge>
                  </div>
                  <div style={styles.itemTime}>{formatTime(item.createdAt)}</div>
                </div>
                <div style={styles.itemContent}>{item.content}</div>
                {!item.isRead ? (
                  <div style={styles.itemActions}>
                    <Button variant="tertiary" onClick={() => handleMarkAsRead(item.id)}>
                      标记已读
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionGroup>
  );
};

const styles = {
  state: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  item: {
    padding: '16px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    marginBottom: '8px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  itemTime: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
  },
  itemContent: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  itemActions: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
};

export default NotificationsTab;

