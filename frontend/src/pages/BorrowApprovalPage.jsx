import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deviceAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const BorrowApprovalPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // 移动设备借用申请
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [borrowLoading, setBorrowLoading] = useState(false);

  // POS设备借用申请
  const [posBorrowRequests, setPosBorrowRequests] = useState([]);
  const [posBorrowLoading, setPosBorrowLoading] = useState(false);

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

  useEffect(() => {
    fetchBorrowRequests();
    fetchPosBorrowRequests();
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
    setConfirmDialog({ show: true, request });
  };

  const confirmReject = async (reason = '') => {
    const request = confirmDialog.request;
    setConfirmDialog({ show: false, request: null });

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

  const totalBorrowCount = borrowRequests.length + posBorrowRequests.length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>借用审核</h1>
          <p style={styles.subtitle}>审核您负责设备的借用申请</p>
        </div>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          返回首页
        </button>
      </div>

      <div style={styles.statsCard}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalBorrowCount}</span>
          <span style={styles.statLabel}>待审核申请</span>
        </div>
      </div>

      {(borrowLoading || posBorrowLoading) ? (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <span>加载中...</span>
        </div>
      ) : totalBorrowCount === 0 ? (
        <div style={styles.empty}>
          <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
          </svg>
          <p>暂无待审核的借用申请</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>设备类型</th>
                <th style={styles.th}>设备名称</th>
                <th style={styles.th}>申请人</th>
                <th style={styles.th}>用途</th>
                <th style={styles.th}>归还时间</th>
                <th style={styles.th}>申请时间</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {posBorrowRequests.map((req) => (
                <tr key={`pos-${req.id}`} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: 'rgba(255, 149, 0, 0.12)', color: '#FF9500'}}>
                      POS
                    </span>
                  </td>
                  <td style={{...styles.td, fontWeight: '500'}}>{req.deviceName}</td>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: 'rgba(0, 122, 255, 0.12)', color: '#007AFF'}}>
                      {req.username}
                    </span>
                  </td>
                  <td style={styles.td}>{req.purpose || '——'}</td>
                  <td style={styles.td}>{formatTime(req.endTime)}</td>
                  <td style={styles.td}>{formatTime(req.createdAt)}</td>
                  <td style={styles.td}>
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
                  </td>
                </tr>
              ))}
              {borrowRequests.map((req) => (
                <tr key={`mobile-${req.id}`} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: 'rgba(52, 199, 89, 0.12)', color: '#34C759'}}>
                      移动
                    </span>
                  </td>
                  <td style={{...styles.td, fontWeight: '500'}}>{req.deviceName}</td>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: 'rgba(0, 122, 255, 0.12)', color: '#007AFF'}}>
                      {req.username}
                    </span>
                  </td>
                  <td style={styles.td}>{req.purpose || '——'}</td>
                  <td style={styles.td}>{formatTime(req.endTime)}</td>
                  <td style={styles.td}>{formatTime(req.createdAt)}</td>
                  <td style={styles.td}>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#86868B',
    margin: '4px 0 0 0',
  },
  backBtn: {
    padding: '8px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  statsCard: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: '13px',
    color: '#86868B',
    marginTop: '4px',
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
  actions: {
    display: 'flex',
    gap: '8px',
  },
  btnApprove: {
    padding: '6px 14px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  btnReject: {
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
};

// 添加动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default BorrowApprovalPage;
