import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { useToast } from '../contexts/ToastContext';

const ProfilePage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // 修改密码表单
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // 修改个人信息表单
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: ''
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  // 修改密码
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword) {
      toast.warning('请输入当前密码');
      return;
    }

    if (!passwordForm.newPassword) {
      toast.warning('请输入新密码');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.warning('新密码至少6个字符');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warning('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      if (result.success) {
        toast.success('密码修改成功');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        toast.error(result.error || '密码修改失败');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  // 修改个人信息
  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (!profileForm.name) {
      toast.warning('姓名不能为空');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.updateProfile({
        name: profileForm.name,
        email: profileForm.email
      });

      if (result.success) {
        toast.success('个人信息更新成功');
      } else {
        toast.error(result.error || '更新失败');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>个人中心</h1>
      </div>

      <div style={styles.content}>
        {/* 用户信息卡片 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>基本信息</h2>
          <div style={styles.info}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>用户名</span>
              <span style={styles.infoValue}>{user?.username}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>角色</span>
              <span style={styles.infoValue}>
                {user?.role === 'admin' ? '管理员' : user?.role === 'manager' ? '负责人' : '普通用户'}
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>姓名</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                style={styles.input}
                placeholder="请输入姓名"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>邮箱</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                style={styles.input}
                placeholder="请输入邮箱"
              />
            </div>
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
          </form>
        </div>

        {/* 修改密码卡片 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>修改密码</h2>
          <form onSubmit={handleChangePassword} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>当前密码</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                style={styles.input}
                placeholder="请输入当前密码"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>新密码</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                style={styles.input}
                placeholder="请输入新密码（至少6个字符）"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>确认新密码</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                style={styles.input}
                placeholder="请再次输入新密码"
                required
              />
            </div>
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: '0 0 20px 0',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  info: {
    marginBottom: '20px',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #F2F2F7',
  },
  infoLabel: {
    fontSize: '14px',
    color: '#86868B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: '14px',
    color: '#1D1D1F',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#86868B',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  btn: {
    padding: '10px 20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    alignSelf: 'flex-start',
  },
};

export default ProfilePage;
