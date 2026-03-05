import React, { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

const TemplateModal = ({ isOpen, template, onClose, onSubmit, saving }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    sql_content: '',
    need_restart: false,
    remark: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setForm({
        name: template.name || '',
        sql_content: template.sql_content || '',
        need_restart: !!template.need_restart,
        remark: template.remark || '',
      });
    } else {
      setForm({
        name: '',
        sql_content: '',
        need_restart: false,
        remark: '',
      });
    }
  }, [isOpen, template]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.warning('请输入模板名称');
      return;
    }
    if (!form.sql_content.trim()) {
      toast.warning('请输入 SQL 内容');
      return;
    }
    onSubmit({
      name: form.name.trim(),
      sql_content: form.sql_content.trim(),
      need_restart: !!form.need_restart,
      remark: form.remark.trim(),
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>{template ? '编辑 SQL 模板' : '新增 SQL 模板'}</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          <div style={styles.field}>
            <label style={styles.label}>名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：重置测试账号状态"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>SQL（支持多条，使用分号分隔）</label>
            <textarea
              value={form.sql_content}
              onChange={(e) => setForm({ ...form, sql_content: e.target.value })}
              placeholder="UPDATE ...;\nDELETE ...;"
              style={styles.textarea}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>备注</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="填写用途说明（可选）"
              style={{ ...styles.textarea, minHeight: '80px' }}
            />
          </div>

          <div style={styles.switchRow}>
            <label style={styles.switchLabel}>
              <input
                type="checkbox"
                checked={form.need_restart}
                onChange={(e) => setForm({ ...form, need_restart: e.target.checked })}
              />
              <span>重启生效</span>
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>取消</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ ...styles.saveBtn, ...(saving ? styles.disabled : {}) }}
          >
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    width: '760px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    backgroundColor: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #E5E5EA',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#1D1D1F',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#86868B',
    fontSize: '24px',
    lineHeight: 1,
  },
  body: {
    padding: '16px 18px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#86868B',
    fontSize: '12px',
    fontWeight: 500,
  },
  input: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '13px',
    outline: 'none',
  },
  textarea: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    outline: 'none',
    minHeight: '180px',
    resize: 'vertical',
    fontFamily: 'Consolas, "Courier New", monospace',
  },
  switchRow: {
    display: 'flex',
    alignItems: 'center',
  },
  switchLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#1D1D1F',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 18px 16px 18px',
    borderTop: '1px solid #E5E5EA',
  },
  cancelBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    backgroundColor: '#007AFF',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default TemplateModal;
