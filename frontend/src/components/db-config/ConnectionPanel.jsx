import React from 'react';

const ConnectionPanel = ({
  form,
  hasPassword = false,
  onTest,
  testing,
  showRestartPOS = false,
  onRestartPOS,
  restartingPOS = false,
}) => {
  return (
    <div style={styles.card}>
      <div style={styles.inlineRow}>
        <h3 style={styles.title}>设备数据库连接</h3>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>主机</span>
          <span style={styles.value}>{form.host || '-'}</span>
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>端口</span>
          <span style={styles.value}>{form.port || '-'}</span>
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>库名</span>
          <span style={styles.value}>{form.database_name || '-'}</span>
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>用户</span>
          <span style={styles.value}>{form.username || '-'}</span>
        </div>

        <div style={styles.inlineField}>
          <span style={styles.inlineLabel}>密码</span>
          <span style={styles.passwordStatus}>
            {hasPassword ? '已配置' : '未配置'}
          </span>
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
              ...(restartingPOS || typeof onRestartPOS !== 'function' ? styles.disabled : {}),
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
  inlineLabel: {
    fontSize: '12px',
    color: '#86868B',
    fontWeight: 500,
    flex: '0 0 auto',
  },
  value: {
    fontSize: '12px',
    color: '#1D1D1F',
    padding: '4px 0',
  },
  passwordStatus: {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: 500,
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
