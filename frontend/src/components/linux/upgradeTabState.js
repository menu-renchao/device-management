export function getNextSelectedConfigIds(currentIds = [], configId, checked) {
  const ids = Array.isArray(currentIds) ? currentIds : [];
  if (checked) {
    return ids.includes(configId) ? ids : [...ids, configId];
  }
  return ids.filter((id) => id !== configId);
}

export function getNextSelectedConfigIdsAfterDelete(currentIds = [], deletedId) {
  return getNextSelectedConfigIds(currentIds, deletedId, false);
}

export function getEnabledConfigIds(configs = []) {
  return configs.filter((config) => config?.enabled).map((config) => config.id);
}

export function canProceedToUpgradeStep({
  selectMode,
  file = null,
  selectedHistoryPackage = null,
  downloadProgress = null,
} = {}) {
  if (selectMode === 'local') {
    return file !== null;
  }
  if (selectMode === 'history') {
    return selectedHistoryPackage !== null;
  }
  if (selectMode === 'download') {
    return downloadProgress?.status === 'completed' || selectedHistoryPackage !== null;
  }
  return false;
}

export function canExecuteUpgrade({
  upgradeMode,
  selectMode,
  file = null,
  selectedHistoryPackage = null,
  downloadProgress = null,
  selectedPackage = null,
} = {}) {
  const canProceed = canProceedToUpgradeStep({
    selectMode,
    file,
    selectedHistoryPackage,
    downloadProgress,
  });

  if (upgradeMode === 'direct') {
    return canProceed;
  }

  return selectedPackage !== null && canProceed;
}

export function resolveUpgradeWarPath({
  selectMode,
  upgradeMode,
  file = null,
  selectedPackage = null,
  selectedHistoryPackage = null,
  historyPackages = [],
} = {}) {
  if (selectMode === 'local') {
    if (!file) {
      return { error: '请先选择 WAR 包' };
    }
    if (upgradeMode === 'direct') {
      return { warPath: '/opt/tomcat7/webapps/kpos.war' };
    }
    return { warPath: `/home/menu/${selectedPackage}/kpos.war` };
  }

  if ((selectMode === 'history' || selectMode === 'download') && selectedHistoryPackage) {
    const targetPackage = historyPackages.find((pkg) => pkg.name === selectedHistoryPackage);
    if (!targetPackage?.file_name) {
      return { error: '无法获取包文件信息，请重新选择历史包' };
    }
    return { warPath: `downloads/${selectedHistoryPackage}/${targetPackage.file_name}` };
  }

  return { error: '请先选择 WAR 包' };
}
