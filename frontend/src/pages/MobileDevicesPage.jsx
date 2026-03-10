import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ConfirmDialog from '../components/ConfirmDialog';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import PageShell from '../components/ui/PageShell';
import SectionGroup from '../components/ui/SectionGroup';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatusBadge from '../components/ui/StatusBadge';
import Toolbar from '../components/ui/Toolbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { deviceAPI } from '../services/api';

const API_BASE = '/api/mobile';

const createAuthAxios = () => {
  const token = localStorage.getItem('access_token');
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

const MobileDevicesPage = () => {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mobileViewMode') || 'card');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, id: null });
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    deviceType: '',
    sn: '',
    systemVersion: '',
  });
  const [occupancyData, setOccupancyData] = useState({ purpose: '', endTime: '' });
  const [users, setUsers] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [ownerDeviceId, setOwnerDeviceId] = useState(null);
  const [imageA, setImageA] = useState(null);
  const [imageB, setImageB] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchDevices();
    if (isAdmin()) {
      fetchUsers();
    }
  }, []);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredDevices(devices);
      return;
    }

    const keyword = searchText.toLowerCase();
    const nextDevices = devices.filter((device) =>
      [device.name, device.deviceType, device.sn, device.systemVersion].some((value) =>
        (value || '').toLowerCase().includes(keyword),
      ),
    );
    setFilteredDevices(nextDevices);
  }, [searchText, devices]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('mobileViewMode', mode);
  };

  const openImagePreview = (imageUrl) => {
    setPreviewImage(imageUrl);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success && response.data.data) {
        setUsers(response.data.data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const authAxios = createAuthAxios();
      const response = await authAxios.get('/devices');
      if (response.data.success && response.data.data) {
        const deviceList = response.data.data.devices || [];
        setDevices(deviceList);
        setFilteredDevices(deviceList);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedDevice(null);
    setFormData({ name: '', deviceType: '', sn: '', systemVersion: '' });
    setImageA(null);
    setImageB(null);
    setShowModal(true);
  };

  const openEditModal = (device) => {
    setModalMode('edit');
    setSelectedDevice(device);
    setFormData({
      name: device.name,
      deviceType: device.deviceType || '',
      sn: device.sn || '',
      systemVersion: device.systemVersion || '',
    });
    setImageA(null);
    setImageB(null);
    setShowModal(true);
  };

  const openOccupyModal = (device) => {
    setModalMode('occupy');
    setSelectedDevice(device);
    const defaultEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
    setOccupancyData({
      purpose: device.purpose || '',
      endTime: defaultEnd.toISOString().slice(0, 16),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDevice(null);
  };

  const handleSaveDevice = async () => {
    if (!formData.name) {
      toast.warning('请输入设备名称');
      return;
    }

    try {
      const authAxios = createAuthAxios();
      let deviceId = selectedDevice?.id;

      if (modalMode === 'create') {
        const response = await authAxios.post('/devices', formData);
        deviceId = response.data.device?.id;
        toast.success('设备创建成功');
      } else {
        await authAxios.put(`/devices/${selectedDevice.id}`, formData);
        toast.success('设备更新成功');
      }

      if (imageA && deviceId) {
        await uploadImage(deviceId, imageA, 'a');
      }
      if (imageB && deviceId) {
        await uploadImage(deviceId, imageB, 'b');
      }

      fetchDevices();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const uploadImage = async (deviceId, file, type) => {
    const body = new FormData();
    body.append('image', file);
    body.append('type', type);

    const token = localStorage.getItem('access_token');
    await axios.post(`${API_BASE}/devices/${deviceId}/upload`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
  };

  const handleDelete = (deviceId) => {
    setConfirmDialog({ show: true, type: 'delete', id: deviceId });
  };

  const handleRelease = (deviceId) => {
    setConfirmDialog({ show: true, type: 'release', id: deviceId });
  };

  const confirmAction = async () => {
    const { type, id } = confirmDialog;
    setConfirmDialog({ show: false, type: null, id: null });

    try {
      const authAxios = createAuthAxios();
      if (type === 'delete') {
        await authAxios.delete(`/devices/${id}`);
        toast.success('设备已删除');
      }
      if (type === 'release') {
        await authAxios.put(`/devices/${id}/release`);
        toast.success('设备已归还');
      }
      fetchDevices();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleSetOccupancy = async () => {
    if (!occupancyData.endTime) {
      toast.warning('请选择归还时间');
      return;
    }

    try {
      if (isAdmin()) {
        const authAxios = createAuthAxios();
        await authAxios.put(`/devices/${selectedDevice.id}/occupy`, {
          purpose: occupancyData.purpose,
          endTime: new Date(occupancyData.endTime).toISOString(),
        });
        toast.success('借用成功');
      } else {
        await deviceAPI.submitBorrowRequest(
          selectedDevice.id,
          occupancyData.purpose,
          new Date(occupancyData.endTime).toISOString(),
        );
        toast.success('借用申请已提交，请等待审核');
      }
      fetchDevices();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const openOwnerModal = (device) => {
    setOwnerDeviceId(device.id);
    setSelectedOwnerId(device.ownerId || null);
    setShowOwnerModal(true);
  };

  const handleSetOwner = async () => {
    try {
      const authAxios = createAuthAxios();
      await authAxios.put(`/devices/${ownerDeviceId}/owner`, {
        ownerId: selectedOwnerId || null,
      });
      toast.success('负责人设置成功');
      fetchDevices();
      setShowOwnerModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || '设置失败');
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canReturnDevice = (device) => isAdmin() || device.occupierId === user?.id || device.ownerId === user?.id;

  return (
    <PageShell
      eyebrow="Devices"
      title="移动设备管理"
      subtitle="管理测试用移动设备，保持卡片与列表双视图的高密度使用体验。"
      actions={isAdmin() ? <Button variant="primary" onClick={openCreateModal}>+ 添加设备</Button> : null}
    >
      <SectionGroup title="设备列表" description="使用统一工具栏查找、切换视图并执行借用或管理操作。">
        <Toolbar
          left={
            <Field label="搜索" htmlFor="mobile-device-search">
              <input
                id="mobile-device-search"
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索名称 / SN / 类型 / 系统版本"
              />
            </Field>
          }
          right={
            <>
              <SegmentedControl
                options={[
                  { value: 'card', label: '卡片' },
                  { value: 'list', label: '列表' },
                ]}
                value={viewMode}
                onChange={handleViewModeChange}
              />
              <StatusBadge tone="neutral" dot={false}>{`${filteredDevices.length} 台设备`}</StatusBadge>
            </>
          }
        />

        {loading ? (
          <div style={styles.state}>Loading...</div>
        ) : filteredDevices.length === 0 ? (
          <div style={styles.state}>{searchText ? '未找到匹配设备' : '暂无设备'}</div>
        ) : viewMode === 'card' ? (
          <div style={styles.grid}>
            {filteredDevices.map((device) => (
              <div key={device.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>{device.name}</div>
                    <div style={styles.cardMeta}>{device.deviceType || '未分类'}</div>
                  </div>
                  <StatusBadge tone={device.isOccupied ? 'warning' : 'success'}>
                    {device.isOccupied ? '已借出' : '可借用'}
                  </StatusBadge>
                </div>

                <div style={styles.imageRow}>
                  <ImagePreviewBox image={device.imageA} alt="A side" onOpen={openImagePreview} placeholder="A" />
                  <ImagePreviewBox image={device.imageB} alt="B side" onOpen={openImagePreview} placeholder="B" />
                </div>

                <div style={styles.detailGrid}>
                  <Detail label="SN" value={device.sn || '--'} mono={true} />
                  <Detail label="系统版本" value={device.systemVersion || '--'} />
                  <Detail label="负责人" value={device.owner || '未指定'} />
                  <Detail label="借用人" value={device.isOccupied ? device.occupier || '--' : '--'} />
                  <Detail label="归还时间" value={device.isOccupied ? formatTime(device.endTime) : '--'} />
                </div>

                <div style={styles.cardActions}>
                  {device.isOccupied ? (
                    canReturnDevice(device) ? (
                      <Button variant="danger" onClick={() => handleRelease(device.id)}>归还</Button>
                    ) : (
                      <span style={styles.readOnlyHint}>{`已被 ${device.occupier || '--'} 借用`}</span>
                    )
                  ) : (
                    <Button variant="primary" onClick={() => openOccupyModal(device)}>借用</Button>
                  )}
                  {isAdmin() ? (
                    <>
                      <Button variant="secondary" onClick={() => openOwnerModal(device)}>负责人</Button>
                      <Button variant="secondary" onClick={() => openEditModal(device)}>编辑</Button>
                      <Button variant="tertiary" onClick={() => handleDelete(device.id)}>删除</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>图片</th>
                  <th style={styles.th}>设备名称</th>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>SN</th>
                  <th style={styles.th}>系统版本</th>
                  <th style={styles.th}>负责人</th>
                  <th style={styles.th}>借用状态</th>
                  <th style={styles.th}>归还时间</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => (
                  <tr key={device.id} style={styles.row}>
                    <td style={styles.td}>
                      <div style={styles.tableImageRow}>
                        <ImagePreviewMini image={device.imageA} alt="A side" onOpen={openImagePreview} placeholder="A" />
                        <ImagePreviewMini image={device.imageB} alt="B side" onOpen={openImagePreview} placeholder="B" />
                      </div>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{device.name}</td>
                    <td style={styles.td}>{device.deviceType || '--'}</td>
                    <td style={{ ...styles.td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>{device.sn || '--'}</td>
                    <td style={styles.td}>{device.systemVersion || '--'}</td>
                    <td style={styles.td}>{device.owner || '--'}</td>
                    <td style={styles.td}>
                      <StatusBadge tone={device.isOccupied ? 'warning' : 'success'}>
                        {device.isOccupied ? device.occupier || '已借出' : '可借用'}
                      </StatusBadge>
                    </td>
                    <td style={styles.td}>{device.isOccupied ? formatTime(device.endTime) : '--'}</td>
                    <td style={styles.td}>
                      <div style={styles.tableActions}>
                        {device.isOccupied ? (
                          canReturnDevice(device) ? (
                            <Button variant="danger" onClick={() => handleRelease(device.id)}>归还</Button>
                          ) : null
                        ) : (
                          <Button variant="primary" onClick={() => openOccupyModal(device)}>借用</Button>
                        )}
                        {isAdmin() ? (
                          <>
                            <Button variant="secondary" onClick={() => openOwnerModal(device)}>负责人</Button>
                            <Button variant="secondary" onClick={() => openEditModal(device)}>编辑</Button>
                            <Button variant="tertiary" onClick={() => handleDelete(device.id)}>删除</Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionGroup>

      {showModal ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalMode === 'create' ? '添加设备' : modalMode === 'edit' ? '编辑设备' : '借用设备'}
              </h3>
              <Button variant="icon" onClick={closeModal}>x</Button>
            </div>
            <div style={styles.modalBody}>
              {modalMode === 'create' || modalMode === 'edit' ? (
                <>
                  <Field label="设备名称 *" htmlFor="mobile-name">
                    <input id="mobile-name" type="text" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
                  </Field>
                  <Field label="设备类型" htmlFor="mobile-type">
                    <input id="mobile-type" type="text" value={formData.deviceType} onChange={(event) => setFormData({ ...formData, deviceType: event.target.value })} />
                  </Field>
                  <Field label="SN" htmlFor="mobile-sn">
                    <input id="mobile-sn" type="text" value={formData.sn} onChange={(event) => setFormData({ ...formData, sn: event.target.value })} />
                  </Field>
                  <Field label="系统版本" htmlFor="mobile-version">
                    <input id="mobile-version" type="text" value={formData.systemVersion} onChange={(event) => setFormData({ ...formData, systemVersion: event.target.value })} />
                  </Field>
                  <Field label="A 面图片" htmlFor="mobile-image-a">
                    <input id="mobile-image-a" type="file" accept="image/*" onChange={(event) => setImageA(event.target.files[0])} />
                  </Field>
                  <Field label="B 面图片" htmlFor="mobile-image-b">
                    <input id="mobile-image-b" type="file" accept="image/*" onChange={(event) => setImageB(event.target.files[0])} />
                  </Field>
                </>
              ) : (
                <>
                  <div style={styles.infoRow}>{`设备: ${selectedDevice?.name || '--'}`}</div>
                  <div style={styles.infoRow}>{`借用人: ${user?.name || user?.username || '--'}`}</div>
                  <Field label="用途" htmlFor="mobile-purpose">
                    <input id="mobile-purpose" type="text" value={occupancyData.purpose} onChange={(event) => setOccupancyData({ ...occupancyData, purpose: event.target.value })} />
                  </Field>
                  <Field label="归还时间" htmlFor="mobile-end-time">
                    <input id="mobile-end-time" type="datetime-local" value={occupancyData.endTime} onChange={(event) => setOccupancyData({ ...occupancyData, endTime: event.target.value })} />
                  </Field>
                </>
              )}
            </div>
            <div style={styles.modalActions}>
              <Button variant="secondary" onClick={closeModal}>取消</Button>
              <Button variant="primary" onClick={modalMode === 'occupy' ? handleSetOccupancy : handleSaveDevice}>
                {modalMode === 'create' ? '创建' : modalMode === 'edit' ? '保存' : '借用'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div style={styles.previewOverlay} onClick={closeImagePreview}>
          <Button variant="icon" style={styles.previewClose} onClick={closeImagePreview}>x</Button>
          <img src={previewImage} alt="Preview" style={styles.previewImage} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      {showOwnerModal ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>设置负责人</h3>
              <Button variant="icon" onClick={() => setShowOwnerModal(false)}>x</Button>
            </div>
            <div style={styles.modalBody}>
              <Field label="选择负责人" htmlFor="mobile-owner-select">
                <select
                  id="mobile-owner-select"
                  value={selectedOwnerId || ''}
                  onChange={(event) => setSelectedOwnerId(event.target.value ? parseInt(event.target.value, 10) : null)}
                >
                  <option value="">-- 不指定负责人 --</option>
                  {users.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name || account.username}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={styles.modalActions}>
              <Button variant="secondary" onClick={() => setShowOwnerModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleSetOwner}>确定</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title={confirmDialog.type === 'delete' ? '确认删除' : '确认归还'}
        message={confirmDialog.type === 'delete' ? '确定要删除此设备吗？' : '确定要归还此设备吗？'}
        onConfirm={confirmAction}
        onCancel={() => setConfirmDialog({ show: false, type: null, id: null })}
        confirmText={confirmDialog.type === 'delete' ? '删除' : '归还'}
      />
    </PageShell>
  );
};

const ImagePreviewBox = ({ image, alt, onOpen, placeholder }) => (
  <div style={styles.imageBox}>
    {image ? (
      <img src={`/uploads/${image}`} alt={alt} style={styles.image} onClick={() => onOpen(`/uploads/${image}`)} />
    ) : (
      <span style={styles.imagePlaceholder}>{placeholder}</span>
    )}
  </div>
);

const ImagePreviewMini = ({ image, alt, onOpen, placeholder }) =>
  image ? (
    <img src={`/uploads/${image}`} alt={alt} style={styles.miniImage} onClick={() => onOpen(`/uploads/${image}`)} />
  ) : (
    <div style={styles.miniPlaceholder}>{placeholder}</div>
  );

const Detail = ({ label, value, mono = false }) => (
  <div style={styles.detailItem}>
    <div style={styles.detailLabel}>{label}</div>
    <div style={{ ...styles.detailValue, ...(mono ? styles.detailMono : {}) }}>{value}</div>
  </div>
);

const styles = {
  state: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: 'var(--shadow-sm)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  cardMeta: {
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  imageRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  imageBox: {
    height: '116px',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
  },
  imagePlaceholder: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontWeight: '600',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-tertiary)',
  },
  detailValue: {
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  detailMono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  readOnlyHint: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1040px',
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
    verticalAlign: 'top',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  tableImageRow: {
    display: 'flex',
    gap: '6px',
  },
  miniImage: {
    width: '42px',
    height: '42px',
    objectFit: 'cover',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  miniPlaceholder: {
    width: '42px',
    height: '42px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '11px',
    fontWeight: '600',
  },
  tableActions: {
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
    maxWidth: '520px',
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
  infoRow: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 10, 20, 0.88)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 1400,
  },
  previewImage: {
    maxWidth: '92%',
    maxHeight: '92%',
    objectFit: 'contain',
    borderRadius: '16px',
  },
  previewClose: {
    position: 'absolute',
    top: '20px',
    right: '20px',
  },
};

export default MobileDevicesPage;

