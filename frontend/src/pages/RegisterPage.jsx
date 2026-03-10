import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { authService } from '../services/authService';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.register(username, password, email, name);
      if (result.success) {
        setSuccess(true);
        return;
      }

      setError(result.error);
    } catch (error) {
      setError('\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.glow} />
        <div style={styles.panel}>
          <div style={styles.successIcon}>OK</div>
          <h1 style={styles.title}>\u6CE8\u518C\u6210\u529F</h1>
          <p style={styles.subtitle}>\u60A8\u7684\u6CE8\u518C\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5F85\u7BA1\u7406\u5458\u5BA1\u6838\u3002</p>
          <Button type="button" variant="primary" style={styles.submitButton} onClick={() => navigate('/login')}>
            \u8FD4\u56DE\u767B\u5F55
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.panel}>
        <div style={styles.hero}>
          <img src="/favicon.ico" alt="Logo" style={styles.logo} />
          <div style={styles.eyebrow}>Menusifu Device Management</div>
          <h1 style={styles.title}>\u521B\u5EFA\u8D26\u6237</h1>
          <p style={styles.subtitle}>\u6CE8\u518C\u4EE5\u4F7F\u7528 Menusifu \u8BBE\u5907\u7BA1\u7406\u5E73\u53F0</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field label="\u7528\u6237\u540D" htmlFor="register-username">
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u7528\u6237\u540D"
              required
              minLength={3}
            />
          </Field>

          <Field label="\u59D3\u540D" htmlFor="register-name">
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u771F\u5B9E\u59D3\u540D"
              required
            />
          </Field>

          <Field label="\u90AE\u7BB1" htmlFor="register-email" helpText="\u53EF\u9009\u586B\u5199\uFF0C\u7528\u4E8E\u63A5\u6536\u901A\u77E5">
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u90AE\u7BB1\u5730\u5740"
            />
          </Field>

          <Field label="\u5BC6\u7801" htmlFor="register-password" helpText="\u81F3\u5C11 6 \u4F4D\u5B57\u7B26">
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="\u8BF7\u8F93\u5165\u5BC6\u7801"
              required
              minLength={6}
            />
          </Field>

          <Field label="\u786E\u8BA4\u5BC6\u7801" htmlFor="register-confirm-password">
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="\u8BF7\u518D\u6B21\u8F93\u5165\u5BC6\u7801"
              required
            />
          </Field>

          {error ? <div style={styles.error}>{error}</div> : null}

          <Button type="submit" variant="primary" loading={loading} style={styles.submitButton}>
            {loading ? '\u6CE8\u518C\u4E2D...' : '\u6CE8\u518C'}
          </Button>
        </form>

        <div style={styles.footer}>
          <span>\u5DF2\u6709\u8D26\u6237\uFF1F</span>
          <Link to="/login" style={styles.link}>
            \u7ACB\u5373\u767B\u5F55
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
    background: 'radial-gradient(circle at top, rgba(52, 199, 89, 0.14), transparent 34%), linear-gradient(180deg, #f7f8fb 0%, #eff1f6 100%)',
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
    maxWidth: '440px',
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
    marginBottom: '22px',
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
    textAlign: 'center',
  },
  subtitle: {
    margin: '10px 0 0',
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  successIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '58px',
    height: '58px',
    margin: '0 auto 18px',
    borderRadius: '999px',
    background: 'rgba(52, 199, 89, 0.12)',
    color: 'var(--accent-green)',
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: '0.06em',
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

export default RegisterPage;
