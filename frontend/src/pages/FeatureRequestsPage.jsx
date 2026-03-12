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
  pending: { label: '待评估', background: '#FFF4D6', color: '#9A6700' },
  planned: { label: '计划中', background: '#DCEBFF', color: '#0B57D0' },
  completed: { label: '已完成', background: '#DCF5E7', color: '#137333' },
  rejected: { label: '已拒绝', background: '#F1F3F4', color: '#5F6368' },
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
    setItems((current) => current.map((entry) => {
      if (entry.id !== item.id) {
        return entry;
      }

      const nextLiked = !entry.liked_by_me;
      return {
        ...entry,
        liked_by_me: nextLiked,
        like_count: nextLiked ? entry.like_count + 1 : Math.max(0, entry.like_count - 1),
      };
    }));

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
    setItems((current) => current.map((entry) => (
      entry.id === itemId ? { ...entry, status: nextStatus } : entry
    )));

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
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Feature Board</p>
          <h1 style={styles.title}>意见收集</h1>
          <p style={styles.subtitle}>
            所有登录用户都可以公开提交建议并点赞，热度更高的意见会帮助我们更快识别优先适配方向。
          </p>
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
      </section>

      <section style={styles.toolbar}>
        <div style={styles.sortGroup}>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              style={{
                ...styles.toggleButton,
                ...(sort === option.value ? styles.toggleButtonActive : {}),
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
      </section>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      {showComposer ? (
        <section style={styles.composerCard}>
          <div style={styles.composerHeader}>
            <h2 style={styles.cardTitle}>新意见</h2>
            <button
              type="button"
              style={styles.ghostButton}
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
        </section>
      ) : null}

      {loading ? <div style={styles.infoCard}>正在加载意见列表...</div> : null}

      {!loading && items.length === 0 ? (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>还没有意见</h2>
          <p style={styles.emptyText}>欢迎提交第一条建议，让产品优化方向更透明。</p>
        </div>
      ) : null}

      {!loading ? (
        <div style={styles.list}>
          {items.map((item) => {
            const meta = statusMeta[item.status] || statusMeta.pending;
            return (
              <article key={item.id} style={styles.card}>
                <div style={styles.cardTop}>
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
                <h2 style={styles.cardTitle}>{item.title}</h2>
                <p style={styles.cardContent}>{item.content}</p>
                <div style={styles.cardActions}>
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
                  <span style={styles.likesText}>{item.like_count} 人支持</span>
                  {isAdmin() ? (
                    <div style={styles.adminStatusGroup}>
                      <span style={styles.adminStatusLabel}>状态</span>
                      <select
                        value={item.status}
                        disabled={statusActingId === item.id}
                        onChange={(event) => handleStatusChange(item.id, event.target.value)}
                        style={styles.adminSelect}
                      >
                        {statusOptions.filter((option) => option.value !== 'all').map((option) => (
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
  page: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '28px 24px 40px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    alignItems: 'flex-end',
    padding: '28px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, #FFF3E8 0%, #F7FAFF 55%, #E8F5EF 100%)',
    border: '1px solid rgba(17, 24, 39, 0.08)',
    boxShadow: '0 18px 40px rgba(17, 24, 39, 0.08)',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: '0 0 8px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#C25B2A',
  },
  title: {
    margin: '0 0 10px',
    fontSize: '34px',
    lineHeight: 1.1,
    color: '#18212F',
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#4B5563',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  sortGroup: {
    display: 'inline-flex',
    padding: '4px',
    gap: '6px',
    backgroundColor: '#F4F6F8',
    borderRadius: '999px',
  },
  toggleButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#51606F',
    padding: '10px 16px',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  toggleButtonActive: {
    backgroundColor: '#18212F',
    color: '#FFFFFF',
  },
  select: {
    border: '1px solid #D0D7DE',
    borderRadius: '12px',
    padding: '10px 14px',
    minWidth: '150px',
    backgroundColor: '#FFFFFF',
    color: '#18212F',
    fontSize: '14px',
  },
  errorBanner: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '14px',
    backgroundColor: '#FDECEC',
    color: '#C5221F',
    border: '1px solid #F5C2C0',
  },
  composerCard: {
    marginBottom: '18px',
    padding: '22px',
    borderRadius: '20px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(17, 24, 39, 0.08)',
    boxShadow: '0 12px 28px rgba(17, 24, 39, 0.06)',
  },
  composerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '1px solid #D0D7DE',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#18212F',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '1px solid #D0D7DE',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#18212F',
    resize: 'vertical',
    minHeight: '140px',
    fontFamily: 'inherit',
  },
  formError: {
    color: '#C5221F',
    fontSize: '13px',
    fontWeight: '500',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '999px',
    backgroundColor: '#18212F',
    color: '#FFFFFF',
    padding: '11px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #D0D7DE',
    borderRadius: '999px',
    backgroundColor: '#FFFFFF',
    color: '#18212F',
    padding: '11px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  ghostButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#5F6368',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  infoCard: {
    padding: '20px',
    borderRadius: '18px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(17, 24, 39, 0.08)',
    color: '#4B5563',
  },
  emptyState: {
    padding: '40px 24px',
    borderRadius: '22px',
    backgroundColor: '#FFFFFF',
    border: '1px dashed #CBD5E1',
    textAlign: 'center',
    color: '#51606F',
  },
  emptyTitle: {
    margin: '0 0 8px',
    fontSize: '24px',
    color: '#18212F',
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.7,
  },
  list: {
    display: 'grid',
    gap: '16px',
  },
  card: {
    padding: '22px',
    borderRadius: '22px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(17, 24, 39, 0.08)',
    boxShadow: '0 14px 32px rgba(17, 24, 39, 0.06)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '700',
  },
  metaText: {
    fontSize: '13px',
    color: '#6B7280',
  },
  cardTitle: {
    margin: '0 0 10px',
    fontSize: '20px',
    color: '#18212F',
  },
  cardContent: {
    margin: '0 0 18px',
    fontSize: '14px',
    lineHeight: 1.75,
    color: '#475467',
    whiteSpace: 'pre-wrap',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  likeButton: {
    border: '1px solid #D0D7DE',
    borderRadius: '999px',
    backgroundColor: '#FFFFFF',
    color: '#18212F',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  likeButtonActive: {
    backgroundColor: '#FFE7D6',
    borderColor: '#F7B588',
    color: '#B54708',
  },
  likesText: {
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: '600',
  },
  adminStatusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  adminStatusLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  adminSelect: {
    border: '1px solid #D0D7DE',
    borderRadius: '999px',
    padding: '9px 12px',
    fontSize: '13px',
    color: '#18212F',
    backgroundColor: '#FFFFFF',
  },
};

export default FeatureRequestsPage;
