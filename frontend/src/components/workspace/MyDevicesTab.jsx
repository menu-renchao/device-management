import React, { useEffect, useState } from 'react';
import { getMyDevices, releaseDevice, releaseMobileDevice } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../ConfirmDialog';
import Button from '../ui/Button';
import SectionGroup from '../ui/SectionGroup';
import SegmentedControl from '../ui/SegmentedControl';
import StatusBadge from '../ui/StatusBadge';

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
      console.error('Failed to load devices:', error);
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
      return;
    }

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

  const getPurposeText = (purpose) => {
    if (purpose === null || purpose === undefined) return '';
    if (typeof purpose === 'string') return purpose.trim();
    if (typeof purpose === 'object') {
      if (typeof purpose.String === 'string') return purpose.String.trim();
      if (typeof purpose.value === 'string') return purpose.value.trim();
    }
    return String(purpose).trim();
  };

  const totalPending =
    posDevices.reduce((sum, device) => sum + (device.pendingBorrowCount || 0), 0) +
    mobileDevices.reduce((sum, device) => sum + (device.pendingBorrowCount || 0), 0);

  const currentDevices = activeSubTab === 'pos' ? posDevices : mobileDevices;

  return (
    <SectionGroup
      title="我的设备"
      description="查看您当前负责的设备、占用状态和待审核借用请求。"
      extra={
        <SegmentedControl
          options={[
            { value: 'pos', label: `POS (${posDevices.length})` },
            { value: 'mobile', label: `移动 (${mobileDevices.length})` },
          ]}
          value={activeSubTab}
          onChange={setActiveSubTab}
        />
      }
    >
      {loading ? (
        <div style={styles.state}>Loading...</div>
      ) : posDevices.length === 0 && mobileDevices.length === 0 ? (
        <div style={styles.state}>您目前不是任何设备的负责人</div>
      ) : (
        <>
          {totalPending > 0 ? (
            <div style={styles.banner}>
              <StatusBadge tone="warning">{`${totalPending} 个借用申请待审核`}</StatusBadge>
            </div>
          ) : null}

          {currentDevices.length === 0 ? (
            <div style={styles.state}>
              {activeSubTab === 'pos' ? '暂无负责的 POS 设备' : '暂无负责的移动设备'}
            </div>
          ) : (
            <div style={styles.list}>
              {currentDevices.map((device) => {
                const key = activeSubTab === 'pos' ? `pos-${device.merchantId}` : `mobile-${device.deviceId}`;
                const isReleasing = releasing === key;
                return (
                  <div key={key} style={styles.item}>
                    <div style={styles.itemHeader}>
                      <div>
                        <div style={styles.itemTitle}>{device.deviceName}</div>
                        <div style={styles.itemMeta}>
                          {activeSubTab === 'pos' ? device.merchantId || '--' : device.deviceId || '--'}
                        </div>
                      </div>
                      <div style={styles.headerBadges}>
                        <StatusBadge tone={device.isOccupied ? 'warning' : 'success'}>
                          {device.isOccupied ? '已借出' : '空闲'}
                        </StatusBadge>
                        {device.pendingBorrowCount > 0 ? (
                          <StatusBadge tone="warning">{`${device.pendingBorrowCount} 待审核`}</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">0 待审核</StatusBadge>
                        )}
                      </div>
                    </div>

                    <div style={styles.detailGrid}>
                      <Detail label="借用人" value={device.occupancy?.username || device.occupancy?.userId || '--'} />
                      <Detail label="借用目的" value={getPurposeText(device.occupancy?.purpose) || '--'} />
                      <Detail label="应归还时间" value={device.occupancy ? formatTime(device.occupancy.endTime) : '--'} />
                    </div>

                    <div style={styles.actions}>
                      {device.isOccupied ? (
                        <Button
                          variant="danger"
                          onClick={() =>
                            activeSubTab === 'pos'
                              ? handleReleasePos(device.merchantId)
                              : handleReleaseMobile(device.deviceId)
                          }
                          loading={isReleasing}
                        >
                          {isReleasing ? '释放中...' : '释放占用'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认释放"
        message="确定要释放此设备的占用吗？"
        onConfirm={confirmRelease}
        onCancel={() => setConfirmDialog({ show: false, type: null, id: null })}
        confirmText="释放"
      />
    </SectionGroup>
  );
};

const Detail = ({ label, value }) => (
  <div style={styles.detailItem}>
    <div style={styles.detailLabel}>{label}</div>
    <div style={styles.detailValue}>{value}</div>
  </div>
);

const styles = {
  state: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  banner: {
    marginBottom: '12px',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    marginBottom: '12px',
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  itemMeta: {
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  headerBadges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
  },
  detailValue: {
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  actions: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
};

export default MyDevicesTab;

