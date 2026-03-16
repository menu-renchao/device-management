import React, { useEffect, useMemo, useState } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const DBBackupRestoreModal = ({ isOpen, onClose, device }) => {
  const toast = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingFile, setDeletingFile] = useState('');
  const [restoringServerFile, setRestoringServerFile] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [restoringUpload, setRestoringUpload] = useState(false);
  const [restartAfterRestore, setRestartAfterRestore] = useState(false);
  const [crossMerchantLoading, setCrossMerchantLoading] = useState(false);
  const [crossMerchantGroups, setCrossMerchantGroups] = useState([]);
  const [licenseBackupReady, setLicenseBackupReady] = useState(null);
  const [crossRestoringKey, setCrossRestoringKey] = useState('');
  const [selectedSourceMerchantId, setSelectedSourceMerchantId] = useState('');

  const merchantId = (device?.merchantId || '').trim();
  const isLinuxDevice = useMemo(() => {
    return (device?.type || '').toLowerCase().includes('linux');
  }, [device]);
  const isAnyRestoreRunning = Boolean(restoringServerFile || restoringUpload || crossRestoringKey);

  useEffect(() => {
    if (!isOpen) return;
    setUploadFile(null);
    setRestartAfterRestore(false);
    setCrossMerchantGroups([]);
    setLicenseBackupReady(null);
    setCrossRestoringKey('');
    setSelectedSourceMerchantId('');
    if (merchantId) {
      loadBackups();
      loadCrossMerchantBackups();
    }
  }, [isOpen, merchantId]);

  const loadBackups = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const result = await deviceAPI.listDatabaseBackups(merchantId);
      setBackups(result.data?.items || []);
    } catch (error) {
      toast.error(error.response?.data?.error || '加载服务端数据库备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCrossMerchantBackups = async () => {
    if (!merchantId) return;
    setCrossMerchantLoading(true);
    try {
      const result = await deviceAPI.listAllDatabaseBackups(merchantId);
      const groups = result.data?.groups || [];
      setLicenseBackupReady(Boolean(result.data?.license_backup_ready));
      setCrossMerchantGroups(groups);
      setSelectedSourceMerchantId((current) => {
        if (groups.some((group) => group.source_merchant_id === current)) {
          return current;
        }
        return groups[0]?.source_merchant_id || '';
      });
    } catch (error) {
      setLicenseBackupReady(false);
      setCrossMerchantGroups([]);
      setSelectedSourceMerchantId('');
      toast.error(error.response?.data?.error || '加载其他设备数据库备份失败');
    } finally {
      setCrossMerchantLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!merchantId) {
      toast.warning('缺少商家 ID，无法创建数据库备份');
      return;
    }
    const ok = await toast.confirm('确定要创建当前设备的数据库全量备份并保存到服务端吗？', {
      title: '创建数据库备份',
      variant: 'primary',
      confirmText: '开始备份',
    });
    if (!ok) return;

    setCreating(true);
    try {
      const result = await deviceAPI.backupDatabase(merchantId);
      toast.success(result.message || '数据库备份成功');
      await loadBackups();
    } catch (error) {
      toast.error(error.response?.data?.error || '数据库备份失败');
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
        toast.success('数据库恢复成功，且 POS 重启成功');
      } else {
        toast.warning(`数据库恢复成功，重启状态：${restart.message || '已跳过'}`);
      }
      return;
    }
    toast.success(result?.message || '数据库恢复成功');
  };

  const handleRestoreFromServer = async (fileName) => {
    const ok = await toast.confirm(`确定使用当前设备服务端备份 ${fileName} 恢复数据库吗？当前数据库将被覆盖。`, {
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
      toast.error(error.response?.data?.error || '数据库恢复失败');
    } finally {
      setRestoringServerFile('');
    }
  };

  const handleRestoreFromOtherMerchant = async (sourceMerchantId, fileName) => {
    const ok = await toast.confirm(
      `确定将来源 MID ${sourceMerchantId} 的备份 ${fileName} 导入到当前设备 MID ${merchantId} 吗？此操作会覆盖当前设备数据库。导入前请确认当前设备 License 已完成备份。`,
      {
        title: '确认导入其他设备数据',
        confirmText: '确认导入',
      }
    );
    if (!ok) return;

    const restoreKey = `${sourceMerchantId}:${fileName}`;
    setCrossRestoringKey(restoreKey);
    try {
      const result = await deviceAPI.restoreDatabaseFromServer(
        merchantId,
        fileName,
        isLinuxDevice ? restartAfterRestore : false,
        sourceMerchantId
      );
      notifyRestoreResult(result);
    } catch (error) {
      toast.error(error.response?.data?.error || '导入其他设备数据失败');
    } finally {
      setCrossRestoringKey('');
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

    const ok = await toast.confirm(`确定使用本地文件 ${uploadFile.name} 恢复数据库吗？当前数据库将被覆盖。`, {
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
    if (!time) return '-';
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
  };

  const selectedCrossMerchantGroup = crossMerchantGroups.find(
    (group) => group.source_merchant_id === selectedSourceMerchantId
  );

  if (!isOpen || !device) return null;

  return (
    <div className="db-backup-modal-overlay" onClick={onClose}>
      <div className="db-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="db-backup-modal-header">
          <div className="db-backup-modal-header-left">
            <div className="db-backup-modal-title">数据备份/恢复</div>
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
          <div className="db-backup-hint db-backup-hint-strong">
            恢复会覆盖当前数据库，请确认已选择正确的备份文件。<br />
            导入其他设备数据前，必须先完成当前设备 License 备份。若当前设备没有至少一份 License 服务端备份，将禁止导入其他设备数据。
          </div>

          {isLinuxDevice && (
            <label className="db-backup-checkbox">
              <input
                type="checkbox"
                checked={restartAfterRestore}
                onChange={(e) => setRestartAfterRestore(e.target.checked)}
              />
              <span>恢复成功后重启 POS</span>
            </label>
          )}

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
              <div className="db-backup-empty">暂无当前设备的服务端备份</div>
            ) : (
              <table className="db-backup-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>版本</th>
                    <th>大小</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((item) => (
                    <tr key={item.name}>
                      <td className="db-backup-cell-filename" title={item.name}>{item.name}</td>
                      <td>{item.version || '-'}</td>
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
                            disabled={restoringServerFile === item.name || crossRestoringKey !== ''}
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

          <div className="db-backup-cross-card">
            <div className="db-backup-cross-header">
              <div>
                <div className="db-backup-cross-title">导入其他设备数据</div>
              </div>
              <div className="db-backup-cross-actions">
                <button
                  type="button"
                  className="db-backup-btn db-backup-btn-secondary"
                  onClick={loadCrossMerchantBackups}
                  disabled={crossMerchantLoading}
                >
                  {crossMerchantLoading ? '检查中...' : '检查备份'}
                </button>
              </div>
            </div>

            {licenseBackupReady === false && (
              <div className="db-backup-cross-warning">
                当前设备尚未备份 License，无法导入其他设备数据。请先在“License备份/导入”中至少创建一份当前设备的 License 服务端备份。
              </div>
            )}

            {licenseBackupReady === true && (
              <div className="db-backup-cross-groups">
                {crossMerchantGroups.length === 0 ? (
                  <div className="db-backup-empty db-backup-empty-inline">暂无可导入的其他 MID 服务端备份</div>
                ) : (
                  <>
                    <div className="db-backup-cross-filter">
                      <label className="db-backup-cross-filter-label" htmlFor="db-backup-source-mid">
                        选择 MID
                      </label>
                      <select
                        id="db-backup-source-mid"
                        className="db-backup-cross-select"
                        value={selectedSourceMerchantId}
                        onChange={(e) => setSelectedSourceMerchantId(e.target.value)}
                        disabled={crossMerchantLoading || isAnyRestoreRunning}
                      >
                        {crossMerchantGroups.map((group) => (
                          <option key={group.source_merchant_id} value={group.source_merchant_id}>
                            {group.source_merchant_id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCrossMerchantGroup ? (
                      <div className="db-backup-cross-group">
                        <div className="db-backup-cross-group-header">
                          <div className="db-backup-cross-group-title">来源 MID：{selectedCrossMerchantGroup.source_merchant_id}</div>
                          <div className="db-backup-cross-group-meta">{selectedCrossMerchantGroup.total || selectedCrossMerchantGroup.items?.length || 0} 份备份</div>
                        </div>

                        <div className="db-backup-table-wrap db-backup-table-wrap-compact">
                          <table className="db-backup-table">
                            <thead>
                              <tr>
                                <th>文件名</th>
                                <th>版本</th>
                                <th>大小</th>
                                <th>时间</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(selectedCrossMerchantGroup.items || []).map((item) => {
                                const restoreKey = `${selectedCrossMerchantGroup.source_merchant_id}:${item.name}`;
                                const isRestoringThisItem = crossRestoringKey === restoreKey;
                                return (
                                  <tr key={restoreKey}>
                                    <td className="db-backup-cell-filename" title={item.name}>{item.name}</td>
                                    <td>{item.version || '-'}</td>
                                    <td>{formatSize(item.size)}</td>
                                    <td>{formatTime(item.mod_time)}</td>
                                    <td>
                                      <div className="db-backup-row-actions">
                                        <button
                                          type="button"
                                          className="db-backup-action db-backup-action-restore"
                                          onClick={() => handleRestoreFromOtherMerchant(selectedCrossMerchantGroup.source_merchant_id, item.name)}
                                          disabled={isAnyRestoreRunning}
                                        >
                                          {isRestoringThisItem ? '导入中...' : '导入到当前设备'}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="db-backup-empty db-backup-empty-inline">请先选择要查看的来源 MID</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="db-backup-upload-card">
            <div className="db-backup-upload-title">从本地上传恢复</div>
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

export default DBBackupRestoreModal;
