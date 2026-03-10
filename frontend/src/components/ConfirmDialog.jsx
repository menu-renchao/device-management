import React, { useEffect, useState } from 'react';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'danger',
  showInput = false,
  inputPlaceholder = '',
  inputLabel = '',
  onConfirmWithInput,
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (showInput && onConfirmWithInput) {
      onConfirmWithInput(inputValue);
      return;
    }

    onConfirm();
  };

  return (
    <div style={styles.overlay}>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          ...styles.dialog,
          width: showInput ? '400px' : '360px',
        }}
      >
        <div style={styles.header}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="var(--accent-orange)"
            />
          </svg>
          <span style={styles.title}>{title}</span>
        </div>

        <div style={styles.body}>
          {message}
          {showInput && (
            <div style={styles.inputContainer}>
              {inputLabel && <label style={styles.inputLabel}>{inputLabel}</label>}
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                style={styles.textarea}
                rows={3}
              />
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onCancel} style={styles.cancelBtn}>
            {cancelText || '取消'}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              ...styles.confirmBtn,
              backgroundColor: variant === 'primary' ? 'var(--accent-blue)' : 'var(--accent-red)',
            }}
          >
            {confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-4)',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    backdropFilter: 'blur(10px)',
    zIndex: 9999,
  },
  dialog: {
    maxWidth: '90%',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 20px 12px',
  },
  icon: {
    width: '24px',
    height: '24px',
    flexShrink: 0,
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  body: {
    padding: '0 20px 20px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  inputContainer: {
    marginTop: '16px',
  },
  inputLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  textarea: {
    width: '100%',
    minHeight: '84px',
    resize: 'vertical',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: '14px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface-muted)',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
};

export default ConfirmDialog;

