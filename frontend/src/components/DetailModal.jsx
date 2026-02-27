import React, { useState, useEffect } from 'react';
import { scanAPI } from '../services/api';

const DetailModal = ({ device, onClose }) => {
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取设备详情
  useEffect(() => {
    if (!device?.ip) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await scanAPI.getDeviceDetails(device.ip);
        if (response.data?.success && response.data?.data) {
          setFullData(response.data.data);
        } else {
          setError('获取详情失败');
        }
      } catch (err) {
        console.error('获取设备详情失败:', err);
        setError('获取详情失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [device?.ip]);

  if (!device) return null;

  // 获取类型标签颜色
  const getTypeColor = (type) => {
    const colors = {
      'POS': '#1890ff',
      'POS_ANDROID': '#52c41a',
      'POS_IOS': '#722ed1',
      'KIOSK': '#fa8c16',
      'EMENU': '#13c2c2',
      'KITCHEN_DISPLAY': '#eb2f96',
    };
    return colors[type] || '#666';
  };

  // 渲染 AppInstance 列表
  const renderAppInstances = (instances) => {
    if (!instances || instances.length === 0) return null;

    return (
      <div className="app-instances-section">
        <h4 className="section-title">设备实例 ({instances.length})</h4>
        <div className="app-instances-grid">
          {instances.map((instance, index) => {
            const hasUsefulData = instance.displayName || instance.type || instance.inUse !== undefined;
            if (!hasUsefulData) return null;

            return (
              <div key={index} className="app-instance-card">
                <div className="instance-header">
                  <span className="instance-name">{instance.displayName || '未命名'}</span>
                  <span
                    className="instance-type"
                    style={{ backgroundColor: getTypeColor(instance.type) }}
                  >
                    {instance.type || '未知'}
                  </span>
                </div>
                <div className="instance-status">
                  <span className={`status-dot ${instance.inUse ? 'active' : ''}`}></span>
                  <span>{instance.inUse ? '使用中' : '未使用'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染营业时间
  const renderHours = (hours) => {
    if (!hours || hours.length === 0) return null;

    return (
      <div className="info-section">
        <h4 className="section-title">营业时间</h4>
        <div className="hours-list">
          {hours.map((hour, index) => (
            <div key={index} className="hour-item">
              <span className="hour-name">{hour.name}</span>
              <span className="hour-time">{hour.from} - {hour.to}</span>
              {hour.description && <span className="hour-desc">{hour.description}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染图片列表
  const renderImages = (images) => {
    if (!images || images.length === 0) return null;

    return (
      <div className="info-section">
        <h4 className="section-title">图片资源 ({images.length})</h4>
        <div className="images-list">
          {images.map((img, index) => (
            <div key={index} className="image-item">
              <span className="image-name">{img.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染 AppInfo
  const renderAppInfo = (appInfo) => {
    if (!appInfo) return null;

    return (
      <div className="info-section">
        <h4 className="section-title">应用信息</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">版本</span>
            <span className="info-value">{appInfo.version}</span>
          </div>
          <div className="info-item">
            <span className="info-label">许可状态</span>
            <span className={`info-value status-badge ${appInfo.licenseStatus?.toLowerCase()}`}>
              {appInfo.licenseStatus}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">已注册</span>
            <span className="info-value">{appInfo.registered ? '是' : '否'}</span>
          </div>
          {appInfo.patchNo && (
            <div className="info-item">
              <span className="info-label">补丁号</span>
              <span className="info-value">{appInfo.patchNo}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染公司信息
  const renderCompanyInfo = (company) => {
    if (!company) return null;

    return (
      <div className="info-section">
        <h4 className="section-title">公司信息</h4>
        <div className="info-grid">
          <div className="info-item full-width">
            <span className="info-label">公司名称</span>
            <span className="info-value company-name">{company.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">商户ID</span>
            <span className="info-value">{company.merchantId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">商户组ID</span>
            <span className="info-value">{company.merchantGroupId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">业务ID</span>
            <span className="info-value">{company.businessId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">电话</span>
            <span className="info-value">{company.telephone1}</span>
          </div>
          <div className="info-item">
            <span className="info-label">城市</span>
            <span className="info-value">{company.city}</span>
          </div>
          <div className="info-item">
            <span className="info-label">州/省</span>
            <span className="info-value">{company.state}</span>
          </div>
          <div className="info-item">
            <span className="info-label">邮编</span>
            <span className="info-value">{company.zipcode}</span>
          </div>
          <div className="info-item">
            <span className="info-label">地址</span>
            <span className="info-value">{company.address1}</span>
          </div>
          {company.connectedToCloudService !== undefined && (
            <div className="info-item">
              <span className="info-label">云服务</span>
              <span className={`info-value status-badge ${company.connectedToCloudService ? 'connected' : 'disconnected'}`}>
                {company.connectedToCloudService ? '已连接' : '未连接'}
              </span>
            </div>
          )}
          {company.paymentServiceEnabled !== undefined && (
            <div className="info-item">
              <span className="info-label">支付服务</span>
              <span className={`info-value status-badge ${company.paymentServiceEnabled ? 'enabled' : 'disabled'}`}>
                {company.paymentServiceEnabled ? '已启用' : '未启用'}
              </span>
            </div>
          )}
          {company.paymentServiceProviderId && (
            <div className="info-item">
              <span className="info-label">支付服务商ID</span>
              <span className="info-value">{company.paymentServiceProviderId}</span>
            </div>
          )}
          {company.paymentServiceTarget && (
            <div className="info-item">
              <span className="info-label">支付终端</span>
              <span className="info-value">{company.paymentServiceTarget}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染结果信息
  const renderResult = (result) => {
    if (!result) return null;

    return (
      <div className="info-section">
        <h4 className="section-title">请求结果</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">状态</span>
            <span className={`info-value status-badge ${result.successful ? 'success' : 'failed'}`}>
              {result.successful ? '成功' : '失败'}
            </span>
          </div>
          {result.failureReason && (
            <div className="info-item full-width">
              <span className="info-label">失败原因</span>
              <span className="info-value error">{result.failureReason}</span>
            </div>
          )}
          {result.failureReasonCode && (
            <div className="info-item">
              <span className="info-label">错误码</span>
              <span className="info-value">{result.failureReasonCode}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 主渲染逻辑
  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      );
    }

    if (error) {
      return <p className="error-message">{error}</p>;
    }

    if (!fullData) {
      return <p className="no-data">无数据</p>;
    }

    const { company, result } = fullData;

    return (
      <div className="detail-content">
        {company && renderCompanyInfo(company)}
        {company?.appInfo && renderAppInfo(company.appInfo)}
        {company?.appInstance && renderAppInstances(company.appInstance)}
        {company?.hours && renderHours(company.hours)}
        {company?.images && renderImages(company.images)}
        {result && renderResult(result)}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>设备详情 - {device.ip}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DetailModal;