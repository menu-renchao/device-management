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
      setError('\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
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
          <h1 style={styles.title}>\u8BBE\u5907\u7BA1\u7406\u5E73\u53F0</h1>
          <p style={styles.subtitle}>\u767B\u5F55\u60A8\u7684\u8D26\u6237\u4EE5\u7EE7\u7EED</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field label="\u7528\u6237\u540D" htmlFor="login-username">
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u7528\u6237\u540D"
              required
            />
          </Field>

          <Field label="\u5BC6\u7801" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u5BC6\u7801"
              required
            />
          </Field>

          {error ? <div style={styles.error}>{error}</div> : null}

          <Button type="submit" variant="primary" loading={loading} style={styles.submitButton}>
            {loading ? '\u767B\u5F55\u4E2D...' : '\u767B\u5F55'}
          </Button>
        </form>

        <div style={styles.footer}>
          <span>\u8FD8\u6CA1\u6709\u8D26\u6237\uFF1F</span>
          <Link to="/register" style={styles.link}>
            \u7ACB\u5373\u6CE8\u518C
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
