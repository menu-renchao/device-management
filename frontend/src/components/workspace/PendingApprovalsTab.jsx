import React, { useState, useEffect } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmDialog from '../ConfirmDialog';

const PendingApprovalsTab = () => {
  const toast = useToast();
  const { isAdmin } = useAuth();

  // 移动设备借用申请
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);

  // POS设备借用申请
  const [posBorrowRequests, setPosBorrowRequests] = useState([]);
  const [posBorrowLoading, setPosBorrowLoading] = useState(false);

  // 认领申请（仅管理员可见）
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  // 审核处理中状态
  const [processingId, setProcessingId] = useState(null);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState({ show: false, request: null });

  const fetchBorrowRequests = async () => {
    setBorrowLoading(true);
    try {
      const result = await deviceAPI.getBorrowRequests('pending');
      if (result.success) {
        const requests = (result.data?.requests || result.requests || []).map(r => ({...r, type: 'mobile'}));
        setBorrowRequests(requests);
      }
    } catch (err) {
      console.error('获取借用申请失败:', err);
    } finally {
      setBorrowLoading(false);
    }
  };

  const fetchPosBorrowRequests = async () => {
    setPosBorrowLoading(true);
    try {
      const result = await deviceAPI.getPosBorrowRequests('pending');
      if (result.success) {
        const requests = (result.data?.requests || result.requests || []).map(r => ({...r, type: 'pos'}));
        setPosBorrowRequests(requests);
      }
    } catch (err) {
      console.error('获取POS借用申请失败:', err);
    } finally {
      setPosBorrowLoading(false);
    }
  };

  const fetchClaims = async () => {
    if (!isAdmin()) return;
    setClaimsLoading(true);
    try {
      const result = await deviceAPI.getClaims('pending');
      if (result.success) {
        setClaims(result.data?.claims || result.claims || []);
      }
    } catch (err) {
      console.error('获取认领申请失败:', err);
    } finally {
      setClaimsLoading(false);
    }
  };

  useEffect(() => {
    fetchBorrowRequests();
    fetchPosBorrowRequests();
    fetchClaims();
  }, []);

  const handleApproveBorrow = async (request) => {
    const requestKey = `${request.type}-${request.id}`;
    if (processingId === requestKey) return;
    setProcessingId(requestKey);

    try {
      let result;
      if (request.type === 'pos') {
        result = await deviceAPI.approvePosBorrowRequest(request.id);
      } else {
        result = await deviceAPI.approveBorrowRequest(request.id);
      }
      if (result.success) {
        toast.success(result.message || '审核通过，设备已借出');
        if (request.type === 'pos') {
          setPosBorrowRequests(prev => prev.filter(r => r.id !== request.id));
        } else {
          setBorrowRequests(prev => prev.filter(r => r.id !== request.id));
        }
      } else {
        toast.error(result.error || '操作失败');
        fetchBorrowRequests();
        fetchPosBorrowRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || '操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectBorrow = async (request) => {
    setConfirmDialog({ show: true, request, type: 'borrow' });
  };

  const handleApproveClaim = async (claim) => {
    const claimKey = `claim-${claim.id}`;
    if (processingId === claimKey) return;
    setProcessingId(claimKey);

    try {
      const result = await deviceAPI.approveClaim(claim.id);
      if (result.success) {
        toast.success(result.message || '认领审核通过');
        setClaims(prev => prev.filter(c => c.id !== claim.id));
      } else {
        toast.error(result.error || '操作失败');
        fetchClaims();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || '操作失败');
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
      if (processingId === requestKey) return;
      setProcessingId(requestKey);

      try {
        let result;
        if (request.type === 'pos') {
          result = await deviceAPI.rejectPosBorrowRequest(request.id, reason);
        } else {
          result = await deviceAPI.rejectBorrowRequest(request.id, reason);
        }
        if (result.success) {
          toast.success(result.message || '已拒绝');
          if (request.type === 'pos') {
            setPosBorrowRequests(prev => prev.filter(r => r.id !== request.id));
          } else {
            setBorrowRequests(prev => prev.filter(r => r.id !== request.id));
          }
        } else {
          toast.error(result.error || '操作失败');
          fetchBorrowRequests();
          fetchPosBorrowRequests();
        }
      } catch (err) {
        toast.error(err.response?.data?.error || '操作失败');
      } finally {
        setProcessingId(null);
      }
    } else if (type === 'claim') {
      const claimKey = `claim-${request.id}`;
      if (processingId === claimKey) return;
      setProcessingId(claimKey);

      try {
        const result = await deviceAPI.rejectClaim(request.id);
        if (result.success) {
          toast.success(result.message || '已拒绝认领申请');
          setClaims(prev => prev.filter(c => c.id !== request.id));
        } else {
          toast.error(result.error || '操作失败');
          fetchClaims();
        }
      } catch (err) {
        toast.error(err.response?.data?.error || '操作失败');
      } finally {
        setProcessingId(null);
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

  const isLoading = borrowLoading || posBorrowLoading || claimsLoading;
  const totalBorrowCount = borrowRequests.length + posBorrowRequests.length;
  const totalCount = totalBorrowCount + claims.length;

  return (
    <div>
      {/* 统计卡片 */}
      <div style={styles.statsCard}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalCount}</span>
          <span style={styles.statLabel}>待审核申请</span>
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
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
          </svg>
          <p>暂无待审核的申请</p>
        </div>
      ) : (
        <div style={styles.list}>
          {/* 认领申请（仅管理员可见） */}
          {isAdmin() && claims.map((claim) => (
            <div key={`claim-${claim.id}`} style={styles.requestItem}>
              <div style={styles.requestHeader}>
                <span style={{...styles.typeBadge, backgroundColor: 'rgba(88, 86, 214, 0.12)', color: '#5856D6'}}>
                  认领
                </span>
                <span style={styles.deviceName}>{claim.deviceName || claim.merchantId}</span>
              </div>
              <div style={styles.requestInfo}>
                <span style={styles.userInfo}>
                  <svg style={styles.userIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                  </svg>
                  {claim.username}
                </span>
                <span style={styles.timeInfo}>
                  <svg style={styles.timeIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor"/>
                  </svg>
                  {formatTime(claim.createdAt)}
                </span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => handleApproveClaim(claim)}
                  disabled={processingId === `claim-${claim.id}`}
                  style={processingId === `claim-${claim.id}` ? {...styles.btnApprove, opacity: 0.5} : styles.btnApprove}
                >
                  {processingId === `claim-${claim.id}` ? '处理中...' : '通过'}
                </button>
                <button
                  onClick={() => handleRejectClaim(claim)}
                  disabled={processingId === `claim-${claim.id}`}
                  style={processingId === `claim-${claim.id}` ? {...styles.btnReject, opacity: 0.5} : styles.btnReject}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}

          {/* POS设备借用申请 */}
          {posBorrowRequests.map((req) => (
            <div key={`pos-${req.id}`} style={styles.requestItem}>
              <div style={styles.requestHeader}>
                <span style={{...styles.typeBadge, backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#FF9500'}}>
                  POS借用
                </span>
                <span style={styles.deviceName}>{req.deviceName}</span>
              </div>
              <div style={styles.requestInfo}>
                <span style={styles.userInfo}>
                  <svg style={styles.userIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                  </svg>
                  {req.username}
                </span>
                <span style={styles.timeInfo}>
                  <svg style={styles.timeIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor"/>
                  </svg>
                  归还: {formatTime(req.endTime)}
                </span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => handleApproveBorrow(req)}
                  disabled={processingId === `pos-${req.id}`}
                  style={processingId === `pos-${req.id}` ? {...styles.btnApprove, opacity: 0.5} : styles.btnApprove}
                >
                  {processingId === `pos-${req.id}` ? '处理中...' : '通过'}
                </button>
                <button
                  onClick={() => handleRejectBorrow(req)}
                  disabled={processingId === `pos-${req.id}`}
                  style={processingId === `pos-${req.id}` ? {...styles.btnReject, opacity: 0.5} : styles.btnReject}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}

          {/* 移动设备借用申请 */}
          {borrowRequests.map((req) => (
            <div key={`mobile-${req.id}`} style={styles.requestItem}>
              <div style={styles.requestHeader}>
                <span style={{...styles.typeBadge, backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759'}}>
                  移动借用
                </span>
                <span style={styles.deviceName}>{req.deviceName}</span>
              </div>
              <div style={styles.requestInfo}>
                <span style={styles.userInfo}>
                  <svg style={styles.userIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                  </svg>
                  {req.username}
                </span>
                <span style={styles.timeInfo}>
                  <svg style={styles.timeIcon} viewBox="0 0 24 24" fill="none">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor"/>
                  </svg>
                  归还: {formatTime(req.endTime)}
                </span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => handleApproveBorrow(req)}
                  disabled={processingId === `mobile-${req.id}`}
                  style={processingId === `mobile-${req.id}` ? {...styles.btnApprove, opacity: 0.5} : styles.btnApprove}
                >
                  {processingId === `mobile-${req.id}` ? '处理中...' : '通过'}
                </button>
                <button
                  onClick={() => handleRejectBorrow(req)}
                  disabled={processingId === `mobile-${req.id}`}
                  style={processingId === `mobile-${req.id}` ? {...styles.btnReject, opacity: 0.5} : styles.btnReject}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
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
  userIcon: {
    width: '14px',
    height: '14px',
    color: '#86868B',
  },
  timeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  timeIcon: {
    width: '14px',
    height: '14px',
    color: '#86868B',
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
