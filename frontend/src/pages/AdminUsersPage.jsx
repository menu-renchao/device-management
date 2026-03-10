import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import PageShell from '../components/ui/PageShell';
import SectionGroup from '../components/ui/SectionGroup';
import StatusBadge from '../components/ui/StatusBadge';
import Toolbar from '../components/ui/Toolbar';
import { useToast } from '../contexts/ToastContext';
import { adminService } from '../services/authService';

const API_BASE = '/api/admin';

const createAuthAxios = () => {
  const token = localStorage.getItem('access_token');
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

const AdminUsersPage = () => {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, data: null });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'user',
    status: 'approved',
  });

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredUsers(users);
      return;
    }

    const keyword = searchText.toLowerCase();
    const nextUsers = users.filter((user) =>
      [user.username, user.email, user.name].some((value) => (value || '').toLowerCase().includes(keyword)),
    );
    setFilteredUsers(nextUsers);
  }, [searchText, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await adminService.getUsers(statusFilter);
      if (result.success && result.data) {
        const nextUsers = result.data.users || result.users || [];
        setUsers(nextUsers);
        setFilteredUsers(nextUsers);
        setError('');
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    setFormData({ username: '', email: '', name: '', password: '', role: 'user', status: 'approved' });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name || '',
      password: '',
      role: user.role,
      status: user.status,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleSaveUser = async () => {
    if (!formData.username || !formData.name) {
      toast.warning('用户名和姓名不能为空');
      return;
    }
    if (modalMode === 'create' && !formData.password) {
      toast.warning('密码不能为空');
      return;
    }
    if (formData.password && formData.password.length < 6) {
      toast.warning('密码至少 6 个字符');
      return;
    }

    try {
      const authAxios = createAuthAxios();
      if (modalMode === 'create') {
        await authAxios.post('/users', {
          username: formData.username,
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: formData.role,
          status: formData.status,
        });
        toast.success('用户创建成功');
      } else {
        await authAxios.put(`/users/${selectedUser.id}`, {
          username: formData.username,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          status: formData.status,
        });
        if (formData.password) {
          await adminService.resetUserPassword(selectedUser.id, formData.password);
        }
        toast.success('用户更新成功');
      }
      fetchUsers();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleApprove = async (userId) => {
    try {
      const result = await adminService.approveUser(userId);
      if (result.success) {
        toast.success('用户审核通过');
        fetchUsers();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleReject = (userId) => setConfirmDialog({ show: true, type: 'rejectUser', data: userId });
  const handleDelete = (userId) => setConfirmDialog({ show: true, type: 'deleteUser', data: userId });

  const confirmAction = async () => {
    const { type, data } = confirmDialog;
    setConfirmDialog({ show: false, type: null, data: null });

    try {
      if (type === 'rejectUser') {
        const result = await adminService.rejectUser(data);
        if (result.success) {
          toast.success('已拒绝该用户');
          fetchUsers();
        } else {
          toast.error(result.error);
        }
      }

      if (type === 'deleteUser') {
        const result = await adminService.deleteUser(data);
        if (result.success) {
          toast.success('用户已删除');
          fetchUsers();
        } else {
          toast.error(result.error);
        }
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const getConfirmConfig = () => {
    switch (confirmDialog.type) {
      case 'rejectUser':
        return { title: '确认拒绝', message: '确定要拒绝此用户吗？', confirmText: '拒绝' };
      case 'deleteUser':
        return {
          title: '确认删除',
          message: '确定要删除此用户吗？此操作不可恢复。',
          confirmText: '删除',
        };
      default:
        return { title: '确认', message: '', confirmText: '确定' };
    }
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'approved':
        return { tone: 'success', label: '已通过' };
      case 'rejected':
        return { tone: 'danger', label: '已拒绝' };
      case 'pending':
      default:
        return { tone: 'warning', label: '待审核' };
    }
  };

  const getRoleTone = (role) => (role === 'admin' ? { tone: 'info', label: '管理员' } : { tone: 'neutral', label: '用户' });

  return (
    <PageShell
      eyebrow="Admin"
      title="管理中心"
      subtitle="统一管理用户账户、注册审核和账户状态。"
      actions={<Button variant="primary" onClick={openCreateModal}>+ 添加用户</Button>}
    >
      {error ? <div style={styles.error}>{error}</div> : null}

      <SectionGroup title="用户列表" description="保持高密度列表，但统一为更清晰的系统设置风格。">
        <Toolbar
          left={
            <>
              <Field label="筛选状态" htmlFor="admin-status-filter">
                <select id="admin-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">全部</option>
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </Field>
              <Field label="搜索" htmlFor="admin-user-search">
                <input
                  id="admin-user-search"
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索用户名 / 邮箱 / 姓名"
                />
              </Field>
            </>
          }
          right={<StatusBadge tone="neutral" dot={false}>{`${filteredUsers.length} 个用户`}</StatusBadge>}
        />

        {loading ? (
          <div style={styles.state}>Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={styles.state}>{searchText ? '未找到匹配用户' : '暂无用户数据'}</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>姓名</th>
                  <th style={styles.th}>用户名</th>
                  <th style={styles.th}>邮箱</th>
                  <th style={styles.th}>角色</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>注册时间</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const status = getStatusTone(user.status);
                  const role = getRoleTone(user.role);
                  return (
                    <tr key={user.id} style={styles.row}>
                      <td style={styles.td}>{user.id}</td>
                      <td style={{ ...styles.td, fontWeight: 700 }}>{user.name || user.username}</td>
                      <td style={styles.td}>{user.username}</td>
                      <td style={styles.td}>{user.email || '--'}</td>
                      <td style={styles.td}><StatusBadge tone={role.tone}>{role.label}</StatusBadge></td>
                      <td style={styles.td}><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                      <td style={styles.td}>{new Date(user.created_at).toLocaleString('zh-CN')}</td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <Button variant="secondary" onClick={() => openEditModal(user)}>编辑</Button>
                          {user.status === 'pending' ? (
                            <>
                              <Button variant="primary" onClick={() => handleApprove(user.id)}>通过</Button>
                              <Button variant="danger" onClick={() => handleReject(user.id)}>拒绝</Button>
                            </>
                          ) : null}
                          <Button variant="tertiary" onClick={() => handleDelete(user.id)}>删除</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionGroup>

      {showModal ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{modalMode === 'create' ? '添加用户' : '编辑用户'}</h3>
              <Button variant="icon" onClick={closeModal}>x</Button>
            </div>
            <div style={styles.modalBody}>
              <Field label="用户名 *" htmlFor="admin-user-username">
                <input id="admin-user-username" type="text" value={formData.username} onChange={(event) => setFormData({ ...formData, username: event.target.value })} />
              </Field>
              <Field label="姓名 *" htmlFor="admin-user-name">
                <input id="admin-user-name" type="text" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
              </Field>
              <Field label="邮箱" htmlFor="admin-user-email">
                <input id="admin-user-email" type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
              </Field>
              <Field label={modalMode === 'create' ? '密码 *' : '密码（留空不修改）'} htmlFor="admin-user-password">
                <input id="admin-user-password" type="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} />
              </Field>
              <Field label="角色" htmlFor="admin-user-role">
                <select id="admin-user-role" value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })}>
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </Field>
              <Field label="状态" htmlFor="admin-user-state">
                <select id="admin-user-state" value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value })}>
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </Field>
            </div>
            <div style={styles.modalActions}>
              <Button variant="secondary" onClick={closeModal}>取消</Button>
              <Button variant="primary" onClick={handleSaveUser}>{modalMode === 'create' ? '创建' : '保存'}</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title={getConfirmConfig().title}
        message={getConfirmConfig().message}
        onConfirm={confirmAction}
        onCancel={() => setConfirmDialog({ show: false, type: null, data: null })}
        confirmText={getConfirmConfig().confirmText}
      />
    </PageShell>
  );
};

const styles = {
  error: {
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 59, 48, 0.16)',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    color: 'var(--accent-red)',
    fontSize: '13px',
  },
  state: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
    backgroundColor: 'var(--bg-surface)',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--bg-surface-muted)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  row: {
    borderBottom: '1px solid rgba(229, 229, 234, 0.7)',
  },
  td: {
    padding: '12px 14px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    verticalAlign: 'top',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    backdropFilter: 'blur(10px)',
    zIndex: 1200,
  },
  modalCard: {
    width: '100%',
    maxWidth: '460px',
    borderRadius: '20px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '20px 20px 12px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '0 20px 20px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface-muted)',
  },
};

export default AdminUsersPage;

