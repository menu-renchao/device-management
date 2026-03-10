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
      setError('两次输入的密码不一致');
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
      setError('注册失败，请稍后重试');
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
          <h1 style={styles.title}>注册成功</h1>
          <p style={styles.subtitle}>您的注册申请已提交，请等待管理员审核。</p>
          <Button type="button" variant="primary" style={styles.submitButton} onClick={() => navigate('/login')}>
            返回登录
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
          <h1 style={styles.title}>创建账户</h1>
          <p style={styles.subtitle}>注册以使用 Menusifu 设备管理平台</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field label="用户名" htmlFor="register-username">
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
              required
              minLength={3}
            />
          </Field>

          <Field label="姓名" htmlFor="register-name">
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入真实姓名"
              required
            />
          </Field>

          <Field label="邮箱" htmlFor="register-email" helpText="可选填写，用于接收通知">
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入邮箱地址"
            />
          </Field>

          <Field label="密码" htmlFor="register-password" helpText="至少 6 位字符">
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              required
              minLength={6}
            />
          </Field>

          <Field label="确认密码" htmlFor="register-confirm-password">
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="请再次输入密码"
              required
            />
          </Field>

          {error ? <div style={styles.error}>{error}</div> : null}

          <Button type="submit" variant="primary" loading={loading} style={styles.submitButton}>
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <div style={styles.footer}>
          <span>已有账户？</span>
          <Link to="/login" style={styles.link}>
            立即登录
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

