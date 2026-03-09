import React, { useState, useEffect, useRef } from 'react';
import { linuxAPI } from '../../services/api';

const LogTab = ({ merchantId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [showRealtime, setShowRealtime] = useState(false);
  const [realtimeLogs, setRealtimeLogs] = useState([]);
  const wsRef = useRef(null);
  const logContainerRef = useRef(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadLogs();
  }, [merchantId]);

  useEffect(() => {
    if (logContainerRef.current && showRealtime) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [realtimeLogs, showRealtime]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await linuxAPI.listLogs(merchantId);
      setLogs(result.data?.logs || []);
    } catch (error) {
      console.error('加载日志列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLog = async (log) => {
    setSelectedLog(log);
    setLoadingContent(true);
    try {
      const result = await linuxAPI.readLogContent(merchantId, log.path, 200);
      setLogContent(result.data?.content || '');
    } catch (error) {
      setLogContent('加载失败：' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDownload = (log) => {
    const url = linuxAPI.downloadLogUrl(merchantId, log.path);
    window.open(url, '_blank');
  };

  const startRealtimeLog = (log) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setSelectedLog(log);
    setShowRealtime(true);
    setRealtimeLogs([]);

    const token = localStorage.getItem('access_token');
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/linux/logs?merchant_id=${encodeURIComponent(merchantId)}&log_path=${encodeURIComponent(log.path)}&token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket 连接已建立');
    };

    ws.onmessage = (event) => {
      setRealtimeLogs((prev) => {
        const newLogs = [...prev, event.data];
        if (newLogs.length > 1000) {
          return newLogs.slice(-1000);
        }
        return newLogs;
      });
    };

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket 连接已关闭');
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  };

  const stopRealtimeLog = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setShowRealtime(false);
    setSelectedLog(null);
    setLogContent('');
    setRealtimeLogs([]);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '——';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div style={styles.container}>
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loading}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={styles.empty}>暂无日志文件</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>日志文件</th>
                <th style={styles.tableHeader}>路径</th>
                <th style={styles.tableHeader}>大小</th>
                <th style={styles.tableHeader}>修改时间</th>
                <th style={styles.tableHeader}>操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={{...styles.nameCell, ...styles.tableCell}}>{log.name}</td>
                  <td style={{...styles.pathCell, ...styles.tableCell}}>{log.path}</td>
                  <td style={styles.tableCell}>{formatSize(log.size)}</td>
                  <td style={{...styles.timeCell, ...styles.tableCell}}>{formatTime(log.mod_time)}</td>
                  <td style={styles.tableCell}>
                    <div style={styles.actionBtns}>
                      <button onClick={() => handleViewLog(log)} style={styles.viewBtn}>查看</button>
                      <button onClick={() => startRealtimeLog(log)} style={styles.realtimeBtn}>实时</button>
                      <button onClick={() => handleDownload(log)} style={styles.downloadBtn}>下载</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLog && !showRealtime && (
        <div style={styles.logViewer}>
          <div style={styles.viewerHeader}>
            <span style={styles.viewerPath}>{selectedLog.path}</span>
            <button onClick={() => setSelectedLog(null)} style={styles.closeBtn}>关闭</button>
          </div>
          <div style={styles.viewerContent}>
            {loadingContent ? (
              <div style={styles.loading}>加载中...</div>
            ) : (
              <pre style={styles.logText}>{logContent}</pre>
            )}
          </div>
        </div>
      )}

      {showRealtime && (
        <div style={styles.logViewer}>
          <div style={styles.viewerHeader}>
            <span style={styles.viewerPath}>实时日志: {selectedLog?.path}</span>
            <div style={styles.realtimeActions}>
              <button onClick={() => setRealtimeLogs([])} style={styles.clearBtn}>清空</button>
              <button onClick={stopRealtimeLog} style={styles.closeBtn}>关闭</button>
            </div>
          </div>
          <div ref={logContainerRef} style={styles.realtimeContent}>
            {realtimeLogs.map((line, index) => (
              <div key={index} style={styles.logLine}>{line}</div>
            ))}
            {realtimeLogs.length === 0 && (
              <div style={styles.waiting}>等待日志输出...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  tableWrap: {
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
    maxHeight: '320px',
    overflow: 'auto',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#86868B',
    fontSize: '13px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#86868B',
    fontSize: '13px',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 3px',
    fontSize: '13px',
  },
  tableRow: {
    height: '40px',
  },
  tableCell: {
    padding: '6px 12px',
  },
  tableHeader: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#1D1D1F',
    fontSize: '12px',
  },
  nameCell: {
    fontWeight: '500',
    color: '#1D1D1F',
  },
  pathCell: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#86868B',
  },
  timeCell: {
    color: '#86868B',
    fontSize: '12px',
  },
  actionBtns: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  viewBtn: {
    padding: '6px 14px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
  },
  realtimeBtn: {
    padding: '6px 14px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
  },
  downloadBtn: {
    padding: '6px 14px',
    backgroundColor: '#5856D6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
  },
  logViewer: {
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  viewerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#F9F9F9',
    borderBottom: '1px solid #E5E5EA',
  },
  viewerPath: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#86868B',
  },
  closeBtn: {
    padding: '6px 16px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
  },
  clearBtn: {
    padding: '6px 16px',
    backgroundColor: '#FF9500',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    marginRight: '10px',
  },
  realtimeActions: {
    display: 'flex',
    gap: '0',
  },
  viewerContent: {
    height: '900px',
    overflow: 'auto',
    backgroundColor: '#1E1E1E',
  },
  logText: {
    margin: 0,
    padding: '12px',
    color: '#D4D4D4',
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  realtimeContent: {
    height: '900px',
    overflow: 'auto',
    backgroundColor: '#1E1E1E',
    padding: '12px',
  },
  logLine: {
    color: '#D4D4D4',
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    marginBottom: '2px',
  },
  waiting: {
    color: '#666',
    textAlign: 'center',
    padding: '20px',
    fontSize: '12px',
  },
};

export default LogTab;
