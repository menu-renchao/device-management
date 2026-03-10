import React, { useState, useEffect, useRef } from 'react';
import { scanAPI, deviceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { adminService } from '../services/authService';
import ScanTable from '../components/ScanTable';
import DetailModal from '../components/DetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import DBBackupRestoreModal from '../components/db-backup/DBBackupRestoreModal';

const getOnlyMyDevicesStorageKey = (userId) => `scan_page_only_my_devices_${userId || 'default'}`;

const ScanPage = () => {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const [localIPs, setLocalIPs] = useState([]);
  const [selectedIP, setSelectedIP] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentIP, setCurrentIP] = useState('');
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [lastScanAt, setLastScanAt] = useState(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalDevices, setTotalDevices] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 设备性质编辑
  const [propertyModal, setPropertyModal] = useState({ show: false, device: null });
  const [propertyValue, setPropertyValue] = useState('');

  // 设备占用编辑
  const [occupancyModal, setOccupancyModal] = useState({ show: false, device: null });
  const [occupancyPurpose, setOccupancyPurpose] = useState('');
  const [occupancyEndTime, setOccupancyEndTime] = useState('');

  // 搜索条件
  const [searchText, setSearchText] = useState('');

  // 筛选条件
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterProperties, setFilterProperties] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [availableProperties, setAvailableProperties] = useState([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [onlyMyDevices, setOnlyMyDevices] = useState(false);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, data: null });
  const licenseFileInputRef = useRef(null);
  const licenseImportDeviceRef = useRef(null);
  const [dbBackupModal, setDbBackupModal] = useState({ show: false, device: null });

  // 获取本地IP列表
  useEffect(() => {
    const fetchLocalIPs = async () => {
      try {
        const response = await scanAPI.getLocalIPs();
        if (response.data.success && response.data.data) {
          const ips = response.data.data.ips || [];
          setLocalIPs(ips);
          if (ips.length > 0) {
            setSelectedIP(ips[0]);
          }
        }
      } catch (error) {
        console.error('获取本地IP失败:', error);
      }
    };
    fetchLocalIPs();
  }, []);

  // 加载设备列表（分页+搜索+筛选）
  const loadDevices = async (
    page = currentPage,
    size = pageSize,
    search = searchText,
    types = filterTypes,
    properties = filterProperties,
    mineOnly = onlyMyDevices
  ) => {
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: size.toString()
      });
      if (search) params.append('search', search);
      if (types.length > 0) params.append('types', types.join(','));
      if (properties.length > 0) params.append('properties', properties.join(','));
      if (mineOnly) params.append('mine_only', '1');

      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/devices?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setDevices(result.data.devices || []);
        setFilteredDevices(result.data.devices || []);
        setTotalDevices(result.data.total || 0);
        setTotalPages(result.data.totalPages || 0);
        setLastScanAt(result.data.lastScanAt);
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
    }
  };

  // 初始加载（含用户筛选偏好）
  useEffect(() => {
    if (!user?.id) return;

    const storageKey = getOnlyMyDevicesStorageKey(user.id);
    const savedOnlyMyDevices = localStorage.getItem(storageKey) === '1';
    setOnlyMyDevices(savedOnlyMyDevices);
    setCurrentPage(1);
    loadDevices(1, pageSize, '', [], [], savedOnlyMyDevices);
    loadFilterOptions();
  }, [user?.id]);

  // 加载筛选选项
  const loadFilterOptions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/devices/filter-options', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setAvailableTypes(result.data.types || []);
        setAvailableProperties(result.data.properties || []);
      }
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  };

  // 页码改变
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadDevices(newPage, pageSize, searchText, filterTypes, filterProperties);
  };

  // 每页数量改变
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    loadDevices(1, newSize, searchText, filterTypes, filterProperties);
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = () => {
      setShowTypeDropdown(false);
      setShowPropertyDropdown(false);
    };
    if (showTypeDropdown || showPropertyDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTypeDropdown, showPropertyDropdown]);

  // 轮询扫描状态
  useEffect(() => {
    let intervalId;
    if (isScanning) {
      intervalId = setInterval(async () => {
        try {
          const response = await scanAPI.getScanStatus();
          const status = response.data.data || response.data;
          setScanProgress(status.progress || 0);
          setCurrentIP(status.current_ip || '');
          if (status.results) {
            setDevices(status.results);
            setFilteredDevices(status.results);
          }
          if (!status.is_scanning) {
            setIsScanning(false);
            // 扫描完成后重新获取设备列表
            loadDevices(1, pageSize, searchText, filterTypes, filterProperties, onlyMyDevices);
            setCurrentPage(1);
            if (intervalId) clearInterval(intervalId);
          }
        } catch (error) {
          console.error('获取扫描状态失败:', error);
          setIsScanning(false);
          if (intervalId) clearInterval(intervalId);
        }
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isScanning]);

  // 开始扫描
  const startScan = async () => {
    if (!selectedIP) {
      toast.warning('请选择IP地址');
      return;
    }
    try {
      setIsScanning(true);
      setDevices([]);
      setFilteredDevices([]);
      setScanProgress(0);
      const response = await scanAPI.startScan(selectedIP);
      if (!response.data.success) {
        toast.error(response.data.error);
        setIsScanning(false);
      }
    } catch (error) {
      console.error('开始扫描失败:', error);
      setIsScanning(false);
    }
  };

  // 停止扫描
  const stopScan = async () => {
    try {
      await scanAPI.stopScan();
      setIsScanning(false);
    } catch (error) {
      console.error('停止扫描失败:', error);
    }
  };

  // 搜索处理（后端搜索）
  const handleSearch = () => {
    setCurrentPage(1);
    loadDevices(1, pageSize, searchText, filterTypes, filterProperties);
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchText('');
    setFilterTypes([]);
    setFilterProperties([]);
    setCurrentPage(1);
    loadDevices(1, pageSize, '', [], []);
  };

  // 筛选变化处理
  const handleFilterChange = (type, value, checked) => {
    if (type === 'type') {
      const newTypes = checked
        ? [...filterTypes, value]
        : filterTypes.filter(t => t !== value);
      setFilterTypes(newTypes);
      setCurrentPage(1);
      loadDevices(1, pageSize, searchText, newTypes, filterProperties);
    } else if (type === 'property') {
      const newProperties = checked
        ? [...filterProperties, value]
        : filterProperties.filter(p => p !== value);
      setFilterProperties(newProperties);
      setCurrentPage(1);
      loadDevices(1, pageSize, searchText, filterTypes, newProperties);
    }
  };

  const handleOnlyMyDevicesChange = (checked) => {
    setOnlyMyDevices(checked);
    setCurrentPage(1);

    if (user?.id) {
      localStorage.setItem(getOnlyMyDevicesStorageKey(user.id), checked ? '1' : '0');
    }

    loadDevices(1, pageSize, searchText, filterTypes, filterProperties, checked);
  };

  // 打开设备
  const handleOpenDevice = (ip) => {
    window.open(`http://${ip}:22080`, '_blank');
  };

  // 格式化最后扫描时间
  const formatLastScanTime = (isoString) => {
    if (!isoString || isoString === '') return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getPurposeText = (purpose) => {
    if (purpose === null || purpose === undefined) return '';
    if (typeof purpose === 'string') return purpose.trim();
    if (typeof purpose === 'object') {
      if (typeof purpose.String === 'string') return purpose.String.trim();
      if (typeof purpose.value === 'string') return purpose.value.trim();
    }
    return String(purpose).trim();
  };

  const extractFilenameFromDisposition = (contentDisposition = '') => {
    if (!contentDisposition) return '';

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch (_) {
        return utf8Match[1];
      }
    }

    const normalMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (normalMatch && normalMatch[1]) {
      return normalMatch[1];
    }

    return '';
  };

  // 显示详情
  const handleShowDetails = (device) => {
    setSelectedDevice(device);
    setShowModal(true);
  };

  // 编辑设备性质
  const handleEditProperty = (device) => {
    setPropertyModal({ show: true, device });
    setPropertyValue(device.property || '');
  };

  // 保存设备性质
  const handleSaveProperty = async () => {
    if (!propertyModal.device) return;
    try {
      const result = await adminService.setDeviceProperty(
        propertyModal.device.merchantId,
        propertyValue
      );
      if (result.success) {
        toast.success('分类保存成功');
        // 刷新设备列表
        loadDevices(currentPage, pageSize, searchText);
        setPropertyModal({ show: false, device: null });
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('保存失败');
    }
  };

  // 编辑设备占用
  const handleEditOccupancy = (device) => {
    setOccupancyModal({ show: true, device });
    setOccupancyPurpose(getPurposeText(device.occupancy?.purpose));
    // 默认结束时间为2小时后
    if (device.occupancy?.endTime) {
      setOccupancyEndTime(device.occupancy.endTime.slice(0, 16));
    } else {
      const defaultEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
      setOccupancyEndTime(defaultEnd.toISOString().slice(0, 16));
    }
  };

  // 保存设备占用（普通用户提交申请，管理员直接借用）
  const handleSaveOccupancy = async () => {
    if (!occupancyModal.device) return;
    if (!occupancyEndTime) {
      toast.warning('请选择结束时间');
      return;
    }
    try {
      if (isAdmin()) {
        // 管理员直接借用
        const result = await deviceAPI.setOccupancy(
          occupancyModal.device.merchantId,
          occupancyPurpose,
          null,
          new Date(occupancyEndTime).toISOString()
        );
        if (result.success) {
          toast.success('借用成功');
          loadDevices(currentPage, pageSize, searchText);
          setOccupancyModal({ show: false, device: null });
        } else {
          toast.error(result.error);
        }
      } else {
        // 普通用户提交借用申请
        const result = await deviceAPI.submitPosBorrowRequest(
          occupancyModal.device.merchantId,
          occupancyPurpose,
          new Date(occupancyEndTime).toISOString()
        );
        if (result.success) {
          toast.success('借用申请已提交，请等待审核');
          setOccupancyModal({ show: false, device: null });
        } else {
          toast.error(result.error || '提交失败');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  // 释放设备占用
  const handleReleaseOccupancy = async () => {
    if (!occupancyModal.device) return;
    setConfirmDialog({ show: true, type: 'release', data: occupancyModal.device });
  };

  // 删除离线设备（仅管理员）
  const handleDeleteDevice = async (device) => {
    setConfirmDialog({ show: true, type: 'delete', data: device });
  };

  // 认领设备
  const handleClaimDevice = async (device) => {
    if (!device.merchantId) return;
    setConfirmDialog({ show: true, type: 'claim', data: device });
  };

  // 重置认领状态（仅管理员）
  const handleResetOwner = async (device) => {
    if (!device.merchantId) return;
    setConfirmDialog({ show: true, type: 'resetOwner', data: device });
  };

  const handleBackupLicense = async (device) => {
    if (!device?.merchantId) {
      toast.warning('缺少商家ID，无法备份License');
      return;
    }

    const ok = await toast.confirm(
      `确定要备份设备 ${device.name || device.merchantId} 的 License 配置吗？`,
      {
        title: '确认备份',
        variant: 'primary',
        confirmText: '开始备份'
      }
    );
    if (!ok) return;

    try {
      const response = await deviceAPI.backupLicense(device.merchantId);
      const blob = response.data;
      if (!(blob instanceof Blob)) {
        toast.error('License备份失败');
        return;
      }

      const contentDisposition = response.headers?.['content-disposition'] || '';
      const fallbackName = `License${device.merchantId}_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)}.sql`;
      const filename = extractFilenameFromDisposition(contentDisposition) || fallbackName;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('License备份成功');
    } catch (error) {
      const errorPayload = error.response?.data;
      if (errorPayload instanceof Blob) {
        try {
          const text = await errorPayload.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.error || 'License备份失败');
          return;
        } catch (_) {
          // ignore parse error and fallback to generic message
        }
      }
      toast.error(error.response?.data?.error || 'License备份失败');
    }
  };

  const handleImportLicense = (device) => {
    if (!device?.merchantId) {
      toast.warning('缺少商家ID，无法导入License');
      return;
    }
    licenseImportDeviceRef.current = device;
    if (licenseFileInputRef.current) {
      licenseFileInputRef.current.value = '';
      licenseFileInputRef.current.click();
    }
  };

  const handleOpenDatabaseBackupRestore = (device) => {
    if (!device?.merchantId) {
      toast.warning('缺少商家ID，无法执行数据备份/恢复');
      return;
    }
    setDbBackupModal({
      show: true,
      device
    });
  };

  const handleLicenseFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) {
      licenseImportDeviceRef.current = null;
      return;
    }

    const targetDevice = licenseImportDeviceRef.current;
    if (!targetDevice?.merchantId) {
      licenseImportDeviceRef.current = null;
      toast.warning('缺少商家ID，无法导入License');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.sql')) {
      licenseImportDeviceRef.current = null;
      toast.warning('仅支持上传 .sql 文件');
      return;
    }

    const ok = await toast.confirm(
      `确定要向设备 ${targetDevice.name || targetDevice.merchantId} 导入 License 文件 ${file.name} 吗？导入失败将自动回滚。`,
      {
        title: '确认导入',
        confirmText: '导入'
      }
    );
    if (!ok) {
      licenseImportDeviceRef.current = null;
      return;
    }

    try {
      const result = await deviceAPI.importLicense(targetDevice.merchantId, file);
      if (result.success) {
        const executedCount = Number(result.data?.executed_count || 0);
        toast.success(`License导入成功，执行 ${executedCount} 条SQL`);
        loadDevices(currentPage, pageSize, searchText, filterTypes, filterProperties, onlyMyDevices);
      } else {
        toast.error(result.error || 'License导入失败');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'License导入失败');
    } finally {
      licenseImportDeviceRef.current = null;
    }
  };

  // 确认操作
  const confirmAction = async () => {
    const { type, data } = confirmDialog;
    setConfirmDialog({ show: false, type: null, data: null });

    if (type === 'release') {
      try {
        const result = await deviceAPI.releaseOccupancy(data.merchantId);
        if (result.success) {
          toast.success('设备已归还');
          loadDevices(currentPage, pageSize, searchText);
          setOccupancyModal({ show: false, device: null });
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error('释放失败');
      }
    } else if (type === 'delete') {
      try {
        // 优先使用 merchantId，如果没有则使用 IP
        const deviceId = data.merchantId || data.ip;
        const response = await deviceAPI.deleteDevice(deviceId);
        if (response.success) {
          toast.success('设备已删除');
          loadDevices(currentPage, pageSize, searchText);
        } else {
          toast.error(response.error || '删除失败');
        }
      } catch (error) {
        console.error('删除设备失败:', error);
        toast.error('删除失败');
      }
    } else if (type === 'claim') {
      try {
        const response = await deviceAPI.submitClaim(data.merchantId);
        if (response.success) {
          toast.success(response.message || '认领申请已提交');
        } else {
          toast.error(response.error || '提交失败');
        }
      } catch (error) {
        console.error('认领设备失败:', error);
        const errorMsg = error.response?.data?.error || error.message || '提交失败';
        toast.error(errorMsg);
      }
    } else if (type === 'resetOwner') {
      try {
        const response = await deviceAPI.resetOwner(data.merchantId);
        if (response.success) {
          toast.success('认领状态已重置');
          loadDevices(currentPage, pageSize, searchText);
        } else {
          toast.error(response.error || '重置失败');
        }
      } catch (error) {
        console.error('重置认领状态失败:', error);
        toast.error('重置失败');
      }
    }
  };

  // 获取确认对话框配置
  const getConfirmConfig = () => {
    const { type, data } = confirmDialog;
    const deviceName = data?.name || data?.merchantId || data?.ip || '';
    switch (type) {
      case 'release':
        return { title: '确认归还', message: '确定要释放此设备吗？', confirmText: '归还' };
      case 'delete':
        return { title: '确认删除', message: `确定要删除设备 ${deviceName} 吗？此操作不可恢复。`, confirmText: '删除' };
      case 'claim':
        return { title: '确认认领', message: `确定要认领设备 ${deviceName} 吗？认领申请将提交给管理员审核。`, confirmText: '认领' };
      case 'resetOwner':
        return { title: '确认重置', message: `确定要重置设备 ${deviceName} 的认领状态吗？`, confirmText: '重置' };
      default:
        return { title: '确认', message: '', confirmText: '确定' };
    }
  };

  // 刷新设备列表
  const refreshDevices = async () => {
    loadDevices(currentPage, pageSize);
  };

  // 配置按钮无权限提示
  const handleConfigNoPermission = () => {
    toast.warning('您没有权限访问此设备的配置页面，只有管理员、负责人或借用人才能访问');
  };

  return (
    <div style={styles.page}>
      {/* 合并的控制栏：扫描控制 + 搜索 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <div style={styles.ipGroup}>
            <label style={styles.label}>网段</label>
            <select
              value={selectedIP}
              onChange={(e) => setSelectedIP(e.target.value)}
              disabled={isScanning}
              style={styles.select}
            >
              {(localIPs || []).map(ip => (
                <option key={ip} value={ip}>{ip}</option>
              ))}
            </select>
          </div>
          <button
            onClick={isScanning ? stopScan : startScan}
            disabled={!selectedIP}
            style={{
              ...styles.scanBtn,
              ...(isScanning ? styles.btnStop : styles.btnStart),
              ...(!selectedIP ? styles.btnDisabled : {})
            }}
          >
            {isScanning ? '停止' : '扫描'}
          </button>
        </div>

        <div style={styles.toolbarCenter}>
          {/* 类型筛选下拉框 */}
          <div style={styles.filterDropdown} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTypeDropdown(!showTypeDropdown); setShowPropertyDropdown(false); }}
              style={{
                ...styles.filterBtn,
                ...(filterTypes.length > 0 ? styles.filterBtnActive : {})
              }}
            >
              类型 {filterTypes.length > 0 && `(${filterTypes.length})`}
              <span style={styles.dropdownArrow}>▼</span>
            </button>
            {showTypeDropdown && (
              <div style={styles.dropdownMenu}>
                {availableTypes.length === 0 ? (
                  <div style={styles.dropdownEmpty}>暂无类型</div>
                ) : (
                  availableTypes.map(type => (
                    <label key={type} style={styles.dropdownItem}>
                      <input
                        type="checkbox"
                        checked={filterTypes.includes(type)}
                        onChange={(e) => handleFilterChange('type', type, e.target.checked)}
                      />
                      <span>{type}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 分类筛选下拉框 */}
          <div style={styles.filterDropdown} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowPropertyDropdown(!showPropertyDropdown); setShowTypeDropdown(false); }}
              style={{
                ...styles.filterBtn,
                ...(filterProperties.length > 0 ? styles.filterBtnActive : {})
              }}
            >
              分类 {filterProperties.length > 0 && `(${filterProperties.length})`}
              <span style={styles.dropdownArrow}>▼</span>
            </button>
            {showPropertyDropdown && (
              <div style={styles.dropdownMenu}>
                {availableProperties.length === 0 ? (
                  <div style={styles.dropdownEmpty}>暂无分类</div>
                ) : (
                  availableProperties.map(prop => (
                    <label key={prop} style={styles.dropdownItem}>
                      <input
                        type="checkbox"
                        checked={filterProperties.includes(prop)}
                        onChange={(e) => handleFilterChange('property', prop, e.target.checked)}
                      />
                      <span>{prop}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <label
            style={{
              ...styles.mineOnlyToggle,
              ...(onlyMyDevices ? styles.mineOnlyToggleActive : {})
            }}
            title="仅显示我负责或我借用的POS设备"
          >
            <input
              type="checkbox"
              checked={onlyMyDevices}
              onChange={(e) => handleOnlyMyDevicesChange(e.target.checked)}
              style={styles.mineOnlyCheckbox}
            />
            <span>只展示我的设备</span>
          </label>

          <input
            type="text"
            placeholder="搜索IP/ID/名称/版本..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={styles.searchInput}
          />
          <button onClick={handleSearch} style={styles.searchBtn}>搜索</button>
          {(searchText || filterTypes.length > 0 || filterProperties.length > 0) && (
            <button onClick={clearSearch} style={styles.clearBtn}>清除</button>
          )}
        </div>

        <div style={styles.toolbarRight}>
          {lastScanAt && (
            <span style={styles.lastScan}>上次扫描: {formatLastScanTime(lastScanAt)}</span>
          )}
          <span style={styles.count}>{totalDevices} 台设备</span>
        </div>
      </div>

      {/* 进度条 */}
      {isScanning && (
        <div style={styles.progressWrap}>
          <div style={styles.progressHeader}>
            <span>扫描进度</span>
            <span>{scanProgress}% · {currentIP}</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${scanProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div style={styles.tableWrap}>
        <ScanTable
          devices={filteredDevices}
          onOpenDevice={handleOpenDevice}
          onShowDetails={handleShowDetails}
          onEditProperty={handleEditProperty}
          onEditOccupancy={handleEditOccupancy}
          onDeleteDevice={handleDeleteDevice}
          onClaimDevice={handleClaimDevice}
          onResetOwner={handleResetOwner}
          onBackupLicense={handleBackupLicense}
          onImportLicense={handleImportLicense}
          onBackupRestoreDatabase={handleOpenDatabaseBackupRestore}
          isAdmin={isAdmin()}
          currentUserId={user?.id}
          onConfigNoPermission={handleConfigNoPermission}
        />
      </div>

      {/* 分页 */}
      {totalDevices > 0 && (
        <div style={styles.pagination}>
          <div style={styles.paginationInfo}>
            共 {totalDevices} 条，每页
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              style={styles.pageSizeSelect}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            条
          </div>
          <div style={styles.paginationBtns}>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }}
            >
              首页
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{ ...styles.pageBtn, ...(currentPage === 1 ? styles.pageBtnDisabled : {}) }}
            >
              上一页
            </button>
            <span style={styles.pageNum}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }}
            >
              下一页
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              style={{ ...styles.pageBtn, ...(currentPage === totalPages ? styles.pageBtnDisabled : {}) }}
            >
              末页
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <DetailModal
          device={selectedDevice}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* 设备分类编辑弹窗 */}
      {propertyModal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>编辑分类</h3>
              <button onClick={() => setPropertyModal({ show: false, device: null })} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalInfo}>
                商家ID: <strong>{propertyModal.device?.merchantId}</strong>
              </p>
              <p style={styles.modalInfo}>
                设备名称: <strong>{propertyModal.device?.name || '——'}</strong>
              </p>
              <div style={styles.fieldGroup}>
                <label>分类</label>
                <input
                  type="text"
                  value={propertyValue}
                  onChange={(e) => setPropertyValue(e.target.value)}
                  placeholder="如：测试组专用、PC等"
                  style={styles.input}
                />
              </div>
              <div style={styles.modalActions}>
                <button onClick={() => setPropertyModal({ show: false, device: null })} style={styles.btnCancel}>取消</button>
                <button onClick={handleSaveProperty} style={styles.btnSave}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设备借用编辑弹窗 */}
      {occupancyModal.show && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>{occupancyModal.device?.isOccupied ? '借用详情' : '借用设备'}</h3>
              <button onClick={() => setOccupancyModal({ show: false, device: null })} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalInfo}>
                商家ID: <strong>{occupancyModal.device?.merchantId}</strong>
              </p>
              <p style={styles.modalInfo}>
                设备名称: <strong>{occupancyModal.device?.name || '——'}</strong>
              </p>
              <p style={styles.modalInfo}>
                借用人: <strong style={{ color: '#007AFF' }}>{occupancyModal.device?.occupancy?.username || '——'}</strong>
              </p>

              {occupancyModal.device?.isOccupied && !isAdmin() && occupancyModal.device?.occupancy?.userId !== user?.id ? (
                <>
                  <p style={styles.modalInfo}>
                    用途: <strong>{getPurposeText(occupancyModal.device?.occupancy?.purpose) || '——'}</strong>
                  </p>
                  <p style={styles.modalInfo}>
                    归还时间: <strong>{occupancyModal.device?.occupancy?.endTime ? new Date(occupancyModal.device?.occupancy?.endTime).toLocaleString('zh-CN') : '——'}</strong>
                  </p>
                  <div style={styles.modalActions}>
                    <button onClick={() => setOccupancyModal({ show: false, device: null })} style={styles.btnCancel}>关闭</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.fieldGroup}>
                    <label>用途</label>
                    <input
                      type="text"
                      value={occupancyPurpose}
                      onChange={(e) => setOccupancyPurpose(e.target.value)}
                      placeholder="请输入用途"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label>归还时间</label>
                    <input
                      type="datetime-local"
                      value={occupancyEndTime}
                      onChange={(e) => setOccupancyEndTime(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button onClick={() => setOccupancyModal({ show: false, device: null })} style={styles.btnCancel}>取消</button>
                    {occupancyModal.device?.isOccupied && (
                      <button onClick={handleReleaseOccupancy} style={styles.btnDanger}>归还</button>
                    )}
                    <button onClick={handleSaveOccupancy} style={styles.btnSave}>
                      {occupancyModal.device?.isOccupied ? '更新' : '借用'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <DBBackupRestoreModal
        isOpen={dbBackupModal.show}
        onClose={() => setDbBackupModal({ show: false, device: null })}
        device={dbBackupModal.device}
      />

      <input
        ref={licenseFileInputRef}
        type="file"
        accept=".sql,text/sql,application/sql"
        style={{ display: 'none' }}
        onChange={handleLicenseFileChange}
      />

      <ConfirmDialog
        isOpen={confirmDialog.show}
        title={getConfirmConfig().title}
        message={getConfirmConfig().message}
        onConfirm={confirmAction}
        onCancel={() => setConfirmDialog({ show: false, type: null, data: null })}
        confirmText={getConfirmConfig().confirmText}
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    flexWrap: 'wrap',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  ipGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#86868B',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    minWidth: '120px',
    outline: 'none',
  },
  scanBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  btnStart: {
    backgroundColor: '#007AFF',
    color: 'white',
  },
  btnStop: {
    backgroundColor: '#FF3B30',
    color: 'white',
  },
  btnDisabled: {
    backgroundColor: '#C7C7CC',
    cursor: 'not-allowed',
  },
  toolbarCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    flexWrap: 'wrap',
  },
  searchInput: {
    padding: '6px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    width: '200px',
    outline: 'none',
  },
  searchBtn: {
    padding: '6px 12px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  clearBtn: {
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterDropdown: {
    position: 'relative',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: '#fff',
    color: '#1D1D1F',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  filterBtnActive: {
    backgroundColor: '#007AFF',
    color: '#fff',
    borderColor: '#007AFF',
  },
  dropdownArrow: {
    fontSize: '10px',
    marginLeft: '4px',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    minWidth: '140px',
    backgroundColor: '#fff',
    border: '1px solid #E5E5EA',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 100,
    maxHeight: '200px',
    overflowY: 'auto',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dropdownEmpty: {
    padding: '12px',
    fontSize: '12px',
    color: '#86868B',
    textAlign: 'center',
  },
  mineOnlyToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#1D1D1F',
    backgroundColor: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  mineOnlyToggleActive: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    color: '#007AFF',
  },
  mineOnlyCheckbox: {
    margin: 0,
    cursor: 'pointer',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
  },
  lastScan: {
    fontSize: '12px',
    color: '#86868B',
    marginRight: '12px',
  },
  count: {
    fontSize: '13px',
    color: '#86868B',
    fontWeight: '500',
  },
  progressWrap: {
    padding: '10px 16px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '12px',
    color: '#86868B',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#E5E5EA',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #007AFF, #5AC8FA)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  tableWrap: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '360px',
    maxWidth: '90%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #E5E5EA',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#86868B',
    padding: 0,
  },
  modalBody: {
    padding: '20px',
  },
  modalInfo: {
    fontSize: '13px',
    color: '#86868B',
    marginBottom: '8px',
  },
  fieldGroup: {
    marginTop: '16px',
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    marginTop: '6px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  btnCancel: {
    padding: '8px 16px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSave: {
    padding: '8px 16px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    padding: '8px 16px',
    backgroundColor: '#FF3B30',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  paginationInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#86868B',
  },
  pageSizeSelect: {
    padding: '4px 8px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    margin: '0 4px',
  },
  paginationBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pageBtn: {
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  pageNum: {
    padding: '0 12px',
    fontSize: '13px',
    color: '#1D1D1F',
    fontWeight: '500',
  },
};

export default ScanPage;
