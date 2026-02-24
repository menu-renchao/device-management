import React, { useState, useEffect, useRef } from 'react';
import { linuxAPI } from '../../services/api';

const VersionTab = ({ merchantId }) => {
  const [appVersion, setAppVersion] = useState(null);
  const [cloudVersion, setCloudVersion] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadVersionInfo();
  }, [merchantId]);

  const loadVersionInfo = async () => {
    setLoading(true);
    try {
      const [appRes, cloudRes, sysRes] = await Promise.all([
        linuxAPI.getAppVersion(merchantId).catch(() => null),
        linuxAPI.getCloudVersion(merchantId).catch(() => null),
        linuxAPI.getSystemInfo(merchantId).catch(() => null),
      ]);

      if (appRes) setAppVersion(appRes.data);
      if (cloudRes) setCloudVersion(cloudRes.data);
      if (sysRes) setSystemInfo(sysRes.data);
    } catch (error) {
      console.error('加载版本信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>版本信息</h4>
        <button onClick={loadVersionInfo} disabled={loading} style={styles.refreshBtn}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div style={styles.section}>
        <h5 style={styles.sectionTitle}>POS 应用版本</h5>
        {appVersion ? (
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.label}>应用版本</span>
              <span style={styles.value}>{appVersion.app_version || '未知'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.label}>Java 版本</span>
              <span style={styles.value}>{appVersion.java_version || '未知'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.label}>操作系统</span>
              <span style={styles.value}>{appVersion.os_version || '未知'}</span>
            </div>
          </div>
        ) : (
          <div style={styles.loading}>加载中...</div>
        )}
      </div>

      <div style={styles.section}>
        <h5 style={styles.sectionTitle}>CloudDataHub 版本</h5>
        {cloudVersion ? (
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.label}>版本号</span>
              <span style={styles.value}>{cloudVersion.cloud_version || '未知'}</span>
            </div>
          </div>
        ) : (
          <div style={styles.loading}>加载中...</div>
        )}
      </div>

      {systemInfo && (
        <div style={styles.section}>
          <h5 style={styles.sectionTitle}>系统资源</h5>
          <div style={styles.resourceGrid}>
            <div style={styles.resourceItem}>
              <span style={styles.resourceLabel}>磁盘使用</span>
              <pre style={styles.resourceText}>{systemInfo.disk_usage}</pre>
            </div>
            <div style={styles.resourceItem}>
              <span style={styles.resourceLabel}>内存使用</span>
              <pre style={styles.resourceText}>{systemInfo.memory_usage}</pre>
            </div>
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
  refreshBtn: {
    padding: '4px 12px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  section: {
    padding: '16px',
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#86868B',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    fontSize: '11px',
    color: '#86868B',
  },
  value: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    wordBreak: 'break-all',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#86868B',
    fontSize: '13px',
  },
  resourceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  resourceItem: {
    backgroundColor: '#1E1E1E',
    padding: '12px',
    borderRadius: '6px',
  },
  resourceLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#86868B',
    marginBottom: '8px',
  },
  resourceText: {
    margin: 0,
    color: '#D4D4D4',
    fontFamily: 'monospace',
    fontSize: '10px',
    whiteSpace: 'pre-wrap',
  },
};

export default VersionTab;
