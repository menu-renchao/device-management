import React, { useEffect } from 'react';

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div style={styles.container}>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      case 'info':
      default:
        return 'i';
    }
  };

  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          backgroundColor: '#F0F9EB',
          borderColor: '#E1F3D8',
          iconBg: '#67C23A',
          color: '#67C23A',
        };
      case 'error':
        return {
          backgroundColor: '#FEF0F0',
          borderColor: '#FDE2E2',
          iconBg: '#F56C6C',
          color: '#F56C6C',
        };
      case 'warning':
        return {
          backgroundColor: '#FDF6EC',
          borderColor: '#FAECD8',
          iconBg: '#E6A23C',
          color: '#E6A23C',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#F4F4F5',
          borderColor: '#E9E9EB',
          iconBg: '#909399',
          color: '#909399',
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <div style={{
      ...styles.toast,
      backgroundColor: typeStyles.backgroundColor,
      borderColor: typeStyles.borderColor,
    }}>
      <div style={{
        ...styles.icon,
        backgroundColor: typeStyles.iconBg,
      }}>
        {getIcon()}
      </div>
      <div style={styles.message}>{toast.message}</div>
      <button onClick={onClose} style={styles.closeBtn}>×</button>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '400px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    border: '1px solid',
    animation: 'slideIn 0.3s ease',
    minWidth: '280px',
  },
  icon: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: '13px',
    color: '#1D1D1F',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#86868B',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
};

// 添加动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(styleSheet);

export default ToastContainer;
