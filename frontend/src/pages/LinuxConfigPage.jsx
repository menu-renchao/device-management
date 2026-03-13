import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { linuxAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import PosControlTab from '../components/linux/PosControlTab';
import UpgradeTab from '../components/linux/UpgradeTab';
import BackupTab from '../components/linux/BackupTab';
import LogTab from '../components/linux/LogTab';
import VersionTab from '../components/linux/VersionTab';
import { createDefaultLinuxConnectionForm } from './connectionDefaults';

const LinuxConfigPage = () => {
  const { merchantId } = useParams();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const device = location.state?.device;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('control');
  const [posStatus, setPosStatus] = useState(null);

  // 连接表单
  const [connectionForm, setConnectionForm] = useState(() => createDefaultLinuxConnectionForm(device?.ip || ''));

  // 权限检查：只有管理员、负责人、借用人才能进入配置页面
  useEffect(() => {
    if (!device) {
      // 如果没有设备信息，允许进入（可能是直接通过URL访问）
      return;
    }

    const isOwner = device.owner?.id === user?.id;
    const isOccupier = device.occupancy?.userId === user?.id;
    const hasPermission = isAdmin() || isOwner || isOccupier;

    if (!hasPermission) {
      toast.warning('您没有权限访问此设备的配置页面，只有管理员、负责人或借用人才能访问');
      navigate(-1); // 返回上一页
    }
  }, [device, user, isAdmin, navigate, toast]);

  // 检查连接状态
  useEffect(() => {
    checkConnection();
  }, [merchantId]);

  const checkConnection = async () => {
    try {
      const res = await linuxAPI.getStatus(merchantId);
      setConnected(res.data?.connected || false);
      if (res.data?.pos_status) {
        setPosStatus(res.data.pos_status);
      }
    } catch (error) {
      setConnected(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!connectionForm.host || !connectionForm.user || !connectionForm.password) {
      toast.warning('请填写完整的连接信息');
      return;
    }

    setConnecting(true);
    try {
      await linuxAPI.testConnection(
        connectionForm.host,
        connectionForm.port,
        connectionForm.user,
        connectionForm.password
      );
      toast.success('连接测试成功！');
    } catch (error) {
      toast.error('连接测试失败：' + (error.response?.data?.message || error.message));
    } finally {
      setConnecting(false);
    }
  };

  // 建立连接
  const handleConnect = async () => {
    if (!connectionForm.host || !connectionForm.user || !connectionForm.password) {
      toast.warning('请填写完整的连接信息');
      return;
    }

    setConnecting(true);
    try {
      await linuxAPI.connect(
        merchantId,
        connectionForm.host,
        connectionForm.port,
        connectionForm.user,
        connectionForm.password
      );
      setConnected(true);
      const statusRes = await linuxAPI.getStatus(merchantId);
      if (statusRes.data?.pos_status) {
        setPosStatus(statusRes.data.pos_status);
      }
    } catch (error) {
      toast.error('连接失败：' + (error.response?.data?.message || error.message));
    } finally {
      setConnecting(false);
    }
  };

  // 断开连接
  const handleDisconnect = async () => {
    try {
      await linuxAPI.disconnect(merchantId);
      setConnected(false);
      setPosStatus(null);
    } catch (error) {
      console.error('断开连接失败:', error);
    }
  };

  // 刷新 POS 状态
  const refreshPosStatus = async () => {
    try {
      const res = await linuxAPI.getStatus(merchantId);
      if (res.data?.pos_status) {
        setPosStatus(res.data.pos_status);
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  };

  // 标签页配置
  const tabs = [
    { key: 'control', label: 'POS 控制', icon: '⚙️' },
    { key: 'upgrade', label: '升级部署', icon: '📤' },
    { key: 'backup', label: '备份恢复', icon: '💾' },
    { key: 'logs', label: '日志管理', icon: '📋' },
    { key: 'version', label: '版本信息', icon: '📊' },
  ];

  return (
    <div style={styles.page}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/')} style={styles.backBtn}>
            <span style={styles.backIcon}>←</span>
            <span>返回</span>
          </button>
          <div style={styles.titleGroup}>
            <h2 style={styles.title}>Linux 配置管理</h2>
            <span style={styles.merchantId}>商家ID: {merchantId}</span>
          </div>
        </div>
        <div style={styles.connectionStatus}>
          {connected ? (
            <>
              <span style={styles.statusDotOnline}></span>
              <span style={styles.statusText}>已连接</span>
              <button onClick={handleDisconnect} style={styles.disconnectBtn}>
                断开
              </button>
            </>
          ) : (
            <>
              <span style={styles.statusDotOffline}></span>
              <span style={styles.statusText}>未连接</span>
            </>
          )}
        </div>
      </div>

      {/* 连接表单 */}
      {!connected && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>SSH 连接设置</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>主机地址</label>
              <input
                type="text"
                value={connectionForm.host}
                onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })}
                placeholder="例如: 192.168.1.100"
                style={{
                  ...styles.input,
                  ...(device?.ip ? styles.readonlyInput : {})
                }}
                readOnly={!!device?.ip}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>端口</label>
              <input
                type="number"
                value={connectionForm.port}
                onChange={(e) => setConnectionForm({ ...connectionForm, port: parseInt(e.target.value) || 22 })}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>用户名</label>
              <input
                type="text"
                value={connectionForm.user}
                onChange={(e) => setConnectionForm({ ...connectionForm, user: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>密码</label>
              <input
                type="password"
                value={connectionForm.password}
                onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={handleTestConnection} disabled={connecting} style={styles.secondaryBtn}>
              {connecting ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleConnect} disabled={connecting} style={styles.primaryBtn}>
              {connecting ? '连接中...' : '连接'}
            </button>
          </div>
        </div>
      )}

      {/* POS 状态 */}
      {connected && posStatus && (
        <div style={styles.statusCard}>
          <div style={styles.statusInfo}>
            <span style={styles.statusLabel}>POS 状态</span>
            <span style={posStatus.running ? styles.running : styles.stopped}>
              {posStatus.running ? '● 运行中' : '○ 已停止'}
            </span>
            {posStatus.systemctl_status && (
              <span style={styles.systemctlStatus}>
                (systemctl: {posStatus.systemctl_status})
              </span>
            )}
          </div>
          <button onClick={refreshPosStatus} style={styles.refreshBtn}>刷新状态</button>
        </div>
      )}

      {/* 标签页导航 */}
      {connected && (
        <div style={styles.tabsCard}>
          <div style={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className="linux-config-tab"
                onClick={() => setActiveTab(tab.key)}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab.key ? styles.activeTab : {})
                }}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 标签页内容 */}
          <div style={styles.tabContent}>
            {activeTab === 'control' && (
              <PosControlTab
                merchantId={merchantId}
                posStatus={posStatus}
                onRefresh={refreshPosStatus}
              />
            )}
            {activeTab === 'upgrade' && (
              <UpgradeTab merchantId={merchantId} />
            )}
            {activeTab === 'backup' && (
              <BackupTab merchantId={merchantId} />
            )}
            {activeTab === 'logs' && (
              <LogTab merchantId={merchantId} />
            )}
            {activeTab === 'version' && (
              <VersionTab merchantId={merchantId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    transition: 'all 0.15s ease',
  },
  backIcon: {
    fontSize: '14px',
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  merchantId: {
    fontSize: '12px',
    color: '#86868B',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDotOnline: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34C759',
    boxShadow: '0 0 4px rgba(52, 199, 89, 0.5)',
  },
  statusDotOffline: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: '13px',
    color: '#86868B',
  },
  disconnectBtn: {
    padding: '4px 12px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#86868B',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  readonlyInput: {
    backgroundColor: '#F2F2F7',
    color: '#86868B',
    cursor: 'not-allowed',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  secondaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  statusCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  statusInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusLabel: {
    fontSize: '13px',
    color: '#86868B',
  },
  running: {
    color: '#34C759',
    fontWeight: '600',
    fontSize: '13px',
  },
  stopped: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: '13px',
  },
  systemctlStatus: {
    fontSize: '11px',
    color: '#86868B',
    backgroundColor: '#F2F2F7',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  refreshBtn: {
    padding: '4px 12px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  tabsCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #E5E5EA',
    padding: '0 8px',
    backgroundColor: '#FAFAFA',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: '2px solid transparent',
    borderLeft: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#86868B',
    transition: 'all 0.15s ease',
    outline: 'none',
    textDecoration: 'none',
  },
  activeTab: {
    color: '#007AFF',
    borderBottom: '2px solid #007AFF',
  },
  tabIcon: {
    fontSize: '14px',
  },
  tabContent: {
    padding: '16px',
  },
};

export default LinuxConfigPage;
