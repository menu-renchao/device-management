import React, { useState, useEffect } from 'react';
import { linuxAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const FileConfigModal = ({ isOpen, onClose, config, onSave }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    file_path: '',
    key_values: [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
    enabled: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name,
        file_path: config.file_path,
        key_values: config.key_values && config.key_values.length > 0
          ? config.key_values
          : [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
        enabled: config.enabled
      });
    } else {
      setFormData({
        name: '',
        file_path: '',
        key_values: [{ key: '', qa_value: '', prod_value: '', dev_value: '' }],
        enabled: true
      });
    }
  }, [config, isOpen]);

  const handleAddKeyValue = () => {
    setFormData({
      ...formData,
      key_values: [...formData.key_values, { key: '', qa_value: '', prod_value: '', dev_value: '' }]
    });
  };

  const handleRemoveKeyValue = (index) => {
    const newKeyValues = formData.key_values.filter((_, i) => i !== index);
    setFormData({ ...formData, key_values: newKeyValues });
  };

  const handleKeyValueChange = (index, field, value) => {
    const newKeyValues = [...formData.key_values];
    newKeyValues[index] = { ...newKeyValues[index], [field]: value };
    setFormData({ ...formData, key_values: newKeyValues });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.file_path) {
      toast.warning('请填写配置名称和文件路径');
      return;
    }

    setSaving(true);
    try {
      if (config) {
        await linuxAPI.updateFileConfig(config.id, formData);
        toast.success('配置更新成功');
      } else {
        await linuxAPI.createFileConfig(formData);
        toast.success('配置创建成功');
      }
      onSave();
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
          <h3 style={styles.title}>{config ? '编辑配置' : '新增配置'}</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          <div style={styles.formGroup}>
            <label style={styles.label}>配置名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: cloudUrlConfig"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>文件路径 * (相对于 /opt/tomcat7/webapps/)</label>
            <input
              type="text"
              value={formData.file_path}
              onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
              placeholder="例如: kpos/front/js/cloudUrlConfig.json"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              键值对配置
              <button onClick={handleAddKeyValue} style={styles.addBtn}>+ 添加</button>
            </label>
            <div style={styles.kvList}>
              {formData.key_values.map((kv, index) => (
                <div key={index} style={styles.kvItem}>
                  <input
                    type="text"
                    value={kv.key}
                    onChange={(e) => handleKeyValueChange(index, 'key', e.target.value)}
                    placeholder="键名 (如: api.url)"
                    style={styles.kvKey}
                  />
                  <input
                    type="text"
                    value={kv.qa_value}
                    onChange={(e) => handleKeyValueChange(index, 'qa_value', e.target.value)}
                    placeholder="QA 值"
                    style={styles.kvValue}
                  />
                  <input
                    type="text"
                    value={kv.prod_value}
                    onChange={(e) => handleKeyValueChange(index, 'prod_value', e.target.value)}
                    placeholder="PROD 值"
                    style={styles.kvValue}
                  />
                  <input
                    type="text"
                    value={kv.dev_value}
                    onChange={(e) => handleKeyValueChange(index, 'dev_value', e.target.value)}
                    placeholder="DEV 值"
                    style={styles.kvValue}
                  />
                  {formData.key_values.length > 1 && (
                    <button onClick={() => handleRemoveKeyValue(index)} style={styles.removeBtn}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              启用此配置
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={styles.saveBtn}>
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
    width: '700px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
    overflowY: 'auto',
    flex: 1,
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1D1D1F',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  addBtn: {
    marginLeft: '10px',
    padding: '4px 10px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  kvList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kvItem: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  kvKey: {
    flex: '0 0 150px',
    padding: '8px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  kvValue: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  removeBtn: {
    padding: '4px 8px',
    backgroundColor: '#FF3B30',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    cursor: 'pointer',
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
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

export default FileConfigModal;
