import React, { useState, useEffect } from 'react';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'danger', // 'danger' | 'primary'
  // 输入框相关
  showInput = false,
  inputPlaceholder = '',
  inputLabel = '',
  onConfirmWithInput,
}) => {
  const [inputValue, setInputValue] = useState('');

  // 每次打开时清空输入框
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (showInput && onConfirmWithInput) {
      onConfirmWithInput(inputValue);
    } else {
      onConfirm();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.dialog, width: showInput ? '400px' : '360px' }}>
        <div style={styles.header}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#FF9500"/>
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
              backgroundColor: variant === 'primary' ? '#007AFF' : '#FF3B30',
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '90%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
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
    color: '#1D1D1F',
  },
  body: {
    padding: '0 20px 20px',
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
  },
  inputContainer: {
    marginTop: '16px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #E5E5EA',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1D1D1F',
    cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#FF3B30',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'white',
    cursor: 'pointer',
  },
};

export default ConfirmDialog;
