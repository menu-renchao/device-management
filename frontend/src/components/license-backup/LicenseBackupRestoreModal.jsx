import React, { useEffect, useState } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const LicenseBackupRestoreModal = ({ isOpen, onClose, device, onCompleted }) => {
  const toast = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState('');
  const [restoringServerFile, setRestoringServerFile] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [restoringUpload, setRestoringUpload] = useState(false);

  const merchantId = (device?.merchantId || '').trim();

  useEffect(() => {
    if (!isOpen) return;
    setUploadFile(null);
    if (merchantId) {
      loadBackups();
    }
  }, [isOpen, merchantId]);

  const loadBackups = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const result = await deviceAPI.listLicenseBackups(merchantId);
      setBackups(result.data?.items || []);
    } catch (error) {
      toast.error(error.response?.data?.error || '加载服务端 License 备份失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!merchantId) {
      toast.warning('缺少商家ID，无法备份 License');
      return;
    }
    const ok = await toast.confirm('确定要创建当前设备的 License 备份并保存到服务端吗？', {
      title: '创建 License 备份',
      variant: 'primary',
      confirmText: '开始备份',
    });
    if (!ok) return;

    setCreating(true);
    try {
      const result = await deviceAPI.createLicenseBackup(merchantId);
      toast.success(result.message || 'License 备份成功');
      await loadBackups();
    } catch (error) {
      toast.error(error.response?.data?.error || 'License 备份失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (fileName) => {
    const ok = await toast.confirm(`确定要删除备份文件 ${fileName} 吗？此操作不可恢复。`, {
      title: '删除 License 备份',
      confirmText: '删除',
    });
    if (!ok) return;

    setDeletingFile(fileName);
    try {
      const result = await deviceAPI.deleteLicenseBackup(merchantId, fileName);
      toast.success(result.message || 'License 备份删除成功');
      await loadBackups();
    } catch (error) {
      toast.error(error.response?.data?.error || '删除 License 备份失败');
    } finally {
      setDeletingFile('');
    }
  };

  const handleDownloadBackup = (fileName) => {
    const url = deviceAPI.downloadLicenseBackupUrl(merchantId, fileName);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreFromServer = async (fileName) => {
    const ok = await toast.confirm(`确定使用服务端备份 ${fileName} 恢复 License 吗？当前 License 配置将被覆盖。`, {
      title: '确认恢复 License',
      confirmText: '开始恢复',
    });
    if (!ok) return;

    setRestoringServerFile(fileName);
    try {
      const result = await deviceAPI.restoreLicenseFromServer(merchantId, fileName);
      toast.success(result.message || 'License 恢复成功');
      onCompleted?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'License 恢复失败');
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

    const ok = await toast.confirm(`确定使用本地文件 ${uploadFile.name} 恢复 License 吗？当前 License 配置将被覆盖。`, {
      title: '确认导入 License',
      confirmText: '上传并恢复',
    });
    if (!ok) return;

    setRestoringUpload(true);
    try {
      const result = await deviceAPI.restoreLicenseFromUpload(merchantId, uploadFile);
      toast.success(result.message || 'License 导入成功');
      setUploadFile(null);
      onCompleted?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'License 导入失败');
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
    if (!time) return '-';
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
  };

  if (!isOpen || !device) return null;

  return (
    <div className="db-backup-modal-overlay" onClick={onClose}>
      <div className="db-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="db-backup-modal-header">
          <div className="db-backup-modal-header-left">
            <div className="db-backup-modal-title">License备份/导入</div>
            <div className="db-backup-modal-subtitle">
              MID {merchantId || '-'} · {device?.ip || '-'} · v{device?.version || '-'}
            </div>
          </div>
          <button type="button" className="db-backup-modal-close" onClick={onClose} aria-label="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        <div className="db-backup-modal-body">
          <div className="db-backup-hint">
            恢复会覆盖当前 License 配置，请确认已选择正确的备份文件。
          </div>

          <div className="db-backup-toolbar">
            <button
              type="button"
              className="db-backup-btn db-backup-btn-primary"
              onClick={handleCreateBackup}
              disabled={creating}
            >
              {creating ? '备份中...' : '创建备份'}
            </button>
            <button
              type="button"
              className="db-backup-btn db-backup-btn-secondary"
              onClick={loadBackups}
              disabled={loading}
            >
              {loading ? '刷新中...' : '刷新列表'}
            </button>
          </div>

          <div className="db-backup-table-wrap">
            {loading ? (
              <div className="db-backup-empty">加载中...</div>
            ) : backups.length === 0 ? (
              <div className="db-backup-empty">暂无服务端 License 备份</div>
            ) : (
              <table className="db-backup-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>大小</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((item) => (
                    <tr key={item.name}>
                      <td className="db-backup-cell-filename" title={item.name}>{item.name}</td>
                      <td>{formatSize(item.size)}</td>
                      <td>{formatTime(item.mod_time)}</td>
                      <td>
                        <div className="db-backup-row-actions">
                          <button type="button" className="db-backup-action db-backup-action-download" onClick={() => handleDownloadBackup(item.name)}>
                            下载
                          </button>
                          <button
                            type="button"
                            className="db-backup-action db-backup-action-restore"
                            onClick={() => handleRestoreFromServer(item.name)}
                            disabled={restoringServerFile === item.name}
                          >
                            {restoringServerFile === item.name ? '恢复中...' : '恢复'}
                          </button>
                          <button
                            type="button"
                            className="db-backup-action db-backup-action-delete"
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

          <div className="db-backup-upload-card">
            <div className="db-backup-upload-title">从本地上传导入</div>
            <div className="db-backup-upload-row">
              <label className="db-backup-file-label">
                <input
                  type="file"
                  accept=".sql,text/sql,application/sql"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="db-backup-file-input"
                />
                <span className="db-backup-file-label-text">选择文件</span>
              </label>
              <button
                type="button"
                className="db-backup-btn db-backup-btn-warning"
                onClick={handleRestoreFromUpload}
                disabled={restoringUpload}
              >
                {restoringUpload ? '上传恢复中...' : '上传并恢复'}
              </button>
            </div>
            <div className="db-backup-upload-meta">
              {uploadFile ? `已选择: ${uploadFile.name}` : '未选择文件'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseBackupRestoreModal;
