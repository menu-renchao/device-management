export function createUpgradeSteps(upgradeMode) {
  if (upgradeMode === 'package') {
    return [
      { name: '停止 POS 服务', status: 'pending', progress: 0 },
      { name: '复制/上传 WAR 包', status: 'pending', progress: 0 },
      { name: '执行 update.sh', status: 'pending', progress: 0 },
      { name: '执行配置修改', status: 'pending', progress: 0 },
      { name: '重启 POS 服务', status: 'pending', progress: 0 },
    ];
  }

  return [
    { name: '停止 POS 服务', status: 'pending', progress: 0 },
    { name: '上传/复制 WAR 包', status: 'pending', progress: 0 },
    { name: '解压 WAR 包', status: 'pending', progress: 0 },
    { name: '执行配置修改', status: 'pending', progress: 0 },
    { name: '重启 POS 服务', status: 'pending', progress: 0 },
  ];
}
