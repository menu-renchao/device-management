import React, { useState, useRef, useEffect } from 'react';
import { linuxAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const PosControlTab = ({ merchantId, posStatus, onRefresh }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressAction, setProgressAction] = useState('');
  const progressRef = useRef(null);
  const operationRef = useRef(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  // 需要显示进度条的操作
  const progressActions = ['start', 'restart'];

  const executeAction = async (action) => {
    const needsProgress = progressActions.includes(action);

    if (needsProgress) {
      // 显示进度条
      setShowProgress(true);
      setProgress(0);
      setProgressAction(getActionLabel(action));
      setConfirmAction(null);

      // 启动进度条定时器（60秒内从0到99%）
      let currentProgress = 0;
      progressRef.current = setInterval(() => {
        currentProgress += 1.65; // 约60秒到99%
        if (currentProgress >= 99) {
          currentProgress = 99;
          clearInterval(progressRef.current);
        }
        setProgress(Math.floor(currentProgress));
      }, 1000);

      // 执行实际操作
      try {
        let result;
        switch (action) {
          case 'start':
            result = await linuxAPI.startPOS(merchantId);
            break;
          case 'restart':
            result = await linuxAPI.restartPOS(merchantId);
            break;
          default:
            break;
        }

        // 操作完成，快进到100%
        clearInterval(progressRef.current);
        setProgress(100);

        // 等待一下让用户看到100%
        setTimeout(() => {
          setShowProgress(false);
          setProgress(0);
          toast.success(result?.message || '操作成功');
          onRefresh && onRefresh();
        }, 500);

      } catch (error) {
        clearInterval(progressRef.current);
        setShowProgress(false);
        setProgress(0);
        toast.error('操作失败：' + (error.response?.data?.message || error.message));
      }
    } else {
      // 不需要进度条的操作（停止、重启Tomcat）
      setLoading(true);
      try {
        let result;
        switch (action) {
          case 'stop':
            result = await linuxAPI.stopPOS(merchantId);
            break;
          case 'restartTomcat':
            result = await linuxAPI.restartTomcat(merchantId);
            break;
          default:
            return;
        }

        toast.success(result.message || '操作成功');
        onRefresh && onRefresh();
      } catch (error) {
        toast.error('操作失败：' + (error.response?.data?.message || error.message));
      } finally {
        setLoading(false);
        setConfirmAction(null);
      }
    }
  };

  const handleConfirm = (action) => {
    setConfirmAction(action);
  };

  const handleCancel = () => {
    setConfirmAction(null);
  };

  const handleExecute = () => {
    if (confirmAction) {
      executeAction(confirmAction);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      stop: '停止 POS',
      start: '启动 POS',
      restart: '重启 POS',
      restartTomcat: '重启 Tomcat',
    };
    return labels[action] || action;
  };

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>POS 服务控制</h4>
        <div style={styles.buttonGroup}>
          <button
            onClick={() => handleConfirm('stop')}
            disabled={loading || showProgress || !posStatus?.running}
            style={{
              ...styles.button,
              ...styles.stopButton,
              ...((loading || showProgress || !posStatus?.running) ? styles.disabled : {}),
            }}
          >
            停止 POS
          </button>

          <button
            onClick={() => handleConfirm('start')}
            disabled={loading || showProgress || posStatus?.running}
            style={{
              ...styles.button,
              ...styles.startButton,
              ...((loading || showProgress || posStatus?.running) ? styles.disabled : {}),
            }}
          >
            启动 POS
          </button>

          <button
            onClick={() => handleConfirm('restart')}
            disabled={loading || showProgress}
            style={{
              ...styles.button,
              ...styles.restartButton,
              ...((loading || showProgress) ? styles.disabled : {}),
            }}
          >
            重启 POS
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Tomcat 服务控制</h4>
        <div style={styles.buttonGroup}>
          <button
            onClick={() => handleConfirm('restartTomcat')}
            disabled={loading || showProgress}
            style={{
              ...styles.button,
              ...styles.tomcatButton,
              ...((loading || showProgress) ? styles.disabled : {}),
            }}
          >
            重启 Tomcat
          </button>
        </div>
      </div>

      {/* 进度条对话框 */}
      {showProgress && (
        <div style={styles.overlay}>
          <div style={styles.progressModal}>
            <h4 style={styles.progressTitle}>{progressAction}</h4>
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${progress}%`,
                }}
              />
            </div>
            <p style={styles.progressText}>{progress}%</p>
            <p style={styles.progressHint}>
              {progress >= 99 ? '等待操作完成...' : '正在执行，请稍候...'}
            </p>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmAction && !showProgress && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>确认操作</h4>
            <p style={styles.modalText}>确定要执行 "{getActionLabel(confirmAction)}" 操作吗？</p>
            <div style={styles.modalButtons}>
              <button onClick={handleCancel} style={styles.cancelBtn}>
                取消
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                style={styles.confirmBtn}
              >
                {loading ? '执行中...' : '确认'}
              </button>
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
    gap: '20px',
  },
  section: {
    padding: '16px',
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '12px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    color: '#fff',
  },
  startButton: {
    backgroundColor: '#34C759',
    color: '#fff',
  },
  restartButton: {
    backgroundColor: '#FF9500',
    color: '#fff',
  },
  tomcatButton: {
    backgroundColor: '#5856D6',
    color: '#fff',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '12px',
    minWidth: '280px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#1D1D1F',
  },
  modalText: {
    fontSize: '14px',
    color: '#86868B',
    marginBottom: '20px',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  cancelBtn: {
    padding: '8px 20px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  confirmBtn: {
    padding: '8px 20px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  // 进度条样式
  progressModal: {
    backgroundColor: '#fff',
    padding: '32px',
    borderRadius: '12px',
    minWidth: '320px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  progressTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#1D1D1F',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#E5E5EA',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '8px',
  },
  progressHint: {
    fontSize: '12px',
    color: '#86868B',
  },
};

export default PosControlTab;
