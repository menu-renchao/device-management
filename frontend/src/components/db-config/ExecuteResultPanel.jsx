import React from 'react';
import { useToast } from '../../contexts/ToastContext';

const ExecuteResultPanel = ({ result, onClose }) => {
  const toast = useToast();
  if (!result?.task) {
    return null;
  }

  const { task, items = [] } = result;
  const statusColor = getStatusColor(task.status);

  const handleCopy = async () => {
    const lines = [
      `任务ID: ${task.task_id}`,
      `状态: ${task.status}`,
      `设备: ${task.merchant_id}`,
      `成功: ${task.success_count}, 失败: ${task.failed_count}`,
      '',
      '执行明细:',
      ...items.map((item) => `#${item.sql_index} [${item.status}] ${item.sql_text_snapshot}${item.error_message ? ` | ${item.error_message}` : ''}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('执行结果已复制');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>执行结果</h3>
          <span style={{ ...styles.statusTag, color: statusColor, borderColor: statusColor }}>
            {task.status}
          </span>
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleCopy} style={styles.copyBtn}>复制结果</button>
          <button onClick={onClose} style={styles.closeBtn}>关闭</button>
        </div>
      </div>

      <div style={styles.summary}>
        <span>任务ID: {task.task_id}</span>
        <span>总数: {task.total_count}</span>
        <span style={{ color: '#34C759' }}>成功: {task.success_count}</span>
        <span style={{ color: '#FF3B30' }}>失败: {task.failed_count}</span>
      </div>

      <div style={styles.list}>
        {items.length === 0 ? (
          <div style={styles.empty}>无执行明细</div>
        ) : (
          items.map((item) => (
            <div key={`${item.sql_index}-${item.template_id}`} style={styles.item}>
              <div style={styles.itemHeader}>
                <span style={styles.itemIndex}>#{item.sql_index}</span>
                <span style={styles.itemTemplate}>{item.template_name_snapshot}</span>
                <span style={{ ...styles.itemStatus, color: item.status === 'success' ? '#34C759' : '#FF3B30' }}>
                  {item.status}
                </span>
              </div>
              <div style={styles.sql}>{item.sql_text_snapshot}</div>
              {item.error_message && <div style={styles.error}>{item.error_message}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  if (status === 'success') return '#34C759';
  if (status === 'partial_failed') return '#FF9500';
  return '#FF3B30';
};

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
  },
  statusTag: {
    fontSize: '12px',
    border: '1px solid',
    borderRadius: '999px',
    padding: '2px 8px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  copyBtn: {
    border: '1px solid #D1D1D6',
    backgroundColor: '#F2F2F7',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  closeBtn: {
    border: 'none',
    backgroundColor: '#007AFF',
    color: '#fff',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    color: '#86868B',
    fontSize: '12px',
    marginBottom: '10px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '320px',
    overflowY: 'auto',
  },
  empty: {
    color: '#86868B',
    fontSize: '12px',
  },
  item: {
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: '#FAFAFA',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  itemIndex: {
    fontSize: '12px',
    color: '#86868B',
    minWidth: '36px',
  },
  itemTemplate: {
    fontSize: '12px',
    color: '#1D1D1F',
    fontWeight: 500,
    flex: 1,
  },
  itemStatus: {
    fontSize: '12px',
    fontWeight: 600,
  },
  sql: {
    fontSize: '12px',
    color: '#1D1D1F',
    backgroundColor: '#fff',
    border: '1px solid #E5E5EA',
    borderRadius: '6px',
    padding: '6px 8px',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  error: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#FF3B30',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

export default ExecuteResultPanel;
