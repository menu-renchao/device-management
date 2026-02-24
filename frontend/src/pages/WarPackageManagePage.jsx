import React from 'react';
import WarPackageManager from '../components/linux/WarPackageManager';
import './WarPackageManagePage.css';

const WarPackageManagePage = () => {
  return (
    <div className="war-package-page">
      <div className="page-header">
        <h1 className="page-title">WAR 包管理</h1>
        <p className="page-description">管理 WAR 包的下载、上传和元数据配置</p>
      </div>
      <WarPackageManager />
    </div>
  );
};

export default WarPackageManagePage;
