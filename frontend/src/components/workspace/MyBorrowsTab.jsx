import React, { useEffect, useState } from 'react';
import { getMyBorrows, releaseDevice, releaseMobileDevice } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../ConfirmDialog';
import Button from '../ui/Button';
import SectionGroup from '../ui/SectionGroup';
import StatusBadge from '../ui/StatusBadge';

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
      console.error('Failed to load borrows:', error);
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
      return;
    }

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

  const getRemainingTime = (remainingMs) => {
    if (remainingMs <= 0) return { text: '已到期', tone: 'danger' };

    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const warning = remainingMs < 24 * 60 * 60 * 1000;

    let text = '';
    if (days > 0) {
      text = `${days}天 ${hours}小时`;
    } else if (hours > 0) {
      text = `${hours}小时 ${minutes}分钟`;
    } else {
      text = `${minutes}分钟`;
    }

    return { text, tone: warning ? 'warning' : 'success' };
  };

  const allBorrows = [
    ...posBorrows.map((item) => ({ ...item, key: `pos-${item.merchantId}`, type: 'pos' })),
    ...mobileBorrows.map((item) => ({ ...item, key: `mobile-${item.deviceId}`, type: 'mobile' })),
  ];

  return (
    <SectionGroup
      title="我的借用"
      description="查看您当前正在借用的设备、剩余时间与归还操作。"
      extra={<StatusBadge tone="info">{`${allBorrows.length} 台设备`}</StatusBadge>}
    >
      {loading ? (
        <div style={styles.state}>Loading...</div>
      ) : allBorrows.length === 0 ? (
        <div style={styles.state}>您当前没有借用任何设备</div>
      ) : (
        <div style={styles.list}>
          {allBorrows.map((item) => {
            const remaining = getRemainingTime(item.remainingMs);
            const isReleasing = releasing === item.key;

            return (
              <div key={item.key} style={styles.item}>
                <div style={styles.itemHeader}>
                  <div>
                    <div style={styles.itemTitle}>{item.deviceName}</div>
                    <div style={styles.itemMeta}>{item.type === 'pos' ? 'POS' : '移动设备'}</div>
                  </div>
                  <StatusBadge tone={remaining.tone}>{remaining.text}</StatusBadge>
                </div>

                <div style={styles.detailGrid}>
                  <Detail label="借用目的" value={item.purpose || '--'} />
                  <Detail label="开始时间" value={formatTime(item.startTime)} />
                  <Detail label="应归还时间" value={formatTime(item.endTime)} />
                </div>

                <div style={styles.actions}>
                  <Button
                    variant="danger"
                    onClick={() => (item.type === 'pos' ? handleReleasePos(item.merchantId) : handleReleaseMobile(item.deviceId))}
                    loading={isReleasing}
                  >
                    {isReleasing ? '归还中...' : '归还'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认归还"
        message="确定要归还此设备吗？"
        onConfirm={confirmRelease}
        onCancel={() => setConfirmDialog({ show: false, type: null, id: null })}
        confirmText="归还"
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

export default MyBorrowsTab;

