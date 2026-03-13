import React, { useEffect, useState } from 'react';
import { borrowAPI, deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmDialog from '../ConfirmDialog';

const BORROW_BADGE_STYLES = {
  pos: { backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#FF9500', label: 'POS借用' },
  mobile: { backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759', label: '移动借用' },
};

const PendingApprovalsTab = () => {
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, payload: null });

  const fetchBorrowRequests = async () => {
    setBorrowLoading(true);
    try {
      const result = await borrowAPI.list({ scope: 'approvals', status: 'pending' });
      if (result.success) {
        setBorrowRequests(result.data?.requests || []);
      }
    } catch (error) {
      console.error('Failed to load pending borrow requests:', error);
    } finally {
      setBorrowLoading(false);
    }
  };

  const fetchClaims = async () => {
    if (!isAdmin()) {
      setClaims([]);
      return;
    }

    setClaimsLoading(true);
    try {
      const result = await deviceAPI.getClaims('pending');
      if (result.success) {
        setClaims(result.data?.claims || result.claims || []);
      }
    } catch (error) {
      console.error('Failed to load pending claims:', error);
    } finally {
      setClaimsLoading(false);
    }
  };

  useEffect(() => {
    fetchBorrowRequests();
    fetchClaims();
  }, []);

  const removeBorrowRequest = (requestId) => {
    setBorrowRequests((prev) => prev.filter((item) => item.id !== requestId));
  };

  const handleApproveBorrow = async (request) => {
    const requestKey = `borrow-${request.id}`;
    if (processingId === requestKey) {
      return;
    }

    setProcessingId(requestKey);
    try {
      const result = await borrowAPI.approve(request.id);
      if (result.success) {
        toast.success(result.message || '审批已通过，设备已借出');
        removeBorrowRequest(request.id);
      } else {
        toast.error(result.error || '审批失败');
        fetchBorrowRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '审批失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectBorrow = (request) => {
    setConfirmDialog({ show: true, type: 'borrow', payload: request });
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
        toast.success(result.message || '认领审批已通过');
        setClaims((prev) => prev.filter((item) => item.id !== claim.id));
      } else {
        toast.error(result.error || '审批失败');
        fetchClaims();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '审批失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClaim = (claim) => {
    setConfirmDialog({ show: true, type: 'claim', payload: claim });
  };

  const confirmReject = async (reason = '') => {
    const { type, payload } = confirmDialog;
    setConfirmDialog({ show: false, type: null, payload: null });

    if (!payload) {
      return;
    }

    const actionKey = `${type}-${payload.id}`;
    if (processingId === actionKey) {
      return;
    }

    setProcessingId(actionKey);

    try {
      if (type === 'borrow') {
        const result = await borrowAPI.reject(payload.id, reason);
        if (result.success) {
          toast.success(result.message || '借用申请已拒绝');
          removeBorrowRequest(payload.id);
        } else {
          toast.error(result.error || '审批失败');
          fetchBorrowRequests();
        }
        return;
      }

      const result = await deviceAPI.rejectClaim(payload.id);
      if (result.success) {
        toast.success(result.message || '认领申请已拒绝');
        setClaims((prev) => prev.filter((item) => item.id !== payload.id));
      } else {
        toast.error(result.error || '审批失败');
        fetchClaims();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '审批失败');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) {
      return '--';
    }

    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLoading = borrowLoading || claimsLoading;
  const totalCount = borrowRequests.length + claims.length;

  return (
    <div>
      <div style={styles.statsCard}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalCount}</span>
          <span style={styles.statLabel}>待处理审批</span>
        </div>
      </div>

      {isLoading ? (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <span>加载中...</span>
        </div>
      ) : totalCount === 0 ? (
        <div style={styles.empty}>
          <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" />
          </svg>
          <p>暂无待审批的申请</p>
        </div>
      ) : (
        <div style={styles.list}>
          {isAdmin() && claims.map((claim) => (
            <div key={`claim-${claim.id}`} style={styles.requestItem}>
              <div style={styles.requestHeader}>
                <span style={{ ...styles.typeBadge, backgroundColor: 'rgba(88, 86, 214, 0.12)', color: '#5856D6' }}>
                  设备认领
                </span>
                <span style={styles.deviceName}>{claim.deviceName || claim.merchantId}</span>
              </div>
              <div style={styles.requestInfo}>
                <span style={styles.userInfo}>{claim.username}</span>
                <span style={styles.timeInfo}>{formatTime(claim.createdAt)}</span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => handleApproveClaim(claim)}
                  disabled={processingId === `claim-${claim.id}`}
                  style={processingId === `claim-${claim.id}` ? { ...styles.btnApprove, opacity: 0.5 } : styles.btnApprove}
                >
                  {processingId === `claim-${claim.id}` ? '处理中...' : '通过'}
                </button>
                <button
                  onClick={() => handleRejectClaim(claim)}
                  disabled={processingId === `claim-${claim.id}`}
                  style={processingId === `claim-${claim.id}` ? { ...styles.btnReject, opacity: 0.5 } : styles.btnReject}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}

          {borrowRequests.map((request) => {
            const badgeStyle = BORROW_BADGE_STYLES[request.asset_type] || BORROW_BADGE_STYLES.mobile;
            const actionKey = `borrow-${request.id}`;
            return (
              <div key={`borrow-${request.id}`} style={styles.requestItem}>
                <div style={styles.requestHeader}>
                  <span style={{ ...styles.typeBadge, ...badgeStyle }}>
                    {badgeStyle.label}
                  </span>
                  <span style={styles.deviceName}>{request.device_name || request.merchant_id || `#${request.asset_id}`}</span>
                </div>
                <div style={styles.requestInfo}>
                  <span style={styles.userInfo}>{request.requester_name || `用户 #${request.requester_id}`}</span>
                  <span style={styles.timeInfo}>归还: {formatTime(request.end_time)}</span>
                </div>
                {request.purpose && (
                  <div style={styles.purpose}>{request.purpose}</div>
                )}
                <div style={styles.actions}>
                  <button
                    onClick={() => handleApproveBorrow(request)}
                    disabled={processingId === actionKey}
                    style={processingId === actionKey ? { ...styles.btnApprove, opacity: 0.5 } : styles.btnApprove}
                  >
                    {processingId === actionKey ? '处理中...' : '通过'}
                  </button>
                  <button
                    onClick={() => handleRejectBorrow(request)}
                    disabled={processingId === actionKey}
                    style={processingId === actionKey ? { ...styles.btnReject, opacity: 0.5 } : styles.btnReject}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title="确认拒绝"
        message={confirmDialog.type === 'claim' ? '确认拒绝这条认领申请吗？' : '确认拒绝这条借用申请吗？'}
        showInput={true}
        inputLabel="拒绝原因（选填）"
        inputPlaceholder="请输入拒绝原因"
        onConfirmWithInput={confirmReject}
        onConfirm={() => confirmReject('')}
        onCancel={() => setConfirmDialog({ show: false, type: null, payload: null })}
        confirmText="拒绝"
      />
    </div>
  );
};

const styles = {
  statsCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    marginBottom: '16px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: '14px',
    color: '#86868B',
  },
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
    color: '#34C759',
    marginBottom: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  requestItem: {
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  requestHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  deviceName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  requestInfo: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#666',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  timeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  purpose: {
    fontSize: '13px',
    color: '#4A4A4F',
    lineHeight: 1.5,
    marginBottom: '12px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  btnApprove: {
    padding: '6px 16px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  btnReject: {
    padding: '6px 16px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
};

export default PendingApprovalsTab;
