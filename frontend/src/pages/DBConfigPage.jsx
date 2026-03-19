import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { dbConfigAPI, linuxAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConnectionPanel from '../components/db-config/ConnectionPanel';
import TemplateModal from '../components/db-config/TemplateModal';
import ExecuteResultPanel from '../components/db-config/ExecuteResultPanel';
import {
  DEFAULT_DB_NAME,
  DEFAULT_DB_PORT,
  DEFAULT_DB_TYPE,
  DEFAULT_DB_USER,
} from './connectionDefaults';
import {
  createPendingDBConnectionForm,
  mergeLoadedDBConnectionForm,
} from './dbConnectionFormState.js';
import { buildDBConnectionPayload } from './dbConnectionRequestState.js';

const TEMPLATE_FETCH_PAGE_SIZE = 100;

const DBConfigPage = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const device = location.state?.device;

  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const deviceIP = (device?.ip || '').trim();

  const [connectionForm, setConnectionForm] = useState(() => createPendingDBConnectionForm(device?.ip || ''));
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [total, setTotal] = useState(0);

  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [expandedTemplateIds, setExpandedTemplateIds] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [restartingPOS, setRestartingPOS] = useState(false);

  const isLinuxDevice = (device?.type || '').toLowerCase().includes('linux');

  useEffect(() => {
    if (!device) return;
    const isOwner = device.owner?.id === user?.id;
    const isOccupier = device.occupancy?.userId === user?.id;
    const hasPermission = isAdmin() || isOwner || isOccupier;
    if (!hasPermission) {
      toast.warning('您没有权限访问此设备的数据库配置页面，只有管理员、负责人或借用人才能访问');
      navigate(-1);
    }
  }, [device, user, isAdmin, navigate, toast]);

  const loadTemplates = async (search = keyword) => {
    setLoadingTemplates(true);
    try {
      const firstPageResult = await dbConfigAPI.getTemplates(1, TEMPLATE_FETCH_PAGE_SIZE, search);
      const firstPageData = firstPageResult.data || {};
      const totalPages = Number(firstPageData.totalPages || 1);
      const totalItems = Number(firstPageData.total || 0);
      let mergedItems = firstPageData.items || [];

      if (totalPages > 1) {
        const requestList = [];
        for (let page = 2; page <= totalPages; page += 1) {
          requestList.push(dbConfigAPI.getTemplates(page, TEMPLATE_FETCH_PAGE_SIZE, search));
        }
        const restPageResults = await Promise.all(requestList);
        restPageResults.forEach((result) => {
          const items = result.data?.items || [];
          mergedItems = mergedItems.concat(items);
        });
      }

      setTemplates(mergedItems);
      setTotal(totalItems || mergedItems.length);
      setSelectedTemplateIds((prev) => prev.filter((id) => mergedItems.some((item) => item.id === id)));
      setExpandedTemplateIds((prev) => prev.filter((id) => mergedItems.some((item) => item.id === id)));
    } catch (error) {
      toast.error(error.response?.data?.error || '加载模板列表失败');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (!merchantId) return;
    setConnectionForm(createPendingDBConnectionForm(deviceIP));
    setHasSavedPassword(false);
  }, [merchantId, deviceIP]);

  useEffect(() => {
    if (!merchantId) return;

    const loadConnection = async () => {
      try {
        const result = await dbConfigAPI.getConnection(merchantId);
        const connection = result.data?.connection;
        if (!connection) {
          setHasSavedPassword(false);
          setConnectionForm((prev) => mergeLoadedDBConnectionForm(prev, null, deviceIP));
          return;
        }

        setHasSavedPassword(Boolean(connection.password_set));
        setConnectionForm((prev) => mergeLoadedDBConnectionForm(prev, connection, deviceIP));
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Failed to load DB connection:', error);
        }
      }
    };

    loadConnection();
  }, [merchantId, deviceIP]);

  useEffect(() => {
    if (!merchantId) return;
    loadTemplates(keyword);
  }, [merchantId, keyword]);

  const allChecked = useMemo(() => {
    if (templates.length === 0) return false;
    return templates.every((item) => selectedTemplateIds.includes(item.id));
  }, [templates, selectedTemplateIds]);

  const setFormField = (field, value) => {
    if (field === 'host') {
      return;
    }
    setConnectionForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildConnectionPayloadForRequest = () => buildDBConnectionPayload({
    form: connectionForm,
    deviceIP,
    hasSavedPassword,
  });

  const validateConnection = (form) => {
    if (!form.host.trim()) {
      toast.warning('未获取当前设备IP，请从设备列表重新进入数据库配置页面');
      return false;
    }
    if (!form.database_name.trim()) {
      toast.warning('请输入数据库名');
      return false;
    }
    if (!form.username.trim()) {
      toast.warning('请输入用户名');
      return false;
    }
    if (!form.password.trim() && !hasSavedPassword) {
      toast.warning('请输入数据库密码');
      return false;
    }
    return true;
  };

  const ensureConnectionSynced = async () => {
    const payload = buildConnectionPayloadForRequest();
    if (!validateConnection(payload)) {
      return null;
    }
    await dbConfigAPI.saveConnection(merchantId, payload);
    setConnectionForm(payload);
    setHasSavedPassword(true);
    return payload;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const payload = await ensureConnectionSynced();
      if (!payload) {
        return;
      }
      await dbConfigAPI.testConnection(merchantId, payload);
      toast.success('连接测试成功');
    } catch (error) {
      toast.error(error.response?.data?.error || '连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRestartPOS = async () => {
    if (!merchantId) {
      toast.warning('未获取到商家ID，无法重启POS');
      return;
    }

    const ok = await toast.confirm('确定要重启 POS 服务吗？', {
      title: '重启 POS',
      variant: 'primary',
      confirmText: '重启',
    });
    if (!ok) return;

    setRestartingPOS(true);
    try {
      const result = await linuxAPI.restartPOS(merchantId);
      toast.success(result?.message || 'POS 重启成功');
    } catch (error) {
      toast.error('重启 POS 失败：' + (error.response?.data?.message || error.message));
    } finally {
      setRestartingPOS(false);
    }
  };

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
  };

  const clearSearch = () => {
    setKeywordInput('');
    setKeyword('');
  };

  const toggleSelect = (id, checked) => {
    if (checked) {
      setSelectedTemplateIds((prev) => [...prev, id]);
    } else {
      setSelectedTemplateIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedTemplateIds(templates.map((item) => item.id));
      return;
    }
    setSelectedTemplateIds([]);
  };

  const toggleExpandTemplate = (templateId) => {
    setExpandedTemplateIds((prev) => (
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    ));
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleSaveTemplate = async (payload) => {
    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        await dbConfigAPI.updateTemplate(editingTemplate.id, payload);
        toast.success('模板更新成功');
      } else {
        await dbConfigAPI.createTemplate(payload);
        toast.success('模板创建成功');
      }
      closeModal();
      loadTemplates(keyword);
    } catch (error) {
      toast.error(error.response?.data?.error || '保存模板失败');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    const ok = await toast.confirm(`确定要删除模板“${template.name}”吗？此操作不可恢复。`, {
      title: '删除模板',
      confirmText: '删除',
    });
    if (!ok) return;

    try {
      await dbConfigAPI.deleteTemplate(template.id);
      toast.success('模板删除成功');
      loadTemplates(keyword);
    } catch (error) {
      toast.error(error.response?.data?.error || '删除模板失败');
    }
  };

  const handleExecuteTemplates = async (templateIds = selectedTemplateIds) => {
    if (!templateIds || templateIds.length === 0) {
      toast.warning('请先选择要执行的模板');
      return;
    }
    const payload = buildConnectionPayloadForRequest();
    if (!validateConnection(payload)) {
      return;
    }
    const ok = await toast.confirm(`确定要在当前设备上执行 ${templateIds.length} 个模板吗？执行策略为“逐条执行、失败继续”。`, {
      title: '确认执行 SQL',
      variant: 'primary',
      confirmText: '开始执行',
    });
    if (!ok) return;

    setExecuting(true);
    try {
      await dbConfigAPI.saveConnection(merchantId, payload);
      setConnectionForm(payload);

      const result = await dbConfigAPI.executeTemplates({
        merchant_id: merchantId,
        template_ids: templateIds,
      });
      setExecuteResult({
        task: result.data?.task,
        items: result.data?.items || [],
      });
      const task = result.data?.task;
      if (task?.failed_count > 0) {
        toast.warning(`执行完成：成功 ${task.success_count}，失败 ${task.failed_count}`);
      } else {
        toast.success('执行完成');
      }
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.data?.risk_detected && isAdmin()) {
        const force = await toast.confirm('检测到高风险 SQL。是否以管理员身份强制执行？', {
          title: '高风险 SQL 提示',
          confirmText: '强制执行',
        });
        if (force) {
          try {
            const forceResult = await dbConfigAPI.executeTemplates({
              merchant_id: merchantId,
              template_ids: templateIds,
              force_execute: true,
              force_reason: '管理员确认强制执行',
            });
            setExecuteResult({
              task: forceResult.data?.task,
              items: forceResult.data?.items || [],
            });
            const task = forceResult.data?.task;
            if (task?.failed_count > 0) {
              toast.warning(`强制执行完成：成功 ${task.success_count}，失败 ${task.failed_count}`);
            } else {
              toast.success('强制执行完成');
            }
            return;
          } catch (forceError) {
            toast.error(forceError.response?.data?.error || '强制执行失败');
            return;
          }
        }
      }
      toast.error(errorData?.error || '执行失败');
      if (errorData?.data?.task) {
        setExecuteResult({
          task: errorData.data.task,
          items: [],
        });
      }
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/')} style={styles.backBtn}>← 返回</button>
          <div>
            <h2 style={styles.title}>数据库配置管理</h2>
            <div style={styles.subtitle}>商家ID: {merchantId}</div>
          </div>
        </div>
      </div>

      <ConnectionPanel
        form={connectionForm}
        hasSavedPassword={hasSavedPassword}
        onFormChange={setFormField}
        onTest={handleTestConnection}
        testing={testingConnection}
        deviceIP={deviceIP}
        showRestartPOS={isLinuxDevice}
        onRestartPOS={handleRestartPOS}
        restartingPOS={restartingPOS}
      />

      <div style={styles.card}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>
            SQL 模板库
            <span style={styles.tableCount}>（共 {total} 条）</span>
          </h3>
          <div style={styles.actions}>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索名称或备注"
              style={styles.searchInput}
            />
            <button onClick={handleSearch} style={styles.searchBtn}>搜索</button>
            {(keyword || keywordInput) && (
              <button onClick={clearSearch} style={styles.clearBtn}>清除</button>
            )}
            <button onClick={openCreateModal} style={styles.createBtn}>新增模板</button>
            <button
              onClick={() => handleExecuteTemplates(selectedTemplateIds)}
              disabled={executing || selectedTemplateIds.length === 0}
              style={{ ...styles.executeBtn, ...(executing || selectedTemplateIds.length === 0 ? styles.disabled : {}) }}
            >
              {executing ? '执行中...' : `执行选中(${selectedTemplateIds.length})`}
            </button>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col style={styles.colSelect} />
              <col style={styles.colName} />
              <col style={styles.colNeedRestart} />
              <col style={styles.colRemark} />
              <col style={styles.colCreator} />
              <col style={styles.colUpdatedAt} />
              <col style={styles.colDetail} />
              <col style={styles.colActions} />
            </colgroup>
            <thead>
              <tr>
                <th style={styles.thCenter}>
                  <input type="checkbox" checked={allChecked} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                <th style={styles.th}>名称</th>
                <th style={styles.thCenter}>重启生效</th>
                <th style={styles.th}>备注</th>
                <th style={styles.th}>创建人</th>
                <th style={styles.th}>更新时间</th>
                <th style={styles.thCenter}>SQL详情</th>
                <th style={styles.thCenter}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loadingTemplates ? (
                <tr>
                  <td colSpan={8} style={styles.emptyCell}>加载中...</td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.emptyCell}>暂无模板</td>
                </tr>
              ) : (
                templates.map((template) => {
                  const canEdit = isAdmin() || template.created_by === user?.id;
                  const isExpanded = expandedTemplateIds.includes(template.id);
                  return (
                    <React.Fragment key={template.id}>
                      <tr style={styles.tr}>
                        <td style={styles.tdCenter}>
                          <input
                            type="checkbox"
                            checked={selectedTemplateIds.includes(template.id)}
                            onChange={(e) => toggleSelect(template.id, e.target.checked)}
                          />
                        </td>
                        <td style={styles.td}>
                          <span style={styles.nameText} title={template.name}>{template.name}</span>
                        </td>
                        <td style={styles.tdCenter}>
                          {template.need_restart ? (
                            <span style={styles.needRestartTag}>需要</span>
                          ) : (
                            <span style={styles.noRestartTag}>不需要</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.remarkText} title={template.remark || '—'}>
                            {template.remark || '—'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.creatorText} title={String(template.created_by_name || template.created_by)}>
                            {template.created_by_name || template.created_by}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.updatedAtText}>
                            {template.updated_at ? new Date(template.updated_at).toLocaleString('zh-CN') : '—'}
                          </span>
                        </td>
                        <td style={styles.tdCenter}>
                          <button
                            onClick={() => toggleExpandTemplate(template.id)}
                            style={styles.rowDetailBtn}
                          >
                            {isExpanded ? '收起' : '展开'}
                          </button>
                        </td>
                        <td style={styles.tdCenter}>
                          <div style={styles.rowActions}>
                            {canEdit && (
                              <button onClick={() => openEditModal(template)} style={styles.rowEditBtn}>编辑</button>
                            )}
                            {canEdit && (
                              <button onClick={() => handleDeleteTemplate(template)} style={styles.rowDeleteBtn}>删除</button>
                            )}
                            <button
                              onClick={() => handleExecuteTemplates([template.id])}
                              disabled={executing}
                              style={{ ...styles.rowExecuteBtn, ...(executing ? styles.disabled : {}) }}
                            >
                              执行
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={styles.detailTr}>
                          <td colSpan={8} style={styles.detailCell}>
                            <div style={styles.sqlDetailTitle}>SQL 详情</div>
                            <pre style={styles.sqlDetailContent}>{template.sql_content || '—'}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExecuteResultPanel result={executeResult} onClose={() => setExecuteResult(null)} />

      <TemplateModal
        isOpen={showModal}
        template={editingTemplate}
        onClose={closeModal}
        onSubmit={handleSaveTemplate}
        saving={savingTemplate}
      />
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '12px 16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    border: 'none',
    backgroundColor: '#F2F2F7',
    borderRadius: '8px',
    color: '#1D1D1F',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  title: {
    margin: 0,
    fontSize: '16px',
    color: '#1D1D1F',
  },
  subtitle: {
    marginTop: '2px',
    color: '#86868B',
    fontSize: '12px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  tableTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  tableCount: {
    marginLeft: '6px',
    fontSize: '12px',
    color: '#86868B',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  searchInput: {
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    width: '220px',
    outline: 'none',
  },
  searchBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: '#5AC8FA',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  clearBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    fontSize: '13px',
    cursor: 'pointer',
  },
  createBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: '#5856D6',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  executeBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: '#34C759',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  disabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  tableWrap: {
    height: '520px',
    overflow: 'auto',
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1240px',
    tableLayout: 'fixed',
  },
  colSelect: { width: '44px' },
  colName: { width: '220px' },
  colNeedRestart: { width: '110px' },
  colRemark: { width: '300px' },
  colCreator: { width: '130px' },
  colUpdatedAt: { width: '170px' },
  colDetail: { width: '90px' },
  colActions: { width: '210px' },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'left',
    padding: '10px',
    backgroundColor: '#F7F7F7',
    color: '#86868B',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: '1px solid #E5E5EA',
  },
  thCenter: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#F7F7F7',
    color: '#86868B',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: '1px solid #E5E5EA',
  },
  tr: {
    borderBottom: '1px solid #F2F2F7',
  },
  td: {
    padding: '10px',
    fontSize: '13px',
    color: '#1D1D1F',
    verticalAlign: 'middle',
  },
  tdCenter: {
    padding: '10px',
    fontSize: '13px',
    color: '#1D1D1F',
    verticalAlign: 'middle',
    textAlign: 'center',
  },
  nameText: {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 500,
  },
  remarkText: {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#4A4A4F',
  },
  creatorText: {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  updatedAtText: {
    whiteSpace: 'nowrap',
  },
  needRestartTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255, 149, 0, 0.16)',
    color: '#FF9500',
    fontSize: '12px',
    fontWeight: 600,
  },
  noRestartTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    color: '#2EAD56',
    fontSize: '12px',
    fontWeight: 600,
  },
  rowDetailBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    fontSize: '12px',
    cursor: 'pointer',
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flexWrap: 'nowrap',
  },
  rowEditBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    backgroundColor: '#007AFF',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rowDeleteBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rowExecuteBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    backgroundColor: '#34C759',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  detailTr: {
    backgroundColor: '#FAFAFC',
  },
  detailCell: {
    padding: '0',
    borderBottom: '1px solid #F2F2F7',
  },
  sqlDetailTitle: {
    padding: '10px 12px 0 12px',
    color: '#86868B',
    fontSize: '12px',
    fontWeight: 600,
  },
  sqlDetailContent: {
    margin: 0,
    padding: '10px 12px 12px 12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    color: '#1D1D1F',
    maxHeight: '280px',
    overflowY: 'auto',
  },
  emptyCell: {
    textAlign: 'center',
    color: '#86868B',
    fontSize: '13px',
    padding: '18px 12px',
  },
};

export default DBConfigPage;
