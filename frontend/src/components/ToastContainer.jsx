import React, { useEffect } from 'react';

const TOAST_ANIMATION_ID = 'toast-container-animations';

const ensureAnimationStyles = () => {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(TOAST_ANIMATION_ID)) {
    return;
  }

  const styleSheet = document.createElement('style');
  styleSheet.id = TOAST_ANIMATION_ID;
  styleSheet.textContent = `
    @keyframes toastSlideIn {
      from {
        transform: translate3d(24px, 0, 0);
        opacity: 0;
      }
      to {
        transform: translate3d(0, 0, 0);
        opacity: 1;
      }
    }
  `;

  document.head.appendChild(styleSheet);
};

const ToastContainer = ({ toasts, removeToast }) => {
  useEffect(() => {
    ensureAnimationStyles();
  }, []);

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
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

  const tone = getToastTone(toast.type);

  return (
    <div
      style={{
        ...styles.toast,
        borderColor: tone.borderColor,
      }}
    >
      <div
        style={{
          ...styles.icon,
          backgroundColor: tone.iconBg,
        }}
      >
        {tone.icon}
      </div>
      <div style={styles.message}>{toast.message}</div>
      <button aria-label="Close notification" onClick={onClose} style={styles.closeBtn}>
        x
      </button>
    </div>
  );
};

const getToastTone = (type) => {
  switch (type) {
    case 'success':
      return {
        icon: 'OK',
        iconBg: 'var(--accent-green)',
        borderColor: 'rgba(52, 199, 89, 0.24)',
      };
    case 'error':
      return {
        icon: 'x',
        iconBg: 'var(--accent-red)',
        borderColor: 'rgba(255, 59, 48, 0.24)',
      };
    case 'warning':
      return {
        icon: '!',
        iconBg: 'var(--accent-orange)',
        borderColor: 'rgba(255, 149, 0, 0.24)',
      };
    case 'info':
    default:
      return {
        icon: 'i',
        iconBg: 'var(--accent-blue)',
        borderColor: 'var(--border-subtle)',
      };
  }
};

const styles = {
  container: {
    position: 'fixed',
    top: 'var(--space-4)',
    right: 'var(--space-4)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    maxWidth: '420px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '280px',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    animation: 'toastSlideIn 0.18s ease-out',
  },
  icon: {
    width: '22px',
    height: '22px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.02em',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    minWidth: 0,
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px',
    lineHeight: 1,
    flexShrink: 0,
  },
};

export default ToastContainer;
