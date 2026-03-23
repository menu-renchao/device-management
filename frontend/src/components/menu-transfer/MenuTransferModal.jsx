import React, { useEffect, useMemo, useState } from 'react';
import { deviceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const MenuTransferModal = ({ isOpen, onClose, device, onCompleted }) => {
  const toast = useToast();
  const [packages, setPackages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [crossLoading, setCrossLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingFile, setDeletingFile] = useState('');
  const [importingServerFile, setImportingServerFile] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingImport, setUploadingImport] = useState(false);
  const [restartAfterImport, setRestartAfterImport] = useState(false);
  const [selectedSourceMerchantId, setSelectedSourceMerchantId] = useState('');

  const merchantId = (device?.merchantId || '').trim();
  const isLinuxDevice = useMemo(() => {
    return (device?.type || '').toLowerCase().includes('linux');
  }, [device]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setUploadFile(null);
    setRestartAfterImport(false);
    setDeletingFile('');
    setImportingServerFile('');
    setSelectedSourceMerchantId('');

    if (merchantId) {
      void loadPackages();
      void loadCrossMerchantPackages();
    }
  }, [isOpen, merchantId]);

  const loadPackages = async () => {
    if (!merchantId) {
      return;
    }

    setLoading(true);
    try {
      const result = await deviceAPI.listMenuPackages(merchantId);
      setPackages(result.data?.items || []);
    } catch (error) {
      toast.error(error.response?.data?.error || '加载菜单包列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCrossMerchantPackages = async () => {
    if (!merchantId) {
      return;
    }

    setCrossLoading(true);
    try {
      const result = await deviceAPI.listAllMenuPackages(merchantId);
      const nextGroups = result.data?.groups || [];
      setGroups(nextGroups);
      setSelectedSourceMerchantId((current) => {
        if (nextGroups.some((group) => group.source_merchant_id === current)) {
          return current;
        }
        return nextGroups[0]?.source_merchant_id || '';
      });
    } catch (error) {
      setGroups([]);
      setSelectedSourceMerchantId('');
      toast.error(error.response?.data?.error || '加载其他 MID 菜单包失败');
    } finally {
      setCrossLoading(false);
    }
  };

  const handleExport = async () => {
    if (!merchantId) {
      toast.warning('缺少商家ID，无法导出菜单');
      return;
    }

    const ok = await toast.confirm('确认导出当前设备的菜单域完整快照到服务端吗？', {
      title: '导出菜单包',
      confirmText: '开始导出',
      variant: 'primary',
    });
    if (!ok) {
      return;
    }

    setExporting(true);
    try {
      const result = await deviceAPI.exportMenuPackage(merchantId);
      toast.success(result.message || '菜单导出成功');
      await loadPackages();
      await loadCrossMerchantPackages();
      onCompleted?.();
    } catch (error) {
      toast.error(error.response?.data?.error || '菜单导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (fileName) => {
    const ok = await toast.confirm(`确认删除菜单包 ${fileName} 吗？该操作不可恢复。`, {
      title: '删除菜单包',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }

    setDeletingFile(fileName);
    try {
      const result = await deviceAPI.deleteMenuPackage(merchantId, fileName);
      toast.success(result.message || '菜单包已删除');
      await loadPackages();
      await loadCrossMerchantPackages();
    } catch (error) {
      toast.error(error.response?.data?.error || '删除菜单包失败');
    } finally {
      setDeletingFile('');
    }
  };

  const handleDownload = (fileName) => {
    const url = deviceAPI.downloadMenuPackageUrl(merchantId, fileName);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const notifyImportResult = (result) => {
    const restart = result?.data?.restart;
    if (restart?.requested) {
      if (restart.success) {
        toast.success('菜单导入成功，POS 已重启');
      } else {
        toast.warning(`菜单导入成功，重启状态：${restart.message || '已跳过'}`);
      }
      return;
    }

    toast.success(result?.message || '菜单导入成功');
  };

  const handleImportFromServer = async (sourceMerchantId, fileName) => {
    const sourceLabel = sourceMerchantId === merchantId ? '当前设备' : `MID ${sourceMerchantId}`;
    const ok = await toast.confirm(
      `确认用 ${sourceLabel} 的菜单包 ${fileName} 全量覆盖当前设备菜单吗？这会清空当前菜单域并重建。`,
      {
        title: '确认菜单导入',
        confirmText: '确认覆盖',
      }
    );
    if (!ok) {
      return;
    }

    const importKey = `${sourceMerchantId}:${fileName}`;
    setImportingServerFile(importKey);
    try {
      const result = await deviceAPI.importMenuFromServer(
        merchantId,
        fileName,
        isLinuxDevice ? restartAfterImport : false,
        sourceMerchantId && sourceMerchantId !== merchantId ? sourceMerchantId : ''
      );
      notifyImportResult(result);
      onCompleted?.();
    } catch (error) {
      toast.error(error.response?.data?.error || '菜单导入失败');
    } finally {
      setImportingServerFile('');
    }
  };

  const handleImportFromUpload = async () => {
    if (!uploadFile) {
      toast.warning('请先选择 .menupack.sql 文件');
      return;
    }
    if (!uploadFile.name.toLowerCase().endsWith('.menupack.sql')) {
      toast.warning('仅支持上传 .menupack.sql 文件');
      return;
    }

    const ok = await toast.confirm(
      `确认上传并用 ${uploadFile.name} 全量覆盖当前设备菜单吗？这会清空当前菜单域并重建。`,
      {
        title: '上传菜单包',
        confirmText: '上传并覆盖',
      }
    );
    if (!ok) {
      return;
    }

    setUploadingImport(true);
    try {
      const result = await deviceAPI.importMenuFromUpload(
        merchantId,
        uploadFile,
        isLinuxDevice ? restartAfterImport : false
      );
      notifyImportResult(result);
      setUploadFile(null);
      onCompleted?.();
    } catch (error) {
      toast.error(error.response?.data?.error || '上传菜单包失败');
    } finally {
      setUploadingImport(false);
    }
  };

  const formatSize = (bytes) => {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
  };

  const selectedGroup = groups.find((group) => group.source_merchant_id === selectedSourceMerchantId);

  if (!isOpen || !device) {
    return null;
  }

  return (
    <div className="db-backup-modal-overlay" onClick={onClose}>
      <div className="db-backup-modal" onClick={(event) => event.stopPropagation()}>
        <div className="db-backup-modal-header">
          <div className="db-backup-modal-header-left">
            <div className="db-backup-modal-title">菜单导入/导出</div>
            <div className="db-backup-modal-subtitle">
              MID {merchantId || '-'} / {device?.ip || '-'} / v{device?.version || '-'}
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
            菜单导入会全量覆盖当前设备的菜单域数据，不会触碰普通业务数据。
            <br />
            导入前请确认目标设备、来源菜单包、以及是否需要在完成后自动重启 POS。
          </div>

          {isLinuxDevice && (
            <label className="db-backup-checkbox">
              <input
                type="checkbox"
                checked={restartAfterImport}
                onChange={(event) => setRestartAfterImport(event.target.checked)}
              />
              <span>导入成功后重启 POS</span>
            </label>
          )}

          <div className="db-backup-toolbar">
            <button
              type="button"
              className="db-backup-btn db-backup-btn-primary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? '导出中...' : '导出当前菜单'}
            </button>
            <button
              type="button"
              className="db-backup-btn db-backup-btn-secondary"
              onClick={loadPackages}
              disabled={loading}
            >
              {loading ? '刷新中...' : '刷新当前列表'}
            </button>
          </div>

          <div className="db-backup-table-wrap">
            {loading ? (
              <div className="db-backup-empty">加载中...</div>
            ) : packages.length === 0 ? (
              <div className="db-backup-empty">当前设备暂无服务端菜单包</div>
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
                  {packages.map((item) => {
                    const importKey = `${merchantId}:${item.name}`;
                    return (
                      <tr key={item.name}>
                        <td className="db-backup-cell-filename" title={item.name}>{item.name}</td>
                        <td>{item.version || '-'}</td>
                        <td>{formatSize(item.size)}</td>
                        <td>{formatTime(item.mod_time)}</td>
                        <td>
                          <div className="db-backup-row-actions">
                            <button type="button" className="db-backup-action db-backup-action-download" onClick={() => handleDownload(item.name)}>
                              下载
                            </button>
                            <button
                              type="button"
                              className="db-backup-action db-backup-action-restore"
                              onClick={() => handleImportFromServer(merchantId, item.name)}
                              disabled={importingServerFile !== '' || uploadingImport}
                            >
                              {importingServerFile === importKey ? '导入中...' : '覆盖导入'}
                            </button>
                            <button
                              type="button"
                              className="db-backup-action db-backup-action-delete"
                              onClick={() => handleDelete(item.name)}
                              disabled={deletingFile === item.name}
                            >
                              {deletingFile === item.name ? '删除中...' : '删除'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="db-backup-cross-card">
            <div className="db-backup-cross-header">
              <div>
                <div className="db-backup-cross-title">从其他 MID 导入菜单</div>
              </div>
              <div className="db-backup-cross-actions">
                <button
                  type="button"
                  className="db-backup-btn db-backup-btn-secondary"
                  onClick={loadCrossMerchantPackages}
                  disabled={crossLoading}
                >
                  {crossLoading ? '刷新中...' : '刷新来源列表'}
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="db-backup-empty db-backup-empty-inline">暂无可导入的其他 MID 菜单包</div>
            ) : (
              <>
                <div className="db-backup-cross-filter">
                  <label className="db-backup-cross-filter-label" htmlFor="menu-transfer-source-mid">
                    选择来源 MID
                  </label>
                  <select
                    id="menu-transfer-source-mid"
                    className="db-backup-cross-select"
                    value={selectedSourceMerchantId}
                    onChange={(event) => setSelectedSourceMerchantId(event.target.value)}
                    disabled={crossLoading || importingServerFile !== '' || uploadingImport}
                  >
                    {groups.map((group) => (
                      <option key={group.source_merchant_id} value={group.source_merchant_id}>
                        {group.source_merchant_id}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedGroup ? (
                  <div className="db-backup-cross-group">
                    <div className="db-backup-cross-group-header">
                      <div className="db-backup-cross-group-title">来源 MID: {selectedGroup.source_merchant_id}</div>
                      <div className="db-backup-cross-group-meta">{selectedGroup.total || selectedGroup.items?.length || 0} 个菜单包</div>
                    </div>

                    <div className="db-backup-table-wrap db-backup-table-wrap-compact">
                      <table className="db-backup-table">
                        <thead>
                          <tr>
                            <th>文件名</th>
                            <th>来源版本</th>
                            <th>大小</th>
                            <th>时间</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedGroup.items || []).map((item) => {
                            const importKey = `${selectedGroup.source_merchant_id}:${item.name}`;
                            const isImporting = importingServerFile === importKey;
                            return (
                              <tr key={importKey}>
                                <td className="db-backup-cell-filename" title={item.name}>{item.name}</td>
                                <td>{item.source_version || '-'}</td>
                                <td>{formatSize(item.size)}</td>
                                <td>{formatTime(item.mod_time)}</td>
                                <td>
                                  <div className="db-backup-row-actions">
                                    <button
                                      type="button"
                                      className="db-backup-action db-backup-action-restore"
                                      onClick={() => handleImportFromServer(selectedGroup.source_merchant_id, item.name)}
                                      disabled={importingServerFile !== '' || uploadingImport}
                                    >
                                      {isImporting ? '导入中...' : '覆盖到当前设备'}
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
                  <div className="db-backup-empty db-backup-empty-inline">请选择要查看的来源 MID</div>
                )}
              </>
            )}
          </div>

          <div className="db-backup-upload-card">
            <div className="db-backup-upload-title">从本地上传菜单包</div>
            <div className="db-backup-upload-row">
              <label className="db-backup-file-label">
                <input
                  type="file"
                  accept=".sql,.menupack.sql,text/plain,application/sql"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  className="db-backup-file-input"
                />
                <span className="db-backup-file-label-text">选择文件</span>
              </label>
              <button
                type="button"
                className="db-backup-btn db-backup-btn-warning"
                onClick={handleImportFromUpload}
                disabled={uploadingImport}
              >
                {uploadingImport ? '上传导入中...' : '上传并覆盖'}
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

export default MenuTransferModal;
