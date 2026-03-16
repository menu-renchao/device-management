import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/favicon.ico" alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Menusifu设备管理平台</h1>
        <p style={styles.subtitle}>登录您的账户以继续</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="请输入密码"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={{
            ...styles.button,
            ...(loading ? styles.buttonLoading : {})
          }} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={styles.footer}>
          还没有账户？
          <Link to="/register" style={styles.link}>立即注册</Link>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #d2d6da 0%, #bcc2c8 100%)',
    padding: '16px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.2)',
  },
  logo: {
    width: '48px',
    height: '48px',
    objectFit: 'contain',
    margin: '0 auto 16px',
    display: 'block',
  },
  title: {
    fontSize: '22px',
    fontWeight: '600',
    textAlign: 'center',
    color: '#1D1D1F',
    marginBottom: '4px',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '13px',
    textAlign: 'center',
    color: '#86868B',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  button: {
    padding: '12px',
    background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: '4px',
  },
  buttonLoading: {
    opacity: '0.7',
    cursor: 'not-allowed',
  },
  error: {
    padding: '10px 12px',
    backgroundColor: '#FFF2F0',
    border: '1px solid #FFCCC7',
    borderRadius: '8px',
    color: '#FF4D4F',
    fontSize: '13px',
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: '16px',
    fontSize: '13px',
    color: '#86868B',
  },
  link: {
    color: '#007AFF',
    textDecoration: 'none',
    fontWeight: '500',
    marginLeft: '3px',
  },
};

export default LoginPage;
