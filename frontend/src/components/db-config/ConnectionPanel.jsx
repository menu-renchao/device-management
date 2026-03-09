import React, { useState } from 'react';

const ConnectionPanel = ({
  form,
  onFormChange,
  onTest,
  testing,
  deviceIP,
  showRestartPOS = false,
  onRestartPOS,
  restartingPOS = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={styles.card}>
      <div style={styles.inlineRow}>
        <h3 style={styles.title}>设备数据库连接</h3>
        <span style={styles.meta}>
          {deviceIP ? `IP: ${deviceIP}` : '未获取到当前设备IP'}
        </span>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>主机</span>
          <input
            type="text"
            value={form.host}
            onChange={(e) => onFormChange('host', e.target.value)}
            placeholder="192.168.1.100"
            style={{ ...styles.input, ...styles.hostInput, ...styles.readonlyInput }}
            readOnly
            disabled
          />
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>端口</span>
          <input
            type="number"
            value={form.port}
            onChange={(e) => onFormChange('port', Number(e.target.value) || 22108)}
            style={{ ...styles.input, ...styles.portInput }}
          />
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>库名</span>
          <input
            type="text"
            value={form.database_name}
            onChange={(e) => onFormChange('database_name', e.target.value)}
            placeholder="kpos"
            style={{ ...styles.input, ...styles.databaseInput }}
          />
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>用户</span>
          <input
            type="text"
            value={form.username}
            onChange={(e) => onFormChange('username', e.target.value)}
            placeholder="root"
            style={{ ...styles.input, ...styles.usernameInput, ...styles.readonlyInput }}
            readOnly
            disabled
          />
        </div>

        <div style={styles.passwordField}>
          <span style={styles.inlineLabel}>密码</span>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => onFormChange('password', e.target.value)}
            placeholder="N0mur@4$99!"
            style={{ ...styles.input, ...styles.passwordInput }}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
            {showPassword ? '隐藏' : '显示'}
          </button>
        </div>

        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          style={{ ...styles.btn, ...styles.testBtn, ...(testing ? styles.disabled : {}) }}
        >
          {testing ? '测试中...' : '测试连接'}
        </button>

        {showRestartPOS && (
          <button
            type="button"
            onClick={onRestartPOS}
            disabled={restartingPOS || typeof onRestartPOS !== 'function'}
            style={{
              ...styles.btn,
              ...styles.restartBtn,
              ...(restartingPOS || typeof onRestartPOS !== 'function' ? styles.disabled : {})
            }}
          >
            {restartingPOS ? '重启中...' : '重启POS'}
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  inlineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#1D1D1F',
    flex: '0 0 auto',
  },
  meta: {
    color: '#86868B',
    fontSize: '12px',
    backgroundColor: '#F2F2F7',
    borderRadius: '999px',
    padding: '4px 10px',
    flex: '0 0 auto',
  },
  inlineField: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: '0 0 auto',
  },
  passwordField: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: '0 0 auto',
  },
  inlineLabel: {
    fontSize: '12px',
    color: '#86868B',
    fontWeight: 500,
    flex: '0 0 auto',
  },
  input: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
    height: '32px',
    boxSizing: 'border-box',
  },
  hostInput: { width: '170px' },
  portInput: { width: '88px' },
  databaseInput: { width: '120px' },
  usernameInput: { width: '90px' },
  passwordInput: { width: '170px' },
  readonlyInput: {
    backgroundColor: '#F7F7FA',
    color: '#6C6C70',
    cursor: 'not-allowed',
  },
  toggleBtn: {
    border: '1px solid #D1D1D6',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    borderRadius: '8px',
    padding: '0 10px',
    height: '32px',
    fontSize: '12px',
    cursor: 'pointer',
    flex: '0 0 auto',
  },
  btn: {
    border: 'none',
    borderRadius: '8px',
    padding: '7px 12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
  testBtn: {
    backgroundColor: '#5AC8FA',
  },
  restartBtn: {
    backgroundColor: '#FF9500',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default ConnectionPanel;
