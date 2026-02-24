import React, { useEffect, useState } from 'react';
import { getMyDevices, releaseDevice, releaseMobileDevice } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../ConfirmDialog';

const MyDevicesTab = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [posDevices, setPosDevices] = useState([]);
  const [mobileDevices, setMobileDevices] = useState([]);
  const [releasing, setReleasing] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('pos');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, id: null });

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await getMyDevices();
      setPosDevices(data.posDevices || []);
      setMobileDevices(data.mobileDevices || []);
    } catch (error) {
      console.error('获取设备列表失败:', error);
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
        toast.success('设备占用已释放');
        fetchDevices();
      } catch (error) {
        toast.error('释放失败');
      } finally {
        setReleasing(null);
      }
    } else {
      setReleasing(`mobile-${id}`);
      try {
        await releaseMobileDevice(id);
        toast.success('设备占用已释放');
        fetchDevices();
      } catch (error) {
        toast.error('释放失败');
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

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <span>加载中...</span>
      </div>
    );
  }

  if (posDevices.length === 0 && mobileDevices.length === 0) {
    return (
      <div style={styles.empty}>
        <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" fill="currentColor"/>
        </svg>
        <p>您目前不是任何设备的负责人</p>
      </div>
    );
  }

  const totalPending = posDevices.reduce((sum, d) => sum + (d.pendingBorrowCount || 0), 0) +
                       mobileDevices.reduce((sum, d) => sum + (d.pendingBorrowCount || 0), 0);

  const currentDevices = activeSubTab === 'pos' ? posDevices : mobileDevices;

  return (
    <div>
      {totalPending > 0 && (
        <div style={styles.warningBanner}>
          <svg style={styles.warningIcon} viewBox="0 0 24 24" fill="none">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
          </svg>
          您有 {totalPending} 个借用申请待审核
        </div>
      )}

      <div style={styles.subTabs}>
        <button
          onClick={() => setActiveSubTab('pos')}
          style={{
            ...styles.subTab,
            ...(activeSubTab === 'pos' ? styles.activeSubTab : {}),
          }}
        >
          POS设备 ({posDevices.length})
        </button>
        <button
          onClick={() => setActiveSubTab('mobile')}
          style={{
            ...styles.subTab,
            ...(activeSubTab === 'mobile' ? styles.activeSubTab : {}),
          }}
        >
          移动设备 ({mobileDevices.length})
        </button>
      </div>

      {currentDevices.length === 0 ? (
        <div style={styles.emptySmall}>
          暂无负责的{activeSubTab === 'pos' ? 'POS' : '移动'}设备
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>设备名称</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>借用人</th>
                <th style={styles.th}>借用目的</th>
                <th style={styles.th}>应归还时间</th>
                <th style={styles.th}>待审核借用</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentDevices.map((device) => {
                const key = activeSubTab === 'pos' ? `pos-${device.merchantId}` : `mobile-${device.deviceId}`;
                const isReleasing = releasing === key;
                return (
                  <tr key={key} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{device.deviceName}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: device.isOccupied ? 'rgba(255, 149, 0, 0.12)' : 'rgba(52, 199, 89, 0.12)',
                        color: device.isOccupied ? '#FF9500' : '#34C759',
                      }}>
                        {device.isOccupied ? '已借出' : '空闲'}
                      </span>
                    </td>
                    <td style={styles.td}>{device.occupancy?.username || device.occupancy?.userId || '——'}</td>
                    <td style={styles.td}>{device.occupancy?.purpose || '——'}</td>
                    <td style={styles.td}>
                      {device.occupancy ? formatTime(device.occupancy.endTime) : '——'}
                    </td>
                    <td style={styles.td}>
                      {device.pendingBorrowCount > 0 ? (
                        <span style={{ ...styles.badge, backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#FF9500' }}>
                          {device.pendingBorrowCount} 个待审核
                        </span>
                      ) : (
                        <span style={{ ...styles.badge, backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759' }}>
                          无
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {device.isOccupied ? (
                        <button
                          onClick={() => activeSubTab === 'pos' ? handleReleasePos(device.merchantId) : handleReleaseMobile(device.deviceId)}
                          disabled={isReleasing}
                          style={{
                            ...styles.btnRelease,
                            opacity: isReleasing ? 0.5 : 1,
                          }}
                        >
                          {isReleasing ? '释放中...' : '释放占用'}
                        </button>
                      ) : '——'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认释放"
        message="确定要释放此设备的占用吗？"
        onConfirm={confirmRelease}
        onCancel={() => setConfirmDialog({ show: false, type: null, id: null })}
        confirmText="释放"
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
  emptySmall: {
    textAlign: 'center',
    padding: '40px',
    color: '#86868B',
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    color: '#C7C7CC',
    marginBottom: '12px',
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderRadius: '8px',
    color: '#FF9500',
    marginBottom: '16px',
    fontSize: '14px',
  },
  warningIcon: {
    width: '18px',
    height: '18px',
  },
  subTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  subTab: {
    padding: '6px 12px',
    border: '1px solid #E5E5EA',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#86868B',
  },
  activeSubTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    color: 'white',
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
  btnRelease: {
    padding: '6px 14px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
  },
};

export default MyDevicesTab;
