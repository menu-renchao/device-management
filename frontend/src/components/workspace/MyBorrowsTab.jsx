import React, { useEffect, useState } from 'react';
import { getMyBorrows, releaseDevice, releaseMobileDevice } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../ConfirmDialog';

const MyBorrowsTab = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [posBorrows, setPosBorrows] = useState([]);
  const [mobileBorrows, setMobileBorrows] = useState([]);
  const [releasing, setReleasing] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, id: null });

  useEffect(() => {
    fetchBorrows();
  }, []);

  const fetchBorrows = async () => {
    setLoading(true);
    try {
      const data = await getMyBorrows();
      setPosBorrows(data.posBorrows || []);
      setMobileBorrows(data.mobileBorrows || []);
    } catch (error) {
      console.error('获取借用信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReleasePos = async (merchantId) => {
    setConfirmDialog({ show: true, type: 'pos', id: merchantId });
  };

  const handleReleaseMobile = async (deviceId) => {
    setConfirmDialog({ show: true, type: 'mobile', id: deviceId });
  };

  const confirmRelease = async () => {
    const { type, id } = confirmDialog;
    setConfirmDialog({ show: false, type: null, id: null });

    if (type === 'pos') {
      setReleasing(`pos-${id}`);
      try {
        await releaseDevice(id);
        toast.success('设备已归还');
        fetchBorrows();
      } catch (error) {
        toast.error('归还设备失败');
      } finally {
        setReleasing(null);
      }
    } else {
      setReleasing(`mobile-${id}`);
      try {
        await releaseMobileDevice(id);
        toast.success('设备已归还');
        fetchBorrows();
      } catch (error) {
        toast.error('归还设备失败');
      } finally {
        setReleasing(null);
      }
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '——';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRemainingTime = (remainingMs) => {
    if (remainingMs <= 0) return { text: '已到期', color: '#FF3B30' };
    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const isWarning = remainingMs < 24 * 60 * 60 * 1000;
    let text = '';
    if (days > 0) text = `${days}天${hours}小时`;
    else if (hours > 0) text = `${hours}小时${minutes}分钟`;
    else text = `${minutes}分钟`;
    return { text, color: isWarning ? '#FF9500' : '#34C759' };
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <span>加载中...</span>
      </div>
    );
  }

  const allBorrows = [
    ...posBorrows.map((b) => ({ ...b, key: `pos-${b.merchantId}`, type: 'pos' })),
    ...mobileBorrows.map((b) => ({ ...b, key: `mobile-${b.deviceId}`, type: 'mobile' })),
  ];

  if (allBorrows.length === 0) {
    return (
      <div style={styles.empty}>
        <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
          <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
        </svg>
        <p>您当前没有借用任何设备</p>
      </div>
    );
  }

  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>设备类型</th>
            <th style={styles.th}>设备名称</th>
            <th style={styles.th}>借用目的</th>
            <th style={styles.th}>借用时间</th>
            <th style={styles.th}>应归还时间</th>
            <th style={styles.th}>剩余时间</th>
            <th style={styles.th}>操作</th>
          </tr>
        </thead>
        <tbody>
          {allBorrows.map((item) => {
            const remaining = getRemainingTime(item.remainingMs);
            const isReleasing = releasing === item.key;
            return (
              <tr key={item.key} style={styles.tr}>
                <td style={styles.td}>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: item.type === 'pos' ? 'rgba(255, 149, 0, 0.12)' : 'rgba(52, 199, 89, 0.12)',
                    color: item.type === 'pos' ? '#FF9500' : '#34C759',
                  }}>
                    {item.type === 'pos' ? 'POS' : '移动'}
                  </span>
                </td>
                <td style={{ ...styles.td, fontWeight: '500' }}>{item.deviceName}</td>
                <td style={styles.td}>{item.purpose || '——'}</td>
                <td style={styles.td}>{formatTime(item.startTime)}</td>
                <td style={styles.td}>{formatTime(item.endTime)}</td>
                <td style={styles.td}>
                  <span style={{ color: remaining.color, fontWeight: '500' }}>
                    {remaining.text}
                  </span>
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => item.type === 'pos' ? handleReleasePos(item.merchantId) : handleReleaseMobile(item.deviceId)}
                    disabled={isReleasing}
                    style={{
                      ...styles.btnReturn,
                      opacity: isReleasing ? 0.5 : 1,
                    }}
                  >
                    {isReleasing ? '归还中...' : '归还'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认归还"
        message="确定要归还此设备吗？"
        onConfirm={confirmRelease}
        onCancel={() => setConfirmDialog({ show: false, type: null, id: null })}
        confirmText="归还"
      />
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
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#86868B',
    backgroundColor: '#F9F9F9',
    borderBottom: '1px solid #E5E5EA',
  },
  tr: {
    borderBottom: '1px solid #F2F2F7',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#1D1D1F',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  btnReturn: {
    padding: '6px 14px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
};

export default MyBorrowsTab;
