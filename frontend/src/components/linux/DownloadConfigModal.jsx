import React, { useState, useEffect } from 'react';
import { linuxAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const DownloadConfigModal = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [cookie, setCookie] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const result = await linuxAPI.getDownloadConfig();
      setCookie(result.data?.cookie || '');
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await linuxAPI.updateDownloadConfig(cookie);
      toast.success('配置保存成功');
      onClose();
    } catch (error) {
      toast.error('保存失败：' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>下载配置</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <div style={styles.body}>
          <div style={styles.formGroup}>
            <label style={styles.label}>下载 Cookie</label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="粘贴 Cookie 字符串..."
              style={styles.textarea}
            />
            <p style={styles.hint}>从浏览器开发者工具中复制 Cookie</p>
          </div>
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>取消</button>
          <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? '保存中...' : '保存'}
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '500px',
    maxWidth: '90vw',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E5EA',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#86868B',
  },
  body: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    height: '100px',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '11px',
    color: '#86868B',
    marginTop: '6px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid #E5E5EA',
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default DownloadConfigModal;
