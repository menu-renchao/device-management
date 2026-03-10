import React, { useEffect, useState } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmDialog from '../ConfirmDialog';
import Button from '../ui/Button';
import SectionGroup from '../ui/SectionGroup';
import StatusBadge from '../ui/StatusBadge';

const PendingApprovalsTab = () => {
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [posBorrowRequests, setPosBorrowRequests] = useState([]);
  const [posBorrowLoading, setPosBorrowLoading] = useState(false);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, request: null, type: null });

  useEffect(() => {
    fetchBorrowRequests();
    fetchPosBorrowRequests();
    fetchClaims();
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

  const fetchClaims = async () => {
    if (!isAdmin()) {
      return;
    }

    setClaimsLoading(true);
    try {
      const result = await deviceAPI.getClaims('pending');
      if (result.success) {
        setClaims(result.data?.claims || result.claims || []);
      }
    } catch (error) {
      console.error('Failed to load claim requests:', error);
    } finally {
      setClaimsLoading(false);
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

  const handleRejectBorrow = async (request) => {
    setConfirmDialog({ show: true, request, type: 'borrow' });
  };

  const handleApproveClaim = async (claim) => {
    const claimKey = `claim-${claim.id}`;
    if (processingId === claimKey) {
      return;
    }

    setProcessingId(claimKey);
    try {
      const result = await deviceAPI.approveClaim(claim.id);
      if (result.success) {
        toast.success(result.message || '认领审核通过');
        setClaims((previous) => previous.filter((item) => item.id !== claim.id));
      } else {
        toast.error(result.error || '操作失败');
        fetchClaims();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClaim = async (claim) => {
    setConfirmDialog({ show: true, request: claim, type: 'claim' });
  };

  const confirmReject = async (reason = '') => {
    const request = confirmDialog.request;
    const type = confirmDialog.type;
    setConfirmDialog({ show: false, request: null, type: null });

    if (type === 'borrow') {
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
      return;
    }

    if (type === 'claim') {
      const claimKey = `claim-${request.id}`;
      if (processingId === claimKey) {
        return;
      }

      setProcessingId(claimKey);
      try {
        const result = await deviceAPI.rejectClaim(request.id);
        if (result.success) {
          toast.success(result.message || '已拒绝认领申请');
          setClaims((previous) => previous.filter((item) => item.id !== request.id));
        } else {
          toast.error(result.error || '操作失败');
          fetchClaims();
        }
      } catch (error) {
        toast.error(error.response?.data?.error || '操作失败');
      } finally {
        setProcessingId(null);
      }
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

  const isLoading = borrowLoading || posBorrowLoading || claimsLoading;
  const totalBorrowCount = borrowRequests.length + posBorrowRequests.length;
  const totalCount = totalBorrowCount + claims.length;

  return (
    <SectionGroup
      title="待我审核"
      description="在一个分组里处理借用申请、 POS 申请和认领申请。"
      extra={<StatusBadge tone={totalCount > 0 ? 'warning' : 'neutral'}>{`${totalCount} 个待处理`}</StatusBadge>}
    >
      {isLoading ? (
        <div style={styles.state}>Loading...</div>
      ) : totalCount === 0 ? (
        <div style={styles.state}>暂无待审核的申请</div>
      ) : (
        <div style={styles.groupList}>
          {isAdmin() && claims.length > 0 ? (
            <ApprovalBucket title="认领申请" tone="info">
              {claims.map((claim) => {
                const currentProcessing = processingId === `claim-${claim.id}`;
                return (
                  <ApprovalCard
                    key={`claim-${claim.id}`}
                    tone="info"
                    typeLabel="认领"
                    title={claim.deviceName || claim.merchantId}
                    metaLeft={claim.username}
                    metaRight={formatTime(claim.createdAt)}
                    processing={currentProcessing}
                    onApprove={() => handleApproveClaim(claim)}
                    onReject={() => handleRejectClaim(claim)}
                  />
                );
              })}
            </ApprovalBucket>
          ) : null}

          {posBorrowRequests.length > 0 ? (
            <ApprovalBucket title="POS 借用申请" tone="warning">
              {posBorrowRequests.map((request) => {
                const currentProcessing = processingId === `pos-${request.id}`;
                return (
                  <ApprovalCard
                    key={`pos-${request.id}`}
                    tone="warning"
                    typeLabel="POS"
                    title={request.deviceName}
                    metaLeft={request.username}
                    metaRight={`${'归还'}: ${formatTime(request.endTime)}`}
                    processing={currentProcessing}
                    onApprove={() => handleApproveBorrow(request)}
                    onReject={() => handleRejectBorrow(request)}
                  />
                );
              })}
            </ApprovalBucket>
          ) : null}

          {borrowRequests.length > 0 ? (
            <ApprovalBucket title="移动设备借用申请" tone="success">
              {borrowRequests.map((request) => {
                const currentProcessing = processingId === `mobile-${request.id}`;
                return (
                  <ApprovalCard
                    key={`mobile-${request.id}`}
                    tone="success"
                    typeLabel="移动"
                    title={request.deviceName}
                    metaLeft={request.username}
                    metaRight={`${'归还'}: ${formatTime(request.endTime)}`}
                    processing={currentProcessing}
                    onApprove={() => handleApproveBorrow(request)}
                    onReject={() => handleRejectBorrow(request)}
                  />
                );
              })}
            </ApprovalBucket>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认拒绝"
        message={confirmDialog.type === 'borrow' ? '确定要拒绝此借用申请吗？' : '确定要拒绝此认领申请吗？'}
        showInput={true}
        inputLabel="拒绝原因（选填）"
        inputPlaceholder="请输入拒绝原因..."
        onConfirmWithInput={confirmReject}
        onConfirm={() => confirmReject('')}
        onCancel={() => setConfirmDialog({ show: false, request: null, type: null })}
        confirmText="拒绝"
      />
    </SectionGroup>
  );
};

const ApprovalBucket = ({ title, tone, children }) => (
  <div style={styles.bucket}>
    <div style={styles.bucketHeader}>
      <div style={styles.bucketTitle}>{title}</div>
      <StatusBadge tone={tone}>{title}</StatusBadge>
    </div>
    <div style={styles.bucketList}>{children}</div>
  </div>
);

const ApprovalCard = ({ tone, typeLabel, title, metaLeft, metaRight, onApprove, onReject, processing }) => (
  <div style={styles.card}>
    <div style={styles.cardHeader}>
      <div>
        <div style={styles.cardTitleRow}>
          <StatusBadge tone={tone}>{typeLabel}</StatusBadge>
          <div style={styles.cardTitle}>{title}</div>
        </div>
        <div style={styles.cardMeta}>{metaLeft}</div>
        <div style={styles.cardMeta}>{metaRight}</div>
      </div>
      <div style={styles.cardActions}>
        <Button variant="primary" onClick={onApprove} loading={processing}>
          {processing ? '处理中...' : '通过'}
        </Button>
        <Button variant="danger" onClick={onReject} disabled={processing}>
          拒绝
        </Button>
      </div>
    </div>
  </div>
);

const styles = {
  state: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  groupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  bucket: {
    padding: '14px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  bucketHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
    marginBottom: '12px',
  },
  bucketTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  bucketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    padding: '14px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
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
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
};

export default PendingApprovalsTab;

