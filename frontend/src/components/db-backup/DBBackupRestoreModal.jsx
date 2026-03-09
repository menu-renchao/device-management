import React, { useEffect, useMemo, useState } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const DBBackupRestoreModal = ({ isOpen, onClose, device, initialTab = 'backup' }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState('');
  const [restoringServerFile, setRestoringServerFile] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [restoringUpload, setRestoringUpload] = useState(false);
  const [restartAfterRestore, setRestartAfterRestore] = useState(false);

  const merchantId = (device?.merchantId || '').trim();
  const isLinuxDevice = useMemo(() => {
    return (device?.type || '').toLowerCase().includes('linux');
  }, [device]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab || 'backup');
    setUploadFile(null);
    setRestartAfterRestore(false);
    if (merchantId) {
      loadBackups();
    }
  }, [isOpen, initialTab, merchantId]);

  const loadBackups = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const result = await deviceAPI.listDatabaseBackups(merchantId);
      setBackups(result.data?.items || []);
    } catch (error) {
      toast.error(error.response?.data?.error || '加载服务端备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!merchantId) {
      toast.warning('缺少商家ID，无法备份');
      return;
    }

    const ok = await toast.confirm('确定要创建数据库全量备份并保存到服务端吗？', {
      title: '创建数据备份',
      variant: 'primary',
      confirmText: '开始备份',
    });
    if (!ok) return;

    setCreating(true);
    try {
      const result = await deviceAPI.backupDatabase(merchantId);
      toast.success(result.message || '数据备份成功');
      await loadBackups();
    } catch (error) {
      toast.error(error.response?.data?.error || '数据备份失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (fileName) => {
    const ok = await toast.confirm(`确定要删除备份文件 ${fileName} 吗？此操作不可恢复。`, {
      title: '删除备份文件',
      confirmText: '删除',
    });
    if (!ok) return;

    setDeletingFile(fileName);
    try {
      const result = await deviceAPI.deleteDatabaseBackup(merchantId, fileName);
      toast.success(result.message || '备份文件删除成功');
      await loadBackups();
    } catch (error) {
      toast.error(error.response?.data?.error || '删除备份文件失败');
    } finally {
      setDeletingFile('');
    }
  };

  const handleDownloadBackup = (fileName) => {
    const url = deviceAPI.downloadDatabaseBackupUrl(merchantId, fileName);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const notifyRestoreResult = (result) => {
    const restart = result?.data?.restart;
    if (restart?.requested) {
      if (restart.success) {
        toast.success('数据恢复成功，且POS重启成功');
      } else {
        toast.warning(`数据恢复成功，重启状态：${restart.message || '已跳过'}`);
      }
      return;
    }
    toast.success(result?.message || '数据恢复成功');
  };

  const handleRestoreFromServer = async (fileName) => {
    const ok = await toast.confirm(`确定使用服务端备份 ${fileName} 恢复数据吗？当前数据库将被覆盖。`, {
      title: '确认恢复',
      confirmText: '开始恢复',
    });
    if (!ok) return;

    setRestoringServerFile(fileName);
    try {
      const result = await deviceAPI.restoreDatabaseFromServer(
        merchantId,
        fileName,
        isLinuxDevice ? restartAfterRestore : false
      );
      notifyRestoreResult(result);
    } catch (error) {
      toast.error(error.response?.data?.error || '数据恢复失败');
    } finally {
      setRestoringServerFile('');
    }
  };

  const handleRestoreFromUpload = async () => {
    if (!uploadFile) {
      toast.warning('请先选择要恢复的 .sql 文件');
      return;
    }
    if (!uploadFile.name.toLowerCase().endsWith('.sql')) {
      toast.warning('仅支持上传 .sql 文件');
      return;
    }

    const ok = await toast.confirm(`确定使用本地文件 ${uploadFile.name} 恢复数据吗？当前数据库将被覆盖。`, {
      title: '确认恢复',
      confirmText: '上传并恢复',
    });
    if (!ok) return;

    setRestoringUpload(true);
    try {
      const result = await deviceAPI.restoreDatabaseFromUpload(
        merchantId,
        uploadFile,
        isLinuxDevice ? restartAfterRestore : false
      );
      notifyRestoreResult(result);
      setUploadFile(null);
    } catch (error) {
      toast.error(error.response?.data?.error || '上传恢复失败');
    } finally {
      setRestoringUpload(false);
    }
  };

  const formatSize = (bytes) => {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatTime = (time) => {
    if (!time) return '—';
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('zh-CN');
  };

  if (!isOpen || !device) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>数据备份与恢复</div>
            <div style={styles.subtitle}>
              MID: {merchantId || '—'} | IP: {device?.ip || '—'} | 版本: {device?.version || '—'}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'backup' ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab('backup')}
          >
            服务端备份
          </button>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'restore' ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab('restore')}
          >
            恢复数据
          </button>
        </div>

        {activeTab === 'backup' && (
          <div style={styles.content}>
            <div style={styles.toolbar}>
              <button
                style={{ ...styles.primaryBtn, ...(creating ? styles.disabled : {}) }}
                onClick={handleCreateBackup}
                disabled={creating}
              >
                {creating ? '备份中...' : '创建备份'}
              </button>
              <button
                style={{ ...styles.secondaryBtn, ...(loading ? styles.disabled : {}) }}
                onClick={loadBackups}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新列表'}
              </button>
            </div>

            <div style={styles.tableWrap}>
              {loading ? (
                <div style={styles.empty}>加载中...</div>
              ) : backups.length === 0 ? (
                <div style={styles.empty}>暂无服务端备份</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>文件名</th>
                      <th style={styles.th}>版本</th>
                      <th style={styles.th}>大小</th>
                      <th style={styles.th}>时间</th>
                      <th style={styles.th}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((item) => (
                      <tr key={item.name}>
                        <td style={styles.td} title={item.name}>{item.name}</td>
                        <td style={styles.td}>{item.version || '—'}</td>
                        <td style={styles.td}>{formatSize(item.size)}</td>
                        <td style={styles.td}>{formatTime(item.mod_time)}</td>
                        <td style={styles.td}>
                          <div style={styles.rowActions}>
                            <button style={styles.linkBtn} onClick={() => handleDownloadBackup(item.name)}>下载</button>
                            <button
                              style={{ ...styles.dangerLinkBtn, ...(deletingFile === item.name ? styles.disabled : {}) }}
                              onClick={() => handleDeleteBackup(item.name)}
                              disabled={deletingFile === item.name}
                            >
                              {deletingFile === item.name ? '删除中...' : '删除'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'restore' && (
          <div style={styles.content}>
            <div style={styles.restoreHint}>
              恢复会覆盖当前数据库，请确认已选择正确备份文件。
            </div>

            {isLinuxDevice && (
              <label style={styles.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={restartAfterRestore}
                  onChange={(e) => setRestartAfterRestore(e.target.checked)}
                />
                <span>恢复成功后重启POS（默认不勾选）</span>
              </label>
            )}

            <div style={styles.restoreBlock}>
              <div style={styles.blockTitle}>从服务端备份恢复</div>
              <div style={styles.tableWrap}>
                {loading ? (
                  <div style={styles.empty}>加载中...</div>
                ) : backups.length === 0 ? (
                  <div style={styles.empty}>暂无可用的服务端备份</div>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>文件名</th>
                        <th style={styles.th}>版本</th>
                        <th style={styles.th}>时间</th>
                        <th style={styles.th}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((item) => (
                        <tr key={`restore-${item.name}`}>
                          <td style={styles.td} title={item.name}>{item.name}</td>
                          <td style={styles.td}>{item.version || '—'}</td>
                          <td style={styles.td}>{formatTime(item.mod_time)}</td>
                          <td style={styles.td}>
                            <button
                              style={{ ...styles.warningBtn, ...(restoringServerFile === item.name ? styles.disabled : {}) }}
                              onClick={() => handleRestoreFromServer(item.name)}
                              disabled={restoringServerFile === item.name}
                            >
                              {restoringServerFile === item.name ? '恢复中...' : '恢复'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={styles.restoreBlock}>
              <div style={styles.blockTitle}>从本地上传恢复</div>
              <div style={styles.uploadRow}>
                <input
                  type="file"
                  accept=".sql,text/sql,application/sql"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={styles.fileInput}
                />
                <button
                  style={{ ...styles.warningBtn, ...(restoringUpload ? styles.disabled : {}) }}
                  onClick={handleRestoreFromUpload}
                  disabled={restoringUpload}
                >
                  {restoringUpload ? '上传恢复中...' : '上传并恢复'}
                </button>
              </div>
              <div style={styles.uploadMeta}>
                {uploadFile ? `已选择: ${uploadFile.name}` : '未选择文件'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
  },
  modal: {
    width: '980px',
    maxWidth: '94vw',
    maxHeight: '88vh',
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 16px',
    borderBottom: '1px solid #E5E5EA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1D1D1F',
  },
  subtitle: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#6C6C70',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    fontSize: '22px',
    color: '#86868B',
    cursor: 'pointer',
    lineHeight: 1,
  },
  tabs: {
    padding: '10px 16px 0 16px',
    display: 'flex',
    gap: '8px',
  },
  tabBtn: {
    border: '1px solid #D1D1D6',
    backgroundColor: '#fff',
    borderRadius: '8px 8px 0 0',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#3A3A3C',
  },
  tabBtnActive: {
    borderColor: '#007AFF',
    color: '#007AFF',
    fontWeight: 600,
  },
  content: {
    padding: '12px 16px 16px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  toolbar: {
    display: 'flex',
    gap: '8px',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#007AFF',
    color: '#fff',
    fontSize: '13px',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#1D1D1F',
    fontSize: '13px',
    padding: '8px 14px',
    cursor: 'pointer',
  },
  warningBtn: {
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#FF9500',
    color: '#fff',
    fontSize: '12px',
    padding: '6px 12px',
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  tableWrap: {
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    color: '#6C6C70',
    padding: '10px 12px',
    backgroundColor: '#F7F7F7',
    borderBottom: '1px solid #E5E5EA',
  },
  td: {
    fontSize: '13px',
    color: '#1D1D1F',
    padding: '10px 12px',
    borderBottom: '1px solid #F2F2F7',
    maxWidth: '360px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  linkBtn: {
    border: 'none',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    borderRadius: '6px',
    fontSize: '12px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
  dangerLinkBtn: {
    border: 'none',
    backgroundColor: '#FF3B30',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '12px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
  empty: {
    fontSize: '13px',
    color: '#86868B',
    textAlign: 'center',
    padding: '24px 12px',
  },
  restoreHint: {
    fontSize: '12px',
    color: '#D48806',
    backgroundColor: '#FFFBE6',
    border: '1px solid #FFE58F',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  checkboxWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#1D1D1F',
  },
  restoreBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  blockTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1D1D1F',
  },
  uploadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fileInput: {
    fontSize: '13px',
    color: '#1D1D1F',
  },
  uploadMeta: {
    fontSize: '12px',
    color: '#6C6C70',
  },
};

export default DBBackupRestoreModal;

