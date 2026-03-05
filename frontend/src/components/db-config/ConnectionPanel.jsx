import React, { useState } from 'react';

const ConnectionPanel = ({
  form,
  onFormChange,
  onTest,
  testing,
  deviceIP,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>设备数据库连接</h3>
        <span style={styles.meta}>
          {deviceIP ? `当前设备IP: ${deviceIP}` : '未获取到当前设备IP'}
        </span>
      </div>

      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label}>主机</label>
          <input
            type="text"
            value={form.host}
            onChange={(e) => onFormChange('host', e.target.value)}
            placeholder="例如: 192.168.1.100"
            style={{ ...styles.input, ...styles.readonlyInput }}
            readOnly
            disabled
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>端口</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => onFormChange('port', Number(e.target.value) || 22108)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>数据库名</label>
          <input
            type="text"
            value={form.database_name}
            onChange={(e) => onFormChange('database_name', e.target.value)}
            placeholder="例如: kpos"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>用户名</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => onFormChange('username', e.target.value)}
            placeholder="例如: root"
            style={{ ...styles.input, ...styles.readonlyInput }}
            readOnly
            disabled
          />
        </div>

        <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
          <label style={styles.label}>密码</label>
          <div style={styles.passwordRow}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => onFormChange('password', e.target.value)}
              placeholder="默认: N0mur@4$99!"
              style={{ ...styles.input, flex: 1 }}
            />
            <button onClick={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
              {showPassword ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          onClick={onTest}
          disabled={testing}
          style={{ ...styles.btn, ...styles.testBtn, ...(testing ? styles.disabled : {}) }}
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#1D1D1F',
  },
  meta: {
    color: '#86868B',
    fontSize: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    color: '#86868B',
    fontWeight: 500,
  },
  input: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '13px',
    outline: 'none',
  },
  readonlyInput: {
    backgroundColor: '#F7F7FA',
    color: '#6C6C70',
    cursor: 'not-allowed',
  },
  passwordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggleBtn: {
    border: '1px solid #D1D1D6',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  actions: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  btn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  testBtn: {
    backgroundColor: '#5AC8FA',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default ConnectionPanel;
