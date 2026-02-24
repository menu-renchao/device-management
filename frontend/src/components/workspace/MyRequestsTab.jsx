import React, { useEffect, useState } from 'react';
import { getMyRequests } from '../../services/api';

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
      console.error('获取申请列表失败:', error);
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'rgba(255, 149, 0, 0.12)', color: '#FF9500', text: '待审核' },
      approved: { bg: 'rgba(52, 199, 89, 0.12)', color: '#34C759', text: '已通过' },
      rejected: { bg: 'rgba(255, 59, 48, 0.12)', color: '#FF3B30', text: '已拒绝' },
      completed: { bg: 'rgba(142, 142, 147, 0.12)', color: '#8E8E93', text: '已完成' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span style={{ ...styles.badge, backgroundColor: config.bg, color: config.color }}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <span>加载中...</span>
      </div>
    );
  }

  const currentRequests = activeSubTab === 'pos' ? posRequests : mobileRequests;

  return (
    <div>
      <div style={styles.subTabs}>
        <button
          onClick={() => setActiveSubTab('pos')}
          style={{
            ...styles.subTab,
            ...(activeSubTab === 'pos' ? styles.activeSubTab : {}),
          }}
        >
          POS设备 ({posRequests.length})
        </button>
        <button
          onClick={() => setActiveSubTab('mobile')}
          style={{
            ...styles.subTab,
            ...(activeSubTab === 'mobile' ? styles.activeSubTab : {}),
          }}
        >
          移动设备 ({mobileRequests.length})
        </button>
      </div>

      {currentRequests.length === 0 ? (
        <div style={styles.empty}>
          <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none">
            <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z" fill="currentColor"/>
          </svg>
          <p>暂无{activeSubTab === 'pos' ? 'POS设备' : '移动设备'}借用申请</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>设备名称</th>
                {activeSubTab === 'pos' && <th style={styles.th}>IP</th>}
                <th style={styles.th}>借用目的</th>
                <th style={styles.th}>预计归还</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>拒绝原因</th>
                <th style={styles.th}>申请时间</th>
              </tr>
            </thead>
            <tbody>
              {currentRequests.map((req) => (
                <tr key={req.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{req.deviceName}</td>
                  {activeSubTab === 'pos' && <td style={styles.td}>{req.ip || '——'}</td>}
                  <td style={{ ...styles.td, ...styles.tdWrap }}>{req.purpose || '——'}</td>
                  <td style={styles.td}>{formatTime(req.endTime)}</td>
                  <td style={styles.td}>{getStatusBadge(req.status)}</td>
                  <td style={{ ...styles.td, ...styles.tdWrap }}>
                    {req.status === 'rejected' && req.rejectionReason ? (
                      <span style={{ color: '#FF3B30', whiteSpace: 'pre-wrap' }}>{req.rejectionReason}</span>
                    ) : '——'}
                  </td>
                  <td style={styles.td}>{formatTime(req.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  },
  tdWrap: {
    whiteSpace: 'pre-wrap',
    overflow: 'visible',
    textOverflow: 'clip',
    maxWidth: '200px',
    wordBreak: 'break-word',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
};

export default MyRequestsTab;
