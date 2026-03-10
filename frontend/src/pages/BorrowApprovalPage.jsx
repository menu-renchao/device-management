import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import SectionGroup from '../components/ui/SectionGroup';
import StatusBadge from '../components/ui/StatusBadge';
import { useToast } from '../contexts/ToastContext';
import { deviceAPI } from '../services/api';

const BorrowApprovalPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [posBorrowRequests, setPosBorrowRequests] = useState([]);
  const [posBorrowLoading, setPosBorrowLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, request: null });

  useEffect(() => {
    fetchBorrowRequests();
    fetchPosBorrowRequests();
  }, []);

  const fetchBorrowRequests = async () => {
    setBorrowLoading(true);
    try {
      const result = await deviceAPI.getBorrowRequests('pending');
      if (result.success) {
        const requests = (result.data?.requests || result.requests || []).map((request) => ({ ...request, type: 'mobile' }));
        setBorrowRequests(requests);
      }
    } catch (error) {
      console.error('Failed to load mobile borrow requests:', error);
    } finally {
      setBorrowLoading(false);
    }
  };

  const fetchPosBorrowRequests = async () => {
    setPosBorrowLoading(true);
    try {
      const result = await deviceAPI.getPosBorrowRequests('pending');
      if (result.success) {
        const requests = (result.data?.requests || result.requests || []).map((request) => ({ ...request, type: 'pos' }));
        setPosBorrowRequests(requests);
      }
    } catch (error) {
      console.error('Failed to load POS borrow requests:', error);
    } finally {
      setPosBorrowLoading(false);
    }
  };

  const handleApproveBorrow = async (request) => {
    const requestKey = `${request.type}-${request.id}`;
    if (processingId === requestKey) {
      return;
    }

    setProcessingId(requestKey);
    try {
      const result = request.type === 'pos'
        ? await deviceAPI.approvePosBorrowRequest(request.id)
        : await deviceAPI.approveBorrowRequest(request.id);

      if (result.success) {
        toast.success(result.message || '审核通过，设备已借出');
        if (request.type === 'pos') {
          setPosBorrowRequests((previous) => previous.filter((item) => item.id !== request.id));
        } else {
          setBorrowRequests((previous) => previous.filter((item) => item.id !== request.id));
        }
      } else {
        toast.error(result.error || '操作失败');
        fetchBorrowRequests();
        fetchPosBorrowRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectBorrow = (request) => {
    setConfirmDialog({ show: true, request });
  };

  const confirmReject = async (reason = '') => {
    const request = confirmDialog.request;
    setConfirmDialog({ show: false, request: null });

    const requestKey = `${request.type}-${request.id}`;
    if (processingId === requestKey) {
      return;
    }

    setProcessingId(requestKey);
    try {
      const result = request.type === 'pos'
        ? await deviceAPI.rejectPosBorrowRequest(request.id, reason)
        : await deviceAPI.rejectBorrowRequest(request.id, reason);

      if (result.success) {
        toast.success(result.message || '已拒绝');
        if (request.type === 'pos') {
          setPosBorrowRequests((previous) => previous.filter((item) => item.id !== request.id));
        } else {
          setBorrowRequests((previous) => previous.filter((item) => item.id !== request.id));
        }
      } else {
        toast.error(result.error || '操作失败');
        fetchBorrowRequests();
        fetchPosBorrowRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    } finally {
      setProcessingId(null);
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

  const totalBorrowCount = borrowRequests.length + posBorrowRequests.length;
  const isLoading = borrowLoading || posBorrowLoading;
  const allRequests = [
    ...posBorrowRequests.map((request) => ({ ...request, typeLabel: 'POS', tone: 'warning' })),
    ...borrowRequests.map((request) => ({ ...request, typeLabel: '移动', tone: 'success' })),
  ];

  return (
    <PageShell
      eyebrow="Approvals"
      title="借用审核"
      subtitle="审核您负责设备的借用申请，保持快速决策的操作密度。"
      actions={<Button variant="secondary" onClick={() => navigate('/')}>返回首页</Button>}
    >
      <SectionGroup
        title="待审核列表"
        description="合并展示 POS 与移动设备借用申请，减少页面跳转和心智切换。"
        extra={<StatusBadge tone={totalBorrowCount > 0 ? 'warning' : 'neutral'}>{`${totalBorrowCount} 个申请`}</StatusBadge>}
      >
        {isLoading ? (
          <div style={styles.state}>Loading...</div>
        ) : totalBorrowCount === 0 ? (
          <div style={styles.state}>暂无待审核的借用申请</div>
        ) : (
          <div style={styles.list}>
            {allRequests.map((request) => {
              const requestKey = `${request.type}-${request.id}`;
              const processing = processingId === requestKey;
              return (
                <div key={requestKey} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.cardTitleRow}>
                        <StatusBadge tone={request.tone}>{request.typeLabel}</StatusBadge>
                        <div style={styles.cardTitle}>{request.deviceName}</div>
                      </div>
                      <div style={styles.cardMeta}>{request.username}</div>
                    </div>
                    <div style={styles.actions}>
                      <Button variant="primary" onClick={() => handleApproveBorrow(request)} loading={processing}>
                        {processing ? '处理中...' : '通过'}
                      </Button>
                      <Button variant="danger" onClick={() => handleRejectBorrow(request)} disabled={processing}>拒绝</Button>
                    </div>
                  </div>
                  <div style={styles.detailGrid}>
                    <Detail label="申请类型" value={request.typeLabel} />
                    <Detail label="用途" value={request.purpose || '--'} />
                    <Detail label="归还时间" value={formatTime(request.endTime)} />
                    <Detail label="申请时间" value={formatTime(request.createdAt)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionGroup>

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认拒绝"
        message="确定要拒绝此借用申请吗？"
        showInput={true}
        inputLabel="拒绝原因（选填）"
        inputPlaceholder="请输入拒绝原因..."
        onConfirmWithInput={confirmReject}
        onCancel={() => setConfirmDialog({ show: false, request: null })}
        confirmText="拒绝"
      />
    </PageShell>
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
    gap: '12px',
  },
  card: {
    padding: '16px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  cardMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
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

export default BorrowApprovalPage;

