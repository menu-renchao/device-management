import React, { useEffect, useState } from 'react';
import { getMyRequests } from '../../services/api';
import SectionGroup from '../ui/SectionGroup';
import SegmentedControl from '../ui/SegmentedControl';
import StatusBadge from '../ui/StatusBadge';

const MyRequestsTab = () => {
  const [loading, setLoading] = useState(true);
  const [posRequests, setPosRequests] = useState([]);
  const [mobileRequests, setMobileRequests] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('pos');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getMyRequests();
      setPosRequests(data.posRequests || []);
      setMobileRequests(data.mobileRequests || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
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

  const getStatusTone = (status) => {
    switch (status) {
      case 'approved':
        return { tone: 'success', label: '已通过' };
      case 'rejected':
        return { tone: 'danger', label: '已拒绝' };
      case 'completed':
        return { tone: 'neutral', label: '已完成' };
      case 'pending':
      default:
        return { tone: 'warning', label: '待审核' };
    }
  };

  const currentRequests = activeSubTab === 'pos' ? posRequests : mobileRequests;

  return (
    <SectionGroup
      title="我的申请"
      description="查看当前申请的审核状态、归还时间和拒绝原因。"
      extra={
        <SegmentedControl
          options={[
            { value: 'pos', label: `POS (${posRequests.length})` },
            { value: 'mobile', label: `移动 (${mobileRequests.length})` },
          ]}
          value={activeSubTab}
          onChange={setActiveSubTab}
        />
      }
    >
      {loading ? (
        <div style={styles.state}>Loading...</div>
      ) : currentRequests.length === 0 ? (
        <div style={styles.state}>
          {activeSubTab === 'pos' ? '暂无 POS 借用申请' : '暂无移动设备借用申请'}
        </div>
      ) : (
        <div style={styles.list}>
          {currentRequests.map((request) => {
            const status = getStatusTone(request.status);
            return (
              <div key={request.id} style={styles.item}>
                <div style={styles.itemHeader}>
                  <div>
                    <div style={styles.itemTitle}>{request.deviceName}</div>
                    <div style={styles.itemMeta}>
                      {activeSubTab === 'pos' ? request.ip || '--' : '移动设备'}
                    </div>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <div style={styles.detailGrid}>
                  <Detail label="借用目的" value={request.purpose || '--'} />
                  <Detail label="预计归还" value={formatTime(request.endTime)} />
                  <Detail label="申请时间" value={formatTime(request.createdAt)} />
                  <Detail
                    label="拒绝原因"
                    value={request.status === 'rejected' && request.rejectionReason ? request.rejectionReason : '--'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
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
};

export default MyRequestsTab;

