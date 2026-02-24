import React, { useState, useEffect, useRef } from 'react';
import { linuxAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import DownloadConfigModal from './DownloadConfigModal';

const WarPackageManager = ({ merchantId }) => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  // 网络下载状态
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadTaskId, setDownloadTaskId] = useState(null);
  const [showDownloadConfig, setShowDownloadConfig] = useState(false);
  const [duplicateVersion, setDuplicateVersion] = useState(null);

  // 历史包列表
  const [historyPackages, setHistoryPackages] = useState([]);
  const [packageMetadata, setPackageMetadata] = useState({});
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // 编辑模式
  const [editingMetadata, setEditingMetadata] = useState(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // 筛选
  const [filterType, setFilterType] = useState('all');
  const [filterRelease, setFilterRelease] = useState('all');

  useEffect(() => {
    loadHistoryPackages();
    loadPackageMetadata();
  }, []);

  const loadHistoryPackages = async () => {
    try {
      const result = await linuxAPI.getWarPackages();
      setHistoryPackages(result.data?.packages || []);
    } catch (error) {
      console.error('加载包列表失败:', error);
    }
  };

  const loadPackageMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const result = await linuxAPI.getWarPackageMetadata();
      const metadataMap = {};
      result.data?.packages?.forEach(pkg => {
        metadataMap[pkg.package_name] = pkg;
      });
      setPackageMetadata(metadataMap);
    } catch (error) {
      console.error('加载包元数据失败:', error);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleStartDownload = async (overwrite = false) => {
    if (!downloadUrl.trim()) {
      toast.warning('请输入下载 URL');
      return;
    }

    // 如果已检测到重复版本且用户没有选择覆盖，不再重复请求
    if (duplicateVersion && !overwrite) {
      return;
    }

    setDownloading(true);
    setDownloadProgress(null);
    setDuplicateVersion(null); // 清除之前的重复提示

    try {
      const result = await linuxAPI.startWarDownload(downloadUrl, overwrite);

      // 开始轮询下载进度
      setDownloadTaskId(result.data?.task_id);
      pollDownloadProgress(result.data?.task_id);
    } catch (error) {
      toast.error('开始下载失败：' + (error.response?.data?.message || error.message));
      setDownloading(false);
    }
  };

  const handleOverwriteDownload = () => {
    setDuplicateVersion(null);
    handleStartDownload(true);
  };

  const handleUseExisting = () => {
    setDuplicateVersion(null);
    toast.success('已选择已有版本');
  };

  const handleCancelDownload = async () => {
    if (!downloadTaskId) return;

    try {
      await linuxAPI.cancelWarDownload(downloadTaskId);
      setDownloading(false);
      setDownloadProgress(null);
      setDownloadTaskId(null);
    } catch (error) {
      console.error('取消下载失败:', error);
      setDownloading(false);
    }
  };

  const pollDownloadProgress = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const result = await linuxAPI.getWarDownloadProgress(taskId);

        if (!result.success || result.data?.status === 'not_found') {
          clearInterval(interval);
          setDownloading(false);
          toast.error('下载任务已丢失，请重新下载');
          return;
        }

        setDownloadProgress(result.data);

        if (result.data?.status === 'duplicate') {
          clearInterval(interval);
          setDownloading(false);
          setDuplicateVersion({
            version: result.data.name,
            message: result.data.error
          });
        } else if (result.data?.status === 'completed') {
          clearInterval(interval);
          setDownloading(false);
          loadHistoryPackages();
          loadPackageMetadata();
          toast.success('下载完成！');
        } else if (result.data?.status === 'failed') {
          clearInterval(interval);
          setDownloading(false);
          toast.error('下载失败：' + (result.data?.error || '未知错误'));
        } else if (result.data?.status === 'cancelled') {
          clearInterval(interval);
          setDownloading(false);
        }
      } catch (error) {
        console.error('获取进度失败:', error);
      }
    }, 1000);
  };

  const handleDeletePackage = async (name) => {
    if (!confirm(`确定要删除 ${name} 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await linuxAPI.deleteWarPackage(name);
      loadHistoryPackages();
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleEditMetadata = (pkg) => {
    const metadata = packageMetadata[pkg.name] || {
      package_name: pkg.name,
      package_type: 'war',
      version: pkg.name,
      is_release: false,
      description: ''
    };
    setEditingMetadata(metadata);
    setShowMetadataModal(true);
  };

  const handleSaveMetadata = async (metadata) => {
    try {
      await linuxAPI.updateWarPackageMetadata({
        package_name: metadata.package_name,
        package_type: metadata.package_type,
        version: metadata.version,
        is_release: metadata.is_release,
        description: metadata.description
      });
      toast.success('保存成功');
      setShowMetadataModal(false);
      loadPackageMetadata();
    } catch (error) {
      toast.error('保存失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleToggleRelease = async (packageName, currentStatus) => {
    try {
      await linuxAPI.setWarPackageRelease(packageName, !currentStatus);
      toast.success('设置成功');
      loadPackageMetadata();
    } catch (error) {
      toast.error('设置失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleDownloadToLocal = (pkg) => {
    window.open(linuxAPI.downloadWarPackageUrl(pkg.name), '_blank');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 筛选包列表
  const filteredPackages = historyPackages.filter(pkg => {
    const metadata = packageMetadata[pkg.name];
    if (filterType !== 'all' && (!metadata || metadata.package_type !== filterType)) {
      return false;
    }
    if (filterRelease === 'release' && (!metadata || !metadata.is_release)) {
      return false;
    }
    if (filterRelease === 'non_release' && metadata && metadata.is_release) {
      return false;
    }
    return true;
  });

  return (
    <div style={styles.container}>
      {/* 网络下载区域 */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>网络下载</h4>
        <div style={styles.downloadInputRow}>
          <input
            type="text"
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            placeholder="输入 TeamCity 或其他下载 URL..."
            style={styles.downloadInput}
          />
          {/* 下载类型由后端根据文件名自动判断，前端不再传参 */}
          <button
            onClick={() => handleStartDownload()}
            disabled={downloading || !downloadUrl.trim()}
            style={{
              ...styles.primaryBtn,
              ...((downloading || !downloadUrl.trim() || duplicateVersion) ? styles.disabled : {}),
            }}
          >
            {downloading ? '下载中...' : '开始下载'}
          </button>
          {downloading && (
            <button onClick={handleCancelDownload} style={styles.dangerBtn}>
              取消
            </button>
          )}
          {isAdmin() && (
            <button onClick={() => setShowDownloadConfig(true)} style={styles.outlineBtn}>
              配置
            </button>
          )}
        </div>

        {duplicateVersion && (
          <div style={styles.duplicateDialog}>
            <div style={styles.duplicateContent}>
              <div style={styles.duplicateIcon}>⚠️</div>
              <div style={styles.duplicateTitle}>版本已存在</div>
              <div style={styles.duplicateText}>
                {duplicateVersion.message}
              </div>
              <div style={styles.duplicateActions}>
                <button onClick={handleUseExisting} style={styles.primaryBtn}>
                  使用已有版本
                </button>
                <button onClick={handleOverwriteDownload} style={styles.dangerBtn}>
                  覆盖重新下载
                </button>
                <button onClick={() => setDuplicateVersion(null)} style={styles.outlineBtn}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {downloading && downloadProgress && (
          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>
                下载进度 - {downloadProgress.name || '获取中...'}
              </span>
              {downloadProgress.total > 0 && (
                <span style={styles.progressValue}>
                  {downloadProgress.percentage?.toFixed(1)}%
                </span>
              )}
            </div>
            {downloadProgress.total > 0 ? (
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: `${downloadProgress.percentage || 0}%`
                }} />
              </div>
            ) : (
              <div style={styles.indeterminateBar} />
            )}
            <div style={styles.progressStats}>
              <span>
                {formatSize(downloadProgress.downloaded || 0)}
                {downloadProgress.total > 0 && ` / ${formatSize(downloadProgress.total)}`}
              </span>
              <span>{downloadProgress.speed || ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* 历史包列表区域 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h4 style={styles.sectionTitle}>历史包列表</h4>
          <div style={styles.sectionActions}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">全部类型</option>
              <option value="war">WAR包</option>
              <option value="upgrade">安装升级包</option>
            </select>
            <select
              value={filterRelease}
              onChange={(e) => setFilterRelease(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">全部</option>
              <option value="release">发版版本</option>
              <option value="non_release">非发版</option>
            </select>
            <button onClick={loadHistoryPackages} style={styles.refreshBtn}>
              刷新
            </button>
          </div>
        </div>

        {loadingMetadata ? (
          <div style={styles.loading}>加载中...</div>
        ) : filteredPackages.length === 0 ? (
          <div style={styles.empty}>暂无符合条件的包</div>
        ) : (
          <div style={styles.packageList}>
            {filteredPackages.map((pkg) => {
              const metadata = packageMetadata[pkg.name];
              return (
                <div key={pkg.name} style={styles.packageItem}>
                  <div style={styles.packageInfo}>
                    <div style={styles.packageHeader}>
                      <span style={styles.packageName}>{pkg.name}</span>
                      {metadata && (
                        <>
                          <span style={{
                            ...styles.typeBadge,
                            backgroundColor: getTypeColor(metadata.package_type)
                          }}>
                            {metadata.type_label || metadata.package_type}
                          </span>
                          {metadata.is_release && (
                            <span style={styles.releaseBadge}>发版</span>
                          )}
                        </>
                      )}
                    </div>
                    <div style={styles.packageMeta}>
                      <span>{formatSize(pkg.size)}</span>
                      <span>{new Date(pkg.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    {metadata?.description && (
                      <div style={styles.description}>{metadata.description}</div>
                    )}
                  </div>
                  <div style={styles.packageActions}>
                    <button
                      onClick={() => handleDownloadToLocal(pkg)}
                      style={styles.actionBtn}
                      title="下载到本地"
                    >
                      下载
                    </button>
                    <button
                      onClick={() => handleEditMetadata(pkg)}
                      style={styles.actionBtn}
                      title="编辑元数据"
                    >
                      编辑
                    </button>
                    {isAdmin() && (
                      <button
                        onClick={() => handleToggleRelease(pkg.name, metadata?.is_release)}
                        style={{
                          ...styles.actionBtn,
                          backgroundColor: metadata?.is_release ? '#F0F9FF' : '#FFF7E6'
                        }}
                        title={metadata?.is_release ? '取消发版' : '设为发版'}
                      >
                        {metadata?.is_release ? '取消发版' : '设为发版'}
                      </button>
                    )}
                    {isAdmin() && (
                      <button
                        onClick={() => handleDeletePackage(pkg.name)}
                        style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                        title="删除"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 元数据编辑弹窗 */}
      {showMetadataModal && editingMetadata && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h4 style={styles.modalTitle}>编辑包元数据</h4>
              <button
                onClick={() => setShowMetadataModal(false)}
                style={styles.closeModalBtn}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>包名称</label>
                <input
                  type="text"
                  value={editingMetadata.package_name}
                  disabled
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>包类型</label>
                <select
                  value={editingMetadata.package_type}
                  onChange={(e) => setEditingMetadata({
                    ...editingMetadata,
                    package_type: e.target.value
                  })}
                  style={styles.formInput}
                >
                  <option value="war">WAR包</option>
                  <option value="upgrade">安装升级包</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>版本号</label>
                <input
                  type="text"
                  value={editingMetadata.version}
                  onChange={(e) => setEditingMetadata({
                    ...editingMetadata,
                    version: e.target.value
                  })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  <input
                    type="checkbox"
                    checked={editingMetadata.is_release}
                    onChange={(e) => setEditingMetadata({
                      ...editingMetadata,
                      is_release: e.target.checked
                    })}
                    style={styles.checkbox}
                  />
                  发版版本
                </label>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>描述说明</label>
                <textarea
                  value={editingMetadata.description}
                  onChange={(e) => setEditingMetadata({
                    ...editingMetadata,
                    description: e.target.value
                  })}
                  style={styles.formTextarea}
                  rows={3}
                  placeholder="请输入描述信息..."
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowMetadataModal(false)}
                style={styles.outlineBtn}
              >
                取消
              </button>
              <button
                onClick={() => handleSaveMetadata(editingMetadata)}
                style={styles.primaryBtn}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 下载配置弹窗 */}
      {showDownloadConfig && (
        <DownloadConfigModal
          isOpen={showDownloadConfig}
          onClose={() => setShowDownloadConfig(false)}
        />
      )}
    </div>
  );
};

const getTypeColor = (type) => {
  const colors = {
    war: '#007AFF',
    upgrade: '#34C759',
    install: '#FF9500'
  };
  return colors[type] || '#86868B';
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
    padding: '16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  sectionActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  downloadInputRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  downloadInput: {
    flex: 1,
    minWidth: '200px',
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  downloadSelect: {
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
    minWidth: '140px',
  },
  uploadRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fileName: {
    fontSize: '13px',
    color: '#1D1D1F',
  },
  fileSize: {
    fontSize: '12px',
    color: '#86868B',
  },
  primaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  outlineBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#007AFF',
    border: '1px solid #007AFF',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  dangerBtn: {
    padding: '8px 16px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#1D1D1F',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  duplicateDialog: {
    padding: '16px',
    backgroundColor: '#FFF7E6',
    borderRadius: '8px',
    border: '1px solid #FFE58F',
  },
  duplicateContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    textAlign: 'center',
  },
  duplicateIcon: {
    fontSize: '32px',
  },
  duplicateTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#D48806',
  },
  duplicateText: {
    fontSize: '13px',
    color: '#874D00',
  },
  duplicateActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  progressCard: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #E5E5EA',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '12px',
  },
  progressLabel: {
    color: '#1D1D1F',
  },
  progressValue: {
    fontWeight: '500',
    color: '#007AFF',
  },
  progressBar: {
    height: '4px',
    backgroundColor: '#E5E5EA',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  progressStats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '11px',
    color: '#86868B',
  },
  indeterminateBar: {
    height: '4px',
    borderRadius: '2px',
    background: 'repeating-linear-gradient(45deg, #007AFF, #007AFF 10px, #5AC8FA 10px, #5AC8FA 20px)',
    backgroundSize: '200% 100%',
  },
  successCard: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#F0F9FF',
    borderRadius: '4px',
    color: '#0958D9',
    fontSize: '12px',
  },
  filterSelect: {
    padding: '6px 10px',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: '#fff',
  },
  loading: {
    textAlign: 'center',
    padding: '32px',
    color: '#86868B',
    fontSize: '13px',
  },
  empty: {
    textAlign: 'center',
    padding: '32px',
    color: '#86868B',
    fontSize: '13px',
  },
  packageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  packageItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #E5E5EA',
  },
  packageInfo: {
    flex: 1,
    minWidth: 0,
  },
  packageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  packageName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    color: '#fff',
    fontWeight: '500',
  },
  releaseBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    backgroundColor: '#FF9500',
    color: '#fff',
    fontWeight: '500',
  },
  packageMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
    color: '#86868B',
  },
  description: {
    fontSize: '11px',
    color: '#86868B',
    marginTop: '4px',
  },
  packageActions: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  actionBtn: {
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    color: '#1D1D1F',
  },
  deleteBtn: {
    backgroundColor: '#FFF1F0',
    border: '1px solid #FFCCC7',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '500px',
    maxWidth: '90vw',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #E5E5EA',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#86868B',
    cursor: 'pointer',
    padding: 0,
  },
  modalBody: {
    padding: '16px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  formTextarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
    resize: 'vertical',
  },
  checkbox: {
    marginRight: '6px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px',
    borderTop: '1px solid #E5E5EA',
  },
};

export default WarPackageManager;
