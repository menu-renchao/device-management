import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDeviceStatusPresentation, normalizeMerchantId } from './scanTableState.js';

const ScanTable = ({
  devices = [],
  onOpenDevice,
  onShowDetails,
  onEditProperty,
  onEditOccupancy,
  onDeleteDevice,
  onClaimDevice,
  onResetOwner,
  onManageLicenseBackup,
  onBackupRestoreDatabase,
  isAdmin,
  currentUserId,
  onConfigNoPermission
}) => {
  const navigate = useNavigate();
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [openMenuPlacement, setOpenMenuPlacement] = useState({ direction: 'down', top: 0, left: 0 });

  useEffect(() => {
    const closeMenu = () => setOpenMenuKey(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (openMenuKey === null) return undefined;
    const closeMenuOnViewportChange = () => setOpenMenuKey(null);
    window.addEventListener('resize', closeMenuOnViewportChange);
    window.addEventListener('scroll', closeMenuOnViewportChange, true);
    return () => {
      window.removeEventListener('resize', closeMenuOnViewportChange);
      window.removeEventListener('scroll', closeMenuOnViewportChange, true);
    };
  }, [openMenuKey]);

  // 处理配置按钮点击
  const handleConfigClick = (device) => {
    const isOwner = device.owner?.id === currentUserId;
    const isOccupier = device.occupancy?.userId === currentUserId;
    if (isAdmin || isOwner || isOccupier) {
      navigate(`/linux-config/${device.merchantId}`, { state: { device } });
    } else if (onConfigNoPermission) {
      onConfigNoPermission();
    }
  };

  // 处理数据库配置按钮点击
  const handleDbConfigClick = (device) => {
    if (!device?.merchantId) return;
    const isOwner = device.owner?.id === currentUserId;
    const isOccupier = device.occupancy?.userId === currentUserId;
    if (isAdmin || isOwner || isOccupier) {
      navigate(`/db-config/${device.merchantId}`, { state: { device } });
    } else if (onConfigNoPermission) {
      onConfigNoPermission();
    }
  };

  const supportsDBConfig = (deviceType) => {
    const type = (deviceType || '').toLowerCase();
    return type === 'linux' || type === 'windows';
  };

  const canAccessDeviceConfig = (device) => {
    const isOwner = device.owner?.id === currentUserId;
    const isOccupier = device.occupancy?.userId === currentUserId;
    return isAdmin || isOwner || isOccupier;
  };

  const calculateMenuPlacement = (triggerEl) => {
    if (!triggerEl) {
      return { direction: 'down', top: 0, left: 0 };
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const safePadding = 12;
    const estimatedMenuHeight = 340;
    const estimatedMenuWidth = 132;

    const spaceAbove = Math.max(0, Math.floor(triggerRect.top - safePadding));
    const spaceBelow = Math.max(0, Math.floor(viewportHeight - triggerRect.bottom - safePadding));
    const shouldOpenUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    const desiredTop = shouldOpenUp
      ? triggerRect.top - estimatedMenuHeight - 6
      : triggerRect.bottom + 6;
    const top = Math.max(
      safePadding,
      Math.min(desiredTop, viewportHeight - estimatedMenuHeight - safePadding)
    );

    const desiredLeft = triggerRect.right - estimatedMenuWidth;
    const left = Math.max(
      safePadding,
      Math.min(desiredLeft, viewportWidth - estimatedMenuWidth - safePadding)
    );

    return {
      direction: shouldOpenUp ? 'up' : 'down',
      top,
      left
    };
  };

  const toggleMoreMenu = (e, rowKey) => {
    e.stopPropagation();
    if (openMenuKey === rowKey) {
      setOpenMenuKey(null);
      return;
    }
    setOpenMenuPlacement(calculateMenuPlacement(e.currentTarget));
    setOpenMenuKey(rowKey);
  };

  const handleMenuAction = (e, action) => {
    e.stopPropagation();
    setOpenMenuKey(null);
    action();
  };

  const getConfigDisabledReason = (device) => {
    if (!device?.merchantId) return '缺少商家ID，无法配置';
    if (!canAccessDeviceConfig(device)) return '无权限：仅管理员、负责人或借用人可操作';
    return '';
  };
  // 格式化时间显示
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 格式化上次在线时间
  const formatLastOnlineTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeviceTypeIcon = (deviceType) => {
    const type = (deviceType || '').toLowerCase();
    if (type.includes('linux')) return '🐧';
    if (type.includes('win')) return '🪟';
    return '🖥';
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

  const getPurposeDisplay = (hasMerchantId, isOccupied, purposeText) => {
    if (!hasMerchantId) {
      return { text: '不适用', tone: 'muted', title: '缺少商家ID' };
    }
    if (!isOccupied) {
      return { text: '空闲中', tone: 'idle', title: '设备当前未借用' };
    }
    if (!purposeText) {
      return { text: '待补充', tone: 'warn', title: '借用用途未填写' };
    }
    return { text: purposeText, tone: 'normal', title: purposeText };
  };

  const getReturnDisplay = (hasMerchantId, isOccupied, endTime) => {
    if (!hasMerchantId) {
      return { text: '不适用', tone: 'muted', title: '缺少商家ID' };
    }
    if (!isOccupied) {
      return { text: '无需归还', tone: 'idle', title: '设备当前未借用' };
    }

    const formattedTime = formatTime(endTime);
    if (!formattedTime) {
      return { text: '未设置', tone: 'warn', title: '归还时间未设置' };
    }

    return { text: formattedTime, tone: 'normal', title: formattedTime };
  };

  return (
    <div className="scan-table-container">
      <table className="scan-table">
        <thead>
          <tr>
            <th className="ip-col">设备</th>
            <th className="merchant-col">商家 / MID</th>
            <th className="property-col">分类</th>
            <th className="version-col">版本</th>
            <th className="owner-col">负责人</th>
            <th className="occupancy-col">借用状态</th>
            <th className="purpose-col">用途</th>
            <th className="return-col">归还时间</th>
            <th className="action-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device, index) => {
            const rowKey = device.id || `${device.ip}-${device.merchantId || index}`;
            const merchantId = normalizeMerchantId(device.merchantId);
            const hasMerchantId = merchantId !== '';
            const isOnlineDevice = device.isOnline === true;
            const canOpen = isOnlineDevice && hasMerchantId;
            const canShowDetails = hasMerchantId;
            const isLinuxDevice = (device.type || '').toLowerCase() === 'linux';
            const showDBConfig = supportsDBConfig(device.type);
            const configDisabledReason = getConfigDisabledReason(device);
            const canUseConfig = configDisabledReason === '';
            const showDelete = isAdmin && (!isOnlineDevice || !hasMerchantId);
            const canClaimDevice = hasMerchantId && !device.owner && !device.ownerId;
            const canResetOwner = isAdmin && hasMerchantId && (!!device.owner || !!device.ownerId);
            const canManageBorrow = hasMerchantId;
            const canManageLicense = hasMerchantId && canAccessDeviceConfig(device);
            const canManageLicenseBackup = canManageLicense && typeof onManageLicenseBackup === 'function';
            const canBackupRestoreDatabase = canManageLicense && typeof onBackupRestoreDatabase === 'function';
            const hasMoreActions = isLinuxDevice || showDBConfig || showDelete || canClaimDevice || canResetOwner || canManageBorrow || canManageLicenseBackup || canBackupRestoreDatabase;
            const offlineTimeText = formatLastOnlineTime(device.lastOnlineTime);
            let statusText = isOnlineDevice
              ? '在线'
              : (offlineTimeText ? `离线 ${offlineTimeText}` : '离线');
            let statusToneClassName = isOnlineDevice
              ? 'online'
              : 'offline';
            let statusDotClassName = isOnlineDevice
              ? 'online-indicator'
              : 'offline-indicator';
            const statusPresentation = getDeviceStatusPresentation(device, offlineTimeText);
            statusText = statusPresentation.text;
            statusToneClassName = statusPresentation.toneClassName;
            statusDotClassName = statusPresentation.dotClassName;
            const merchantIdText = device.merchantId || (device.name && device.version ? 'Free Trials' : '——');
            const propertyText = (device.property || '').trim();
            const typeLower = (device.type || '').toLowerCase();
            const deviceTypeText = device.type || '未知类型';
            const deviceTypeIcon = getDeviceTypeIcon(device.type);
            const deviceTypeClass = typeLower.includes('linux') ? 'linux' : (typeLower.includes('win') ? 'windows' : 'other');
            const canViewDetails = canShowDetails && typeof onShowDetails === 'function';
            const occupancyPurposeText = getPurposeText(device.occupancy?.purpose);
            const purposeDisplay = getPurposeDisplay(hasMerchantId, device.isOccupied, occupancyPurposeText);
            const returnDisplay = getReturnDisplay(hasMerchantId, device.isOccupied, device.occupancy?.endTime);

            return (
            <tr
              key={rowKey}
              className={`${index % 2 === 0 ? 'even' : 'odd'} ${canViewDetails ? 'row-clickable' : ''}`}
              onClick={() => canViewDetails && onShowDetails(device)}
              title={canViewDetails ? '点击查看详情' : ''}
            >
              <td className="ip-col-cell">
                <div className="device-cell">
                  <div className="device-top-line">
                    <span className="ip-address" title={device.ip || '——'}>{device.ip || '——'}</span>
                    <span className={statusDotClassName} title={statusText}></span>
                  </div>
                  <div className="device-bottom-line" title={`设备类型: ${deviceTypeText} · ${statusText}`}>
                    <span
                      className={`ip-type-icon ${deviceTypeClass}`}
                      title={`设备类型: ${deviceTypeText}`}
                    >
                      {deviceTypeIcon}
                    </span>
                    <span className={`device-status-text ${statusToneClassName}`}>{statusText}</span>
                  </div>
                </div>
              </td>
              <td className="merchant-col-cell">
                <div className="merchant-cell-stack">
                  <span className="merchant-name" title={device.name || '——'}>{device.name || '——'}</span>
                  <span className="merchant-mid" title={`MID: ${merchantIdText}`}>MID: {merchantIdText}</span>
                </div>
              </td>
              <td className="property-col-cell">
                {propertyText ? (
                  <span className="property-tag merchant-property" title={`分类: ${propertyText}`}>
                    {propertyText}
                  </span>
                ) : (
                  <span className="property-empty">——</span>
                )}
              </td>
              <td className="version-col-cell">
                <span className="version-text" title={device.version || '——'}>{device.version || '——'}</span>
              </td>
              <td className="owner-col-cell">
                {device.owner ? (
                  <div className="owner-cell">
                    <span className="owner-name" title={device.owner.username || '用户已删除'}>
                      {device.owner.username || '用户已删除'}
                    </span>
                  </div>
                ) : device.ownerId ? (
                  // ownerId 有值但 owner 为空，说明用户已被删除
                  <div className="owner-cell">
                    <span className="owner-name deleted-owner">用户已删除</span>
                  </div>
                ) : device.merchantId ? (
                  <span className="owner-unclaimed">未认领</span>
                ) : (
                  <span className="property-empty">——</span>
                )}
              </td>
              <td className="occupancy-col-cell">
                {hasMerchantId ? (
                  device.isOccupied ? (
                    <span
                      className="occupancy-occupied"
                      title={`借用人: ${device.occupancy?.username || '用户已删除'}`}
                    >
                      {device.occupancy?.username || '用户已删除'}
                    </span>
                  ) : (
                    <span className="occupancy-free">可借用</span>
                  )
                ) : (
                  <span className="property-empty">——</span>
                )}
              </td>
              <td className="purpose-col-cell" title={purposeDisplay.title}>
                <span className={purposeDisplay.tone === 'normal' ? 'semantic-value' : `semantic-value semantic-value-${purposeDisplay.tone}`}>
                  {purposeDisplay.text}
                </span>
              </td>
              <td className="return-col-cell" title={returnDisplay.title}>
                <span className={returnDisplay.tone === 'normal' ? 'semantic-value' : `semantic-value semantic-value-${returnDisplay.tone}`}>
                  {returnDisplay.text}
                </span>
              </td>
              <td className="action-col-cell">
                <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                  {canOpen && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDevice(device.ip);
                      }}
                    >
                      打开
                    </button>
                  )}

                  {hasMoreActions && (
                    <div className="action-more-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-sm btn-secondary btn-more"
                        onClick={(e) => toggleMoreMenu(e, rowKey)}
                        aria-expanded={openMenuKey === rowKey}
                      >
                        更多
                      </button>

                      {openMenuKey === rowKey && (
                        <div
                          className={`action-dropdown ${openMenuPlacement.direction === 'up' ? 'up' : 'down'}`}
                          style={{
                            top: `${openMenuPlacement.top}px`,
                            left: `${openMenuPlacement.left}px`
                          }}
                        >
                          {isAdmin && hasMerchantId && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onEditProperty(device))}
                              title="编辑设备分类"
                            >
                              编辑分类
                            </button>
                          )}

                          {isLinuxDevice && (
                            <button
                              className={`action-menu-item ${!canUseConfig ? 'disabled' : ''}`}
                              disabled={!canUseConfig}
                              title={configDisabledReason || 'Linux 配置管理'}
                              onClick={(e) => handleMenuAction(e, () => handleConfigClick(device))}
                            >
                              Linux配置
                            </button>
                          )}

                          {showDBConfig && (
                            <button
                              className={`action-menu-item ${!canUseConfig ? 'disabled' : ''}`}
                              disabled={!canUseConfig}
                              title={configDisabledReason || '数据库配置管理'}
                              onClick={(e) => handleMenuAction(e, () => handleDbConfigClick(device))}
                            >
                              数据库配置
                            </button>
                          )}

                          {canManageLicenseBackup && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onManageLicenseBackup(device))}
                              title="打开 License 备份与导入弹窗"
                            >
                              License备份/导入
                            </button>
                          )}

                          {canBackupRestoreDatabase && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onBackupRestoreDatabase(device))}
                              title="创建备份或从服务端/本地上传恢复数据库"
                            >
                              数据备份/恢复
                            </button>
                          )}

                          {canManageBorrow && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onEditOccupancy(device))}
                              title={device.isOccupied ? '查看借用并可操作归还' : '借用设备'}
                            >
                              {device.isOccupied ? '借用管理' : '借用设备'}
                            </button>
                          )}

                          {canClaimDevice && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onClaimDevice(device))}
                              title="提交认领申请"
                            >
                              认领设备
                            </button>
                          )}

                          {canResetOwner && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => handleMenuAction(e, () => onResetOwner(device))}
                              title="重置负责人"
                            >
                              重置负责人
                            </button>
                          )}

                          {showDelete && (
                            <button
                              className="action-menu-item danger"
                              onClick={(e) => handleMenuAction(e, () => onDeleteDevice(device))}
                              title="删除此设备"
                            >
                              删除设备
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!canOpen && !hasMoreActions && (
                    <span className="property-empty">——</span>
                  )}

                </div>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};

export default ScanTable;
