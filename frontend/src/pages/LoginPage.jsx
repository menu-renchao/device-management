import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/');
        return;
      }

      setError(result.error);
    } catch (error) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.panel}>
        <div style={styles.hero}>
          <img src="/favicon.ico" alt="Logo" style={styles.logo} />
          <div style={styles.eyebrow}>Menusifu Device Management</div>
          <h1 style={styles.title}>设备管理平台</h1>
          <p style={styles.subtitle}>登录您的账户以继续</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field label="用户名" htmlFor="login-username">
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
              required
            />
          </Field>

          <Field label="密码" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              required
            />
          </Field>

          {error ? <div style={styles.error}>{error}</div> : null}

          <Button type="submit" variant="primary" loading={loading} style={styles.submitButton}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div style={styles.footer}>
          <span>还没有账户？</span>
          <Link to="/register" style={styles.link}>
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '24px',
    background: 'radial-gradient(circle at top, rgba(0, 122, 255, 0.16), transparent 36%), linear-gradient(180deg, #f7f8fb 0%, #eff1f6 100%)',
  },
  glow: {
    position: 'absolute',
    width: '360px',
    height: '360px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.72)',
    filter: 'blur(36px)',
    top: '-96px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  panel: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '400px',
    padding: '28px',
    borderRadius: '24px',
    border: '1px solid rgba(229, 229, 234, 0.92)',
    background: 'rgba(255, 255, 255, 0.88)',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(18px)',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    width: '52px',
    height: '52px',
    objectFit: 'contain',
    marginBottom: '14px',
  },
  eyebrow: {
    marginBottom: '8px',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    lineHeight: 1.1,
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '10px 0 0',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  error: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 59, 48, 0.16)',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    color: 'var(--accent-red)',
    fontSize: '13px',
    lineHeight: 1.45,
    textAlign: 'center',
  },
  submitButton: {
    width: '100%',
    minHeight: '42px',
    marginTop: '6px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '18px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  link: {
    color: 'var(--accent-blue)',
    textDecoration: 'none',
    fontWeight: '600',
  },
};

export default LoginPage;

