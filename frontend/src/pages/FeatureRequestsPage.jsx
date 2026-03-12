import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { featureRequestAPI } from '../services/api';

const initialForm = {
  title: '',
  content: '',
};

const sortOptions = [
  { value: 'hot', label: '最热' },
  { value: 'latest', label: '最新' },
];

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待评估' },
  { value: 'planned', label: '计划中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
];

const statusMeta = {
  pending: { label: '待评估', background: 'rgba(255, 149, 0, 0.12)', color: '#FF9500' },
  planned: { label: '计划中', background: 'rgba(0, 122, 255, 0.12)', color: '#007AFF' },
  completed: { label: '已完成', background: 'rgba(52, 199, 89, 0.12)', color: '#34C759' },
  rejected: { label: '已拒绝', background: 'rgba(142, 142, 147, 0.12)', color: '#8E8E93' },
};

const FeatureRequestsPage = () => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState('hot');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [statusActingId, setStatusActingId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, [sort, status]);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await featureRequestAPI.getFeatureRequests({
        sort,
        status,
        page: 1,
        pageSize: 50,
      });
      setItems(response?.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.error || '加载意见列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      setFormError('请输入标题');
      return;
    }

    if (!content) {
      setFormError('请输入内容');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const response = await featureRequestAPI.createFeatureRequest({ title, content });
      const createdItem = response?.data;
      if (createdItem) {
        setItems((current) => [createdItem, ...current]);
      } else {
        await loadRequests();
      }
      setForm(initialForm);
      setShowComposer(false);
    } catch (err) {
      setFormError(err?.response?.data?.error || '提交意见失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (item) => {
    setActingId(item.id);
    setError('');

    const previousItems = items;
    setItems((current) =>
      current.map((entry) => {
        if (entry.id !== item.id) {
          return entry;
        }

        const nextLiked = !entry.liked_by_me;
        return {
          ...entry,
          liked_by_me: nextLiked,
          like_count: nextLiked ? entry.like_count + 1 : Math.max(0, entry.like_count - 1),
        };
      })
    );

    try {
      if (item.liked_by_me) {
        await featureRequestAPI.unlikeFeatureRequest(item.id);
      } else {
        await featureRequestAPI.likeFeatureRequest(item.id);
      }
    } catch (err) {
      setItems(previousItems);
      setError(err?.response?.data?.error || '点赞操作失败');
    } finally {
      setActingId(null);
    }
  };

  const handleStatusChange = async (itemId, nextStatus) => {
    setStatusActingId(itemId);
    setError('');

    const previousItems = items;
    setItems((current) =>
      current.map((entry) => (entry.id === itemId ? { ...entry, status: nextStatus } : entry))
    );

    try {
      await featureRequestAPI.updateFeatureRequestStatus(itemId, nextStatus);
    } catch (err) {
      setItems(previousItems);
      setError(err?.response?.data?.error || '更新状态失败');
    } finally {
      setStatusActingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>意见收集</h1>
          <p style={styles.subtitle}>所有登录用户都可以提交建议并点赞，帮助我们识别更高优先级的适配需求。</p>
        </div>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={() => {
            setShowComposer(true);
            setFormError('');
          }}
        >
          提交意见
        </button>
      </div>

      <div style={styles.toolbarCard}>
        <div style={styles.toolbarGroup}>
          <div style={styles.tabsContainer}>
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                style={{
                  ...styles.tab,
                  ...(sort === option.value ? styles.activeTab : {}),
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={styles.select}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {showComposer ? (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>新意见</h2>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => {
                setShowComposer(false);
                setForm(initialForm);
                setFormError('');
              }}
            >
              关闭
            </button>
          </div>
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="一句话概括你的需求"
              style={styles.input}
              maxLength={200}
            />
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="描述问题场景、影响对象、希望如何改进"
              style={styles.textarea}
              rows={5}
            />
            {formError ? <div style={styles.formError}>{formError}</div> : null}
            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setForm(initialForm);
                  setFormError('');
                }}
                disabled={submitting}
              >
                清空
              </button>
              <button type="submit" style={styles.primaryButton} disabled={submitting}>
                {submitting ? '提交中...' : '发布意见'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? <div style={styles.infoCard}>正在加载意见列表...</div> : null}

      {!loading && items.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>还没有意见</p>
          <p style={styles.emptyText}>欢迎提交第一条建议，让产品优化方向更透明。</p>
        </div>
      ) : null}

      {!loading ? (
        <div style={styles.list}>
          {items.map((item) => {
            const meta = statusMeta[item.status] || statusMeta.pending;
            return (
              <article key={item.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardMeta}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: meta.background,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span style={styles.metaText}>
                      {item.author?.display || item.author?.username || '未知用户'} · {formatDate(item.created_at)}
                    </span>
                  </div>
                </div>

                <h2 style={styles.requestTitle}>{item.title}</h2>
                <p style={styles.requestContent}>{item.content}</p>

                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() => handleToggleLike(item)}
                    disabled={actingId === item.id}
                    style={{
                      ...styles.likeButton,
                      ...(item.liked_by_me ? styles.likeButtonActive : {}),
                    }}
                  >
                    {actingId === item.id ? '处理中...' : item.liked_by_me ? '已点赞' : '点赞'}
                  </button>
                  <span style={styles.supportText}>{item.like_count} 人支持</span>
                  {isAdmin() ? (
                    <div style={styles.adminControls}>
                      <span style={styles.adminLabel}>状态</span>
                      <select
                        value={item.status}
                        disabled={statusActingId === item.id}
                        onChange={(event) => handleStatusChange(item.id, event.target.value)}
                        style={styles.select}
                      >
                        {statusOptions
                          .filter((option) => option.value !== 'all')
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

function formatDate(value) {
  if (!value) {
    return '刚刚';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: '0 0 4px 0',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#86868B',
    lineHeight: 1.6,
  },
  toolbarCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
  },
  toolbarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  tabsContainer: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#F2F2F7',
    padding: '4px',
    borderRadius: '10px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#86868B',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    color: '#007AFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    color: '#1D1D1F',
    minWidth: '120px',
  },
  error: {
    padding: '10px 14px',
    backgroundColor: '#FFF2F0',
    border: '1px solid #FFCCC7',
    borderRadius: '8px',
    color: '#FF4D4F',
    marginBottom: '16px',
    fontSize: '13px',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  requestTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: '0 0 10px 0',
  },
  requestContent: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#3C3C43',
    whiteSpace: 'pre-wrap',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  metaText: {
    fontSize: '13px',
    color: '#86868B',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    minHeight: '140px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  formError: {
    color: '#FF4D4F',
    fontSize: '13px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '10px 18px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 18px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  linkButton: {
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#007AFF',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  infoCard: {
    padding: '20px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
    color: '#86868B',
    fontSize: '14px',
    marginBottom: '16px',
  },
  empty: {
    padding: '32px 24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  emptyText: {
    margin: 0,
    fontSize: '13px',
    color: '#86868B',
    lineHeight: 1.6,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  likeButton: {
    padding: '8px 14px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#1D1D1F',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  likeButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderColor: 'rgba(0, 122, 255, 0.2)',
    color: '#007AFF',
  },
  supportText: {
    fontSize: '13px',
    color: '#86868B',
  },
  adminControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  adminLabel: {
    fontSize: '12px',
    color: '#86868B',
    fontWeight: '500',
  },
};

export default FeatureRequestsPage;
