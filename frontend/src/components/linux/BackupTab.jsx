import React, { useState, useEffect, useRef } from 'react';
import { linuxAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const BackupTab = ({ merchantId }) => {
  const toast = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadBackups();
  }, [merchantId]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const result = await linuxAPI.listBackups(merchantId);
      setBackups(result.data?.backups || []);
    } catch (error) {
      console.error('加载备份列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!(await toast.confirm('确定要创建备份吗？', {
      title: '创建备份',
      variant: 'primary',
      confirmText: '创建',
    }))) {
      return;
    }

    setCreating(true);
    try {
      const result = await linuxAPI.createBackup(merchantId);
      toast.success(result.message || '备份创建成功');
      loadBackups();
    } catch (error) {
      toast.error('创建备份失败：' + (error.response?.data?.message || error.message));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupPath) => {
    if (!(await toast.confirm(`确定要恢复备份 ${backupPath} 吗？当前数据将被覆盖。`, {
      title: '恢复备份',
      confirmText: '确认恢复',
    }))) {
      return;
    }

    setRestoring(backupPath);
    try {
      const result = await linuxAPI.restoreBackup(merchantId, backupPath);
      toast.success(result.message || '备份恢复成功');
    } catch (error) {
      toast.error('恢复备份失败：' + (error.response?.data?.message || error.message));
    } finally {
      setRestoring(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatTime = (isoString) => {
    if (!isoString) return '——';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>数据备份与恢复</h4>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          style={{
            ...styles.createBtn,
            ...(creating ? styles.disabled : {}),
          }}
        >
          {creating ? '创建中...' : '创建备份'}
        </button>
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loading}>加载中...</div>
        ) : backups.length === 0 ? (
          <div style={styles.empty}>暂无备份记录</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>备份名称</th>
                <th style={styles.tableHeader}>路径</th>
                <th style={styles.tableHeader}>大小</th>
                <th style={styles.tableHeader}>创建时间</th>
                <th style={styles.tableHeader}>操作</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={{...styles.nameCell, ...styles.tableCell}}>{backup.name}</td>
                  <td style={{...styles.pathCell, ...styles.tableCell}}>{backup.path}</td>
                  <td style={styles.tableCell}>{formatSize(backup.size)}</td>
                  <td style={{...styles.timeCell, ...styles.tableCell}}>{formatTime(backup.mod_time)}</td>
                  <td style={styles.tableCell}>
                    <button
                      onClick={() => handleRestore(backup.path)}
                      disabled={restoring === backup.path}
                      style={{
                        ...styles.restoreBtn,
                        ...(restoring === backup.path ? styles.disabled : {}),
                      }}
                    >
                      {restoring === backup.path ? '恢复中...' : '恢复'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.info}>
        <h4 style={styles.infoTitle}>注意事项</h4>
        <ul style={styles.infoList}>
          <li>创建备份会备份 /opt/menusifu/data 目录下的数据</li>
          <li>恢复备份将覆盖当前数据，请谨慎操作</li>
          <li>建议在执行升级操作前先创建备份</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  createBtn: {
    padding: '8px 18px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  tableWrap: {
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
    overflow: 'hidden',
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
  restoreBtn: {
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
  },
  info: {
    padding: '12px 16px',
    backgroundColor: '#FFF9E6',
    borderRadius: '8px',
    border: '1px solid #FFE58F',
  },
  infoTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#D48806',
    marginBottom: '8px',
  },
  infoList: {
    margin: 0,
    paddingLeft: '18px',
    fontSize: '12px',
    color: '#86868B',
    lineHeight: '1.8',
  },
};

export default BackupTab;
