import React, { useState, useRef, useEffect, useCallback } from 'react';
import { linuxAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import FileConfigModal from './FileConfigModal';
import DownloadConfigModal from './DownloadConfigModal';
import UpgradeConfigStep from './UpgradeConfigStep';
import UpgradeWarSelectionStep from './UpgradeWarSelectionStep';
import UpgradeModeStep from './UpgradeModeStep';
import UpgradeExecutionOverlay from './UpgradeExecutionOverlay';
import { createUpgradeSteps } from './upgradeStepTemplates.js';
import {
  canExecuteUpgrade,
  getEnabledConfigIds,
  getNextSelectedConfigIds,
  getNextSelectedConfigIdsAfterDelete,
  resolveUpgradeWarPath,
} from './upgradeTabState.js';

const UpgradeTab = ({ merchantId }) => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  // Step 1: Environment and config states
  const [env, setEnv] = useState('QA');
  const [configs, setConfigs] = useState([]);
  const [selectedConfigs, setSelectedConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [configSectionExpanded, setConfigSectionExpanded] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [expandedConfig, setExpandedConfig] = useState(null);

  // Step 2: WAR package states
  const [selectMode, setSelectMode] = useState('local'); // 'local', 'download', 'history'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [remoteProgress, setRemoteProgress] = useState(null);
  const [localMD5, setLocalMD5] = useState('');
  const [remoteMD5, setRemoteMD5] = useState('');
  const [uploadComplete, setUploadComplete] = useState(false);
  const [md5Comparing, setMd5Comparing] = useState(false);
  const [md5Match, setMd5Match] = useState(null); // null: 未比对, true: 匹配, false: 不匹配
  const [showMd5Confirm, setShowMd5Confirm] = useState(false);
  const fileInputRef = useRef(null);
  const initialLoadDone = useRef(false);

  // WAR download states
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadTaskId, setDownloadTaskId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [historyPackages, setHistoryPackages] = useState([]);
  const [selectedHistoryPackage, setSelectedHistoryPackage] = useState(null);
  const [showDownloadConfig, setShowDownloadConfig] = useState(false);
  const [duplicateVersion, setDuplicateVersion] = useState(null);

  // Step 3: Upgrade mode states
  const [upgradeMode, setUpgradeMode] = useState('direct'); // 'direct' | 'package'
  const [upgradePackages, setUpgradePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageUploading, setPackageUploading] = useState(false);
  const [packageUploadProgress, setPackageUploadProgress] = useState(0);
  const [packageFile, setPackageFile] = useState(null);
  const packageFileInputRef = useRef(null);

  // Execution states
  const [executing, setExecuting] = useState(false);
  const [executeProgress, setExecuteProgress] = useState(0);
  const [executeMessage, setExecuteMessage] = useState('');
  const [executeResult, setExecuteResult] = useState(null); // null | 'success' | 'error'
  const [executeError, setExecuteError] = useState('');

  // SSE upgrade states
  const [upgradeTaskId, setUpgradeTaskId] = useState(null);
  const [upgradeSteps, setUpgradeSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const eventSourceRef = useRef(null);

  // Config execution states (单独执行配置修改)
  const [executingConfigs, setExecutingConfigs] = useState(false);
  const [configExecuteResults, setConfigExecuteResults] = useState(null);

  const updateUpgradeStep = useCallback((index, status, message = '') => {
    setUpgradeSteps((current) => current.map((step, stepIndex) => {
      if (stepIndex !== index) {
        return step;
      }

      if (status === 'completed') {
        return {
          name: step.name,
          status: 'completed',
          progress: 100,
        };
      }

      return {
        ...step,
        status,
        ...(typeof step.progress === 'number' ? { progress: step.progress } : {}),
        ...(message ? { message } : {}),
      };
    }));
  }, []);

  // 页面离开提示（升级过程中）
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (executing) {
        e.preventDefault();
        e.returnValue = '升级正在进行中，确定要离开吗？离开可能导致升级失败。';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [executing]);

  // Load configs on mount
  useEffect(() => {
    // 防止 React StrictMode 双重调用
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadConfigs();
    loadHistoryPackages();
  }, []);

  const loadHistoryPackages = async () => {
    try {
      // 升级部署页面只展示 war 包
      const result = await linuxAPI.getWarPackages('war');
      setHistoryPackages(result.data?.packages || []);
    } catch (error) {
      console.error('加载历史包列表失败:', error);
    }
  };

  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const result = await linuxAPI.getFileConfigs();
      setConfigs(result.data?.configs || []);
    } catch (error) {
      console.error('加载配置列表失败:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const loadUpgradePackages = async () => {
    setLoadingPackages(true);
    try {
      const result = await linuxAPI.scanUpgradePackages(merchantId);
      setUpgradePackages(result.data?.packages || []);
    } catch (error) {
      console.error('扫描升级包失败:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleToggleConfig = async (configId, enabled) => {
    try {
      await linuxAPI.toggleFileConfig(configId, enabled);
      toast.success(enabled ? '配置已启用' : '配置已禁用');
      loadConfigs();
    } catch (error) {
      toast.error('切换状态失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteConfig = async (configId) => {
    if (!(await toast.confirm('确定要删除此配置吗？此操作不可恢复。', { title: '删除配置' }))) {
      return;
    }
    try {
      await linuxAPI.deleteFileConfig(configId);
      toast.success('配置已删除');
      setSelectedConfigs(getNextSelectedConfigIdsAfterDelete(selectedConfigs, configId));
      loadConfigs();
    } catch (error) {
      toast.error('删除失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleSelectConfig = (configId, checked) => {
    setSelectedConfigs(getNextSelectedConfigIds(selectedConfigs, configId, checked));
  };

  const handleSelectAllConfigs = (checked) => {
    if (checked) {
      setSelectedConfigs(getEnabledConfigIds(configs));
    } else {
      setSelectedConfigs([]);
    }
  };

  // 单独执行配置修改（不依赖升级流程）
  const handleExecuteConfigsOnly = async () => {
    if (selectedConfigs.length === 0) {
      toast.warning('请先选择要执行的配置');
      return;
    }

    if (!(await toast.confirm(`确定要在 ${env} 环境下执行选中的 ${selectedConfigs.length} 个配置修改吗？`, {
      title: '执行配置修改',
      variant: 'primary',
      confirmText: '确认执行',
    }))) {
      return;
    }

    setExecutingConfigs(true);
    setConfigExecuteResults(null);

    try {
      const result = await linuxAPI.executeFileConfigs(merchantId, selectedConfigs, env);
      setConfigExecuteResults(result.data);

      if (result.data?.failed > 0) {
        toast.warning(`执行完成：${result.data.success} 个成功，${result.data.failed} 个失败`);
      } else {
        toast.success(`配置修改完成：${result.data?.success || 0} 个成功`);
      }
    } catch (error) {
      toast.error('执行配置修改失败：' + (error.response?.data?.message || error.message));
    } finally {
      setExecutingConfigs(false);
    }
  };

  const resetWarSelectionState = useCallback(() => {
    setLocalMD5('');
    setRemoteMD5('');
    setMd5Match(null);
    setMd5Comparing(false);
    setShowMd5Confirm(false);
  }, []);

  const handleSelectMode = useCallback((mode) => {
    setSelectMode(mode);
    resetWarSelectionState();
  }, [resetWarSelectionState]);

  const handleChooseLocalFile = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setFile(null);
    resetWarSelectionState();
    setUploadComplete(false);
    setRemoteProgress(null);
    fileInputRef.current?.click();
  }, [resetWarSelectionState]);

  // WAR download handlers
  const handleStartDownload = async (overwrite = false) => {
    if (!downloadUrl.trim()) {
      toast.warning('请输入下载 URL');
      return;
    }

    setDownloading(true);
    setDownloadProgress(null);

    try {
      const result = await linuxAPI.startWarDownload(downloadUrl, overwrite);

      if (result.data?.exists) {
        setDownloading(false);
        setDuplicateVersion(result.data);
        return;
      }

      setDownloadTaskId(result.data?.task_id);
      pollDownloadProgress(result.data?.task_id);
    } catch (error) {
      toast.error('开始下载失败：' + (error.response?.data?.message || error.message));
      setDownloading(false);
    }
  };

  const handleOverwriteDownload = () => {
    setDuplicateVersion(null);
    handleStartDownload(true);
  };

  const handleUseExisting = () => {
    if (duplicateVersion) {
      setSelectedHistoryPackage(duplicateVersion.version);
      setSelectMode('history');
    }
    setDuplicateVersion(null);
  };

  const handleDeletePackage = async (name) => {
    if (!(await toast.confirm(`确定要删除 ${name} 吗？此操作不可恢复。`, { title: '删除包' }))) {
      return;
    }

    try {
      await linuxAPI.deleteWarPackage(name);
      if (selectedHistoryPackage === name) {
        setSelectedHistoryPackage(null);
      }
      loadHistoryPackages();
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败：' + (error.response?.data?.message || error.message));
    }
  };

  // Handle history package selection with MD5 comparison
  const handleSelectHistoryPackage = async (pkg) => {
    setSelectedHistoryPackage(pkg.name);
    setMd5Match(null);
    setShowMd5Confirm(false);
    setRemoteMD5('');
    setLocalMD5('');

    // 获取包的 MD5 并与远程比对
    try {
      const result = await linuxAPI.getWarPackageMD5(pkg.name);
      if (result.data?.md5) {
        setLocalMD5(result.data.md5);
        compareMD5WithRemote(result.data.md5, 'history');
      }
    } catch (error) {
      console.error('获取历史包 MD5 失败:', error);
    }
  };

  const handleCancelDownload = async () => {
    if (!downloadTaskId) return;

    try {
      await linuxAPI.cancelWarDownload(downloadTaskId);
      setDownloading(false);
      setDownloadProgress(null);
      setDownloadTaskId(null);
    } catch (error) {
      console.error('取消下载失败:', error);
      setDownloading(false);
    }
  };

  const pollDownloadProgress = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const result = await linuxAPI.getWarDownloadProgress(taskId);

        if (!result.success || result.data?.status === 'not_found') {
          clearInterval(interval);
          setDownloading(false);
          toast.error('下载任务已丢失，请重新下载');
          return;
        }

        setDownloadProgress(result.data);

        if (result.data?.status === 'completed') {
          clearInterval(interval);
          setDownloading(false);
          loadHistoryPackages();
          setSelectedHistoryPackage(result.data?.name);
          setSelectMode('history');
          toast.success('下载完成！');

          // 下载完成后获取包 MD5 并比对
          try {
            const md5Result = await linuxAPI.getWarPackageMD5(result.data?.name);
            if (md5Result.data?.md5) {
              setLocalMD5(md5Result.data.md5);
              compareMD5WithRemote(md5Result.data.md5, 'download');
            }
          } catch (error) {
            console.error('获取下载包 MD5 失败:', error);
          }
        } else if (result.data?.status === 'failed') {
          clearInterval(interval);
          setDownloading(false);
          toast.error('下载失败：' + (result.data?.error || '未知错误'));
        } else if (result.data?.status === 'cancelled') {
          clearInterval(interval);
          setDownloading(false);
        } else if (result.data?.status === 'duplicate') {
          clearInterval(interval);
          setDownloading(false);
          setDuplicateVersion({
            version: result.data?.name,
            file_name: result.data?.file_name
          });
        }
      } catch (error) {
        console.error('获取进度失败:', error);
        clearInterval(interval);
        setDownloading(false);
        toast.error('获取下载进度失败，请重新下载');
      }
    }, 1000);
  };

  // MD5 comparison helper - 仅比对，不自动上传
  const compareMD5WithRemote = async (localMd5Value, source = 'local') => {
    if (!merchantId || !localMd5Value) return;

    setMd5Comparing(true);
    try {
      // 获取远程服务器上 kpos.war 的 MD5
      const remotePath = '/opt/tomcat7/webapps/kpos.war';
      const result = await linuxAPI.getRemoteMD5(merchantId, remotePath);
      const remoteMd5Value = result.data?.md5 || '';
      setRemoteMD5(remoteMd5Value);

      if (remoteMd5Value && localMd5Value) {
        const isMatch = localMd5Value.toLowerCase() === remoteMd5Value.toLowerCase();
        setMd5Match(isMatch);
      } else {
        // 远程文件不存在
        setMd5Match(false);
      }
    } catch (error) {
      console.error('获取远程 MD5 失败:', error);
      // 远程文件可能不存在
      setMd5Match(false);
    } finally {
      setMd5Comparing(false);
    }
  };

  // File upload handlers
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadComplete(false);
      setRemoteMD5('');
      setMd5Match(null);
      setShowMd5Confirm(false);

      try {
        // 计算本地 MD5
        const result = await linuxAPI.calculateLocalMD5(selectedFile);
        const md5 = result.data?.md5 || '';
        setLocalMD5(md5);

        // 比对远程 MD5（不自动上传，等用户确认）
        compareMD5WithRemote(md5, 'local');
      } catch (error) {
        console.error('计算 MD5 失败:', error);
      }
    }
  };

  // 用户确认继续（MD5 匹配时，仅关闭弹窗）
  const handleConfirmUpload = () => {
    setShowMd5Confirm(false);
  };

  // 用户取消选择文件
  const handleCancelUpload = () => {
    setShowMd5Confirm(false);
    setFile(null);
    setLocalMD5('');
    setMd5Match(null);
    setRemoteMD5('');
    setUploadComplete(false);
    setRemoteProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (fileToUpload = null) => {
    const targetFile = fileToUpload || file;
    if (!targetFile) {
      toast.warning('请先选择文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await linuxAPI.uploadWAR(merchantId, targetFile, (progress) => {
        setUploadProgress(progress);
      });

      setTaskId(result.data?.task_id);

      if (result.data?.task_id) {
        pollUploadProgress(result.data.task_id);
      }
    } catch (error) {
      toast.error('上传失败：' + (error.response?.data?.message || error.message));
      setUploading(false);
    }
  };

  const pollUploadProgress = async (id) => {
    const interval = setInterval(async () => {
      try {
        const result = await linuxAPI.getUploadProgress(id);
        const progress = result.data;

        setRemoteProgress(progress);

        if (progress.status === 'completed') {
          clearInterval(interval);
          setUploading(false);
          setUploadComplete(true);
          toast.success('上传完成！');
        } else if (progress.status === 'failed') {
          clearInterval(interval);
          setUploading(false);
          toast.error('上传失败：' + (progress.error || '未知错误'));
        }
      } catch (error) {
        console.error('获取进度失败:', error);
      }
    }, 1000);
  };

  const handleVerifyMD5 = async () => {
    if (!file) {
      toast.warning('请先上传文件');
      return;
    }

    try {
      const remotePath = `/opt/tomcat7/webapps/${file.name}`;
      const result = await linuxAPI.getRemoteMD5(merchantId, remotePath);
      setRemoteMD5(result.data?.md5 || '');

      if (localMD5 && result.data?.md5) {
        if (localMD5 === result.data.md5) {
          toast.success('MD5 校验通过！文件完整');
        } else {
          toast.error('MD5 校验失败！文件可能损坏');
        }
      }
    } catch (error) {
      toast.error('获取远程 MD5 失败：' + (error.response?.data?.message || error.message));
    }
  };

  // Package upload handler
  const handlePackageFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setPackageFile(selectedFile);
    }
  };

  const handlePackageUpload = async () => {
    if (!packageFile) {
      toast.warning('请先选择升级包文件');
      return;
    }

    setPackageUploading(true);
    setPackageUploadProgress(0);

    try {
      const result = await linuxAPI.uploadUpgradePackage(merchantId, packageFile, (progress) => {
        setPackageUploadProgress(progress);
      });

      if (result.success) {
        toast.success('升级包上传成功！');
        // Refresh packages list
        loadUpgradePackages();
        // Auto-select the uploaded package
        if (result.data?.package_name) {
          setSelectedPackage(result.data.package_name);
        }
        setPackageFile(null);
      }
    } catch (error) {
      toast.error('上传失败：' + (error.response?.data?.message || error.message));
    } finally {
      setPackageUploading(false);
    }
  };

  // Execute upgrade using SSE
  const handleExecute = async () => {
    const { warPath, error } = resolveUpgradeWarPath({
      selectMode,
      upgradeMode,
      file,
      selectedPackage,
      selectedHistoryPackage,
      historyPackages,
    });

    if (error) {
      toast.warning(error);
      return;
    }

    // 确认对话框
    if (upgradeMode === 'direct') {
      if (!(await toast.confirm('确定要执行直接替换 WAR 升级吗？这将停止服务、替换 WAR 包并重启服务。', {
        title: '确认升级',
        variant: 'primary',
        confirmText: '开始升级',
      }))) {
        return;
      }
    } else {
      if (!selectedPackage) {
        toast.warning('请选择升级包');
        return;
      }
      if (!(await toast.confirm(`确定要使用升级包 ${selectedPackage} 执行升级吗？`, {
        title: '确认升级',
        variant: 'primary',
        confirmText: '开始升级',
      }))) {
        return;
      }
    }

    // 重置状态
    setExecuting(true);
    setExecuteProgress(0);
    setExecuteResult(null);
    setExecuteError('');
    setExecuteMessage('准备升级...');
    setUpgradeSteps(createUpgradeSteps(upgradeMode));
    setCurrentStepIndex(-1);

    try {
      // 创建升级任务
      setExecuteMessage('创建升级任务...');
      setExecuteProgress(5);

      const taskParams = {
        merchant_id: merchantId,
        type: upgradeMode,
        war_path: warPath,
        env: env,
        source_type: selectMode === 'local' ? 'local' : 'server',
      };

      if (upgradeMode === 'package') {
        taskParams.package_dir = `/home/menu/${selectedPackage}`;
      }

      const taskResult = await linuxAPI.startUpgradeTask(taskParams);

      if (!taskResult.success || !taskResult.data?.task_id) {
        throw new Error(taskResult.message || '创建升级任务失败');
      }

      const newTaskId = taskResult.data.task_id;
      setUpgradeTaskId(newTaskId);
      setExecuteMessage('升级任务已创建，正在执行...');

      // 使用 SSE 监听进度
      startSSEUpgrade(newTaskId);

      if (selectMode === 'local' && file) {
        updateUpgradeStep(1, 'running', '正在接收本地 WAR 文件...');
        setCurrentStepIndex(1);
        setExecuteMessage('正在接收本地 WAR 文件...');
        setExecuteProgress(10);

        await linuxAPI.uploadUpgradeTaskLocalFile(newTaskId, file, (progress) => {
          setExecuteProgress(10 + progress * 0.2);
          setUpgradeSteps((current) => current.map((step, stepIndex) => (
            stepIndex === 1
          ? { ...step, status: 'running', progress, message: `正在接收本地 WAR 文件... ${progress}%` }
              : step
          )));
        });
      }

    } catch (error) {
      setExecuteResult('error');
      setExecuteError(error.response?.data?.error || error.response?.data?.message || error.message);
      setExecuting(false);
    }
  };

  // SSE 监听升级进度
  const startSSEUpgrade = (taskId) => {
    const streamUrl = linuxAPI.getUpgradeStreamUrl(taskId);

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {};

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.progress !== undefined) {
          // 将升级进度映射到 50-100%
          const adjustedProgress = 50 + (data.progress * 0.5);
          setExecuteProgress(Math.min(adjustedProgress, 100));
        }
        if (data.message) {
          setExecuteMessage(data.message);
        }
        if (data.steps) {
          setUpgradeSteps(data.steps);
        }
        if (data.current_step !== undefined) {
          setCurrentStepIndex(data.current_step);
        }
      } catch (err) {
        console.error('[SSE] 解析进度数据失败:', err);
      }
    });

    eventSource.addEventListener('step', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.task) {
          if (data.task.steps) {
            setUpgradeSteps(data.task.steps);
          }
          if (data.task.current_step !== undefined) {
            setCurrentStepIndex(data.task.current_step);
          }
          if (data.task.progress !== undefined) {
            const adjustedProgress = 50 + (data.task.progress * 0.5);
            setExecuteProgress(Math.min(adjustedProgress, 100));
          }
          if (data.task.message) {
            setExecuteMessage(data.task.message);
          }
        }
      } catch (err) {
        console.error('[SSE] 解析步骤数据失败:', err);
      }
    });

    eventSource.addEventListener('completed', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.steps) {
          setUpgradeSteps(data.steps);
        }
      } catch (err) {}
      setExecuteProgress(100);
      setExecuteMessage('升级完成！');
      setExecuteResult('success');
      eventSource.close();
      setExecuting(false);
    });

    eventSource.addEventListener('error', (e) => {
      let errorMsg = '升级失败';
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          errorMsg = data.error || data.message || errorMsg;
          if (data.task?.steps) {
            setUpgradeSteps(data.task.steps);
          }
        }
      } catch (err) {}
      setExecuteResult('error');
      setExecuteError(errorMsg);
      eventSource.close();
      setExecuting(false);
    });

    eventSource.onerror = (err) => {
      console.error('[SSE] 连接错误:', err);
      // EventSource 的 onerror 会在连接失败时触发
      // 但如果是正常关闭（任务完成），不需要额外处理
      // 这里仅记录日志，具体错误由 'error' 事件处理
    };
  };

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 轮询上传完成状态
  const pollUploadCompletion = async (taskId) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const result = await linuxAPI.getUploadProgress(taskId);
          if (result.data?.status === 'completed') {
            clearInterval(interval);
            resolve();
          } else if (result.data?.status === 'failed') {
            clearInterval(interval);
            reject(new Error(result.data?.error || '上传失败'));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 500);
    });
  };

  // 关闭升级结果
  const handleCloseUpgradeResult = () => {
    setExecuting(false);
    setExecuteResult(null);
    setExecuteError('');
    setExecuteMessage('');
    setExecuteProgress(0);
    setUpgradeTaskId(null);
    setUpgradeSteps([]);
    setCurrentStepIndex(-1);
    // 关闭 SSE 连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const canExecute = () => canExecuteUpgrade({
    upgradeMode,
    selectMode,
    file,
    selectedHistoryPackage,
    downloadProgress,
    selectedPackage,
  });

  // Load upgrade packages when package mode is selected
  useEffect(() => {
    if (upgradeMode === 'package' && upgradePackages.length === 0) {
      loadUpgradePackages();
    }
  }, [upgradeMode]);


  return (
    <div style={styles.container}>
      <UpgradeExecutionOverlay
        styles={styles}
        executing={executing}
        executeResult={executeResult}
        executeProgress={executeProgress}
        upgradeSteps={upgradeSteps}
        currentStepIndex={currentStepIndex}
        executeMessage={executeMessage}
        executeError={executeError}
        handleCloseUpgradeResult={handleCloseUpgradeResult}
      />

      <UpgradeConfigStep
        styles={styles}
        env={env}
        setEnv={setEnv}
        configSectionExpanded={configSectionExpanded}
        setConfigSectionExpanded={setConfigSectionExpanded}
        isAdmin={isAdmin}
        setShowConfigModal={setShowConfigModal}
        selectedConfigs={selectedConfigs}
        handleExecuteConfigsOnly={handleExecuteConfigsOnly}
        executingConfigs={executingConfigs}
        configExecuteResults={configExecuteResults}
        setConfigExecuteResults={setConfigExecuteResults}
        loadingConfigs={loadingConfigs}
        configs={configs}
        handleSelectAllConfigs={handleSelectAllConfigs}
        handleSelectConfig={handleSelectConfig}
        expandedConfig={expandedConfig}
        setExpandedConfig={setExpandedConfig}
        handleToggleConfig={handleToggleConfig}
        setEditingConfig={setEditingConfig}
        handleDeleteConfig={handleDeleteConfig}
      />

      <UpgradeWarSelectionStep
        styles={styles}
        selectMode={selectMode}
        handleSelectMode={handleSelectMode}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        handleChooseLocalFile={handleChooseLocalFile}
        file={file}
        uploading={uploading}
        executing={executing}
        localMD5={localMD5}
        remoteMD5={remoteMD5}
        md5Comparing={md5Comparing}
        md5Match={md5Match}
        showMd5Confirm={showMd5Confirm}
        handleConfirmUpload={handleConfirmUpload}
        handleCancelUpload={handleCancelUpload}
        remoteProgress={remoteProgress}
        uploadProgress={uploadProgress}
        uploadComplete={uploadComplete}
        formatSize={formatSize}
        downloadUrl={downloadUrl}
        setDownloadUrl={setDownloadUrl}
        downloading={downloading}
        handleStartDownload={handleStartDownload}
        handleCancelDownload={handleCancelDownload}
        isAdmin={isAdmin}
        setShowDownloadConfig={setShowDownloadConfig}
        duplicateVersion={duplicateVersion}
        handleUseExisting={handleUseExisting}
        handleOverwriteDownload={handleOverwriteDownload}
        setDuplicateVersion={setDuplicateVersion}
        downloadProgress={downloadProgress}
        selectedHistoryPackage={selectedHistoryPackage}
        historyPackages={historyPackages}
        handleSelectHistoryPackage={handleSelectHistoryPackage}
        handleDeletePackage={handleDeletePackage}
      />

      <UpgradeModeStep
        styles={styles}
        upgradeMode={upgradeMode}
        setUpgradeMode={setUpgradeMode}
        packageFileInputRef={packageFileInputRef}
        handlePackageFileSelect={handlePackageFileSelect}
        packageFile={packageFile}
        handlePackageUpload={handlePackageUpload}
        packageUploading={packageUploading}
        packageUploadProgress={packageUploadProgress}
        loadUpgradePackages={loadUpgradePackages}
        loadingPackages={loadingPackages}
        upgradePackages={upgradePackages}
        selectedPackage={selectedPackage}
        setSelectedPackage={setSelectedPackage}
      />
      {/* Execute Button */}
      <div style={styles.executeSection}>
        <button
          onClick={handleExecute}
          disabled={!canExecute() || executing}
          style={{
            ...styles.executeBtn,
            ...(!canExecute() || executing ? styles.disabled : {}),
          }}
        >
          {executing ? '执行中...' : '开始执行'}
        </button>
      </div>

      {/* Modals */}
      <FileConfigModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setEditingConfig(null);
        }}
        config={editingConfig}
        onSave={() => {
          loadConfigs();
        }}
      />

      <DownloadConfigModal
        isOpen={showDownloadConfig}
        onClose={() => setShowDownloadConfig(false)}
      />

      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progressSlide {
          0% { left: -30%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};

const styles = {
  // Container
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // 全屏升级进度遮罩
  upgradeOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  upgradeModal: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px 48px',
    textAlign: 'center',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  upgradeSpinner: {
    width: '48px',
    height: '48px',
    margin: '0 auto 16px',
  },
  upgradeSpinnerRing: {
    width: '48px',
    height: '48px',
    border: '4px solid #E5E5EA',
    borderTop: '4px solid #007AFF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  upgradeTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '8px',
  },
  upgradeMessage: {
    fontSize: '14px',
    color: '#86868B',
    marginBottom: '24px',
  },
  upgradeProgressBar: {
    height: '6px',
    backgroundColor: '#E5E5EA',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '16px',
    position: 'relative',
  },
  upgradeProgressAnimated: {
    position: 'absolute',
    top: 0,
    left: '-30%',
    width: '30%',
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: '3px',
    animation: 'progressSlide 1.5s ease-in-out infinite',
  },
  upgradeWarning: {
    fontSize: '12px',
    color: '#FF9500',
    backgroundColor: '#FFF7E6',
    padding: '8px 12px',
    borderRadius: '4px',
  },
  upgradeSuccessIcon: {
    width: '64px',
    height: '64px',
    lineHeight: '64px',
    fontSize: '32px',
    color: '#fff',
    backgroundColor: '#34C759',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
  upgradeErrorIcon: {
    width: '64px',
    height: '64px',
    lineHeight: '64px',
    fontSize: '32px',
    color: '#fff',
    backgroundColor: '#FF3B30',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
  upgradeErrorBox: {
    fontSize: '13px',
    color: '#FF3B30',
    backgroundColor: '#FFF1F0',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    textAlign: 'left',
    wordBreak: 'break-word',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  upgradeConfirmBtn: {
    padding: '10px 48px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
    backgroundColor: '#007AFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  upgradeDoneHint: {
    fontSize: '13px',
    color: '#fff',
    backgroundColor: '#34C759',
    padding: '8px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontWeight: '500',
  },

  // SSE Upgrade Modal
  upgradeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  upgradeProgressText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#007AFF',
  },
  upgradeProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  upgradeStepsContainer: {
    textAlign: 'left',
    maxHeight: '280px',
    overflowY: 'auto',
    marginBottom: '16px',
    border: '1px solid #E5E5EA',
    borderRadius: '8px',
    padding: '12px',
  },
  upgradeStepItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    marginBottom: '8px',
    backgroundColor: '#F9F9F9',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  upgradeStepActive: {
    backgroundColor: '#E8F4FD',
    borderLeft: '3px solid #007AFF',
  },
  upgradeStepCompleted: {
    backgroundColor: '#F0F9F4',
  },
  upgradeStepFailed: {
    backgroundColor: '#FFF1F0',
    borderLeft: '3px solid #FF3B30',
  },
  upgradeStepIcon: {
    fontSize: '16px',
    marginRight: '12px',
    width: '24px',
    textAlign: 'center',
  },
  upgradeStepContent: {
    flex: 1,
    minWidth: 0,
  },
  upgradeStepName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  upgradeStepMessage: {
    fontSize: '12px',
    color: '#86868B',
    marginTop: '4px',
  },
  upgradeStepError: {
    fontSize: '12px',
    color: '#FF3B30',
    marginTop: '4px',
  },
  upgradeStepStatus: {
    fontSize: '12px',
    color: '#86868B',
    flexShrink: 0,
  },

  // Step Indicators
  stepIndicators: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 0',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  stepNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#E5E5EA',
    color: '#86868B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '500',
  },
  stepLabel: {
    fontSize: '12px',
    color: '#86868B',
  },
  stepConnector: {
    width: '24px',
    height: '1px',
    backgroundColor: '#E5E5EA',
    margin: '0 8px',
  },

  // Step Card
  stepCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
    padding: '16px',
  },
  stepCardHeader: {
    marginBottom: '12px',
  },
  stepCardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stepCardBadge: {
    fontSize: '12px',
    color: '#86868B',
  },
  stepCardTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  stepCardBody: {},

  // Environment Section
  envSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  envLabel: {
    fontSize: '13px',
    color: '#1D1D1F',
    fontWeight: '500',
  },
  envSelect: {
    padding: '6px 12px',
    border: '1px solid #D1D1D6',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
    minWidth: '160px',
  },

  // Config Section
  configSection: {
    marginTop: '12px',
  },
  configHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  configHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  configHeaderText: {
    fontSize: '13px',
    color: '#1D1D1F',
  },
  configHeaderRight: {},
  manageBtn: {
    padding: '4px 10px',
    backgroundColor: '#5856D6',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  expandIcon: {
    fontSize: '10px',
    color: '#86868B',
  },

  // Config Execute Bar
  configExecuteBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    backgroundColor: '#F2F2F7',
    borderRadius: '4px',
    marginTop: '8px',
    marginBottom: '8px',
  },
  configSelectInfo: {
    fontSize: '12px',
    color: '#86868B',
  },
  executeConfigBtn: {
    padding: '6px 14px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500',
  },

  // Config Results
  configResultsCard: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
  },
  configResultsHeader: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '8px',
  },
  configResultsList: {
    maxHeight: '120px',
    overflowY: 'auto',
    marginBottom: '8px',
  },
  configResultItem: {
    fontSize: '11px',
    padding: '4px 8px',
    marginBottom: '4px',
    borderRadius: '3px',
  },
  configResultSuccess: {
    backgroundColor: '#F0F9FF',
    color: '#0958D9',
  },
  configResultFailed: {
    backgroundColor: '#FFF1F0',
    color: '#CF1322',
  },
  closeResultsBtn: {
    padding: '4px 12px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    color: '#86868B',
  },

  // Config List
  configList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '8px',
  },
  configItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    backgroundColor: '#E5E5EA',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#86868B',
  },
  configItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    cursor: 'pointer',
  },
  configColName: {
    flex: '0 0 140px',
    fontSize: '12px',
    color: '#1D1D1F',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  configColPath: {
    flex: 1,
    fontSize: '11px',
    color: '#86868B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  configColStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
  },
  configColAction: {
    width: '140px',
    textAlign: 'center',
    fontSize: '11px',
  },
  configColActionBtns: {
    display: 'flex',
    gap: '4px',
    width: '140px',
    justifyContent: 'flex-start',
  },
  statusDot: (enabled) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: enabled ? '#34C759' : '#86868B',
  }),
  toggleBtn: {
    padding: '2px 8px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer',
    color: '#1D1D1F',
  },
  editBtn: {
    padding: '2px 8px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '2px 8px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  configDetail: {
    padding: '10px 12px',
    marginLeft: '40px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    marginTop: '4px',
    border: '1px solid #E5E5EA',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #F2F2F7',
    fontSize: '13px',
  },
  detailKey: {
    minWidth: '140px',
    flexShrink: 0,
    color: '#007AFF',
    fontWeight: '500',
    paddingRight: '12px',
  },
  detailValues: {
    display: 'flex',
    flexDirection: 'column', 
    flexWrap: 'wrap',
    gap: '12px 24px',
    flex: 1,
    minWidth: 0,
  },
  detailValueItem: {
    display: 'block',
    alignItems: 'baseline',
    gap: '6px',
    maxWidth: '100%',
  },
  detailEnvLabel: {
    color: '#86868B',
    fontSize: '12px',
    flexShrink: 0,
  },
  detailEnvValue: {
    color: '#1D1D1F',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },

  // Mode Selector
  modeSelector: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  modePill: {
    padding: '6px 14px',
    backgroundColor: '#fff',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#86868B',
    cursor: 'pointer',
  },
  modePillActive: {
    backgroundColor: '#007AFF',
    border: '1px solid #007AFF',
    color: '#fff',
  },

  // Mode Content
  modeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  // File Selection
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  selectFileBtn: {
    padding: '6px 14px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  outlineBtn: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    color: '#007AFF',
    border: '1px solid #007AFF',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  fileName: {
    color: '#1D1D1F',
  },
  fileSize: {
    color: '#86868B',
  },

  // MD5 Card
  md5Card: {
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
  },
  md5Header: {
    fontSize: '11px',
    color: '#86868B',
    marginBottom: '8px',
  },
  md5Row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '11px',
  },
  md5Label: {
    color: '#86868B',
    minWidth: '80px',
  },
  md5Code: {
    fontFamily: 'monospace',
    backgroundColor: '#F2F2F7',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
  },
  md5Loading: {
    color: '#86868B',
    fontStyle: 'italic',
  },
  md5NotFound: {
    color: '#86868B',
    fontStyle: 'italic',
  },
  md5Result: {
    marginTop: '8px',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  md5MatchWarning: {
    backgroundColor: '#FFF7E6',
    color: '#D48806',
  },
  md5NoMatchSuccess: {
    backgroundColor: '#F0F9FF',
    color: '#0958D9',
  },

  // Confirm Dialog
  confirmDialog: {
    padding: '12px',
    backgroundColor: '#FFF7E6',
    borderRadius: '6px',
    border: '1px solid #FFE58F',
    textAlign: 'center',
  },
  confirmDialogContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  confirmIcon: {
    fontSize: '24px',
  },
  confirmTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#D48806',
  },
  confirmText: {
    fontSize: '12px',
    color: '#874D00',
  },
  confirmButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  confirmPrimaryBtn: {
    padding: '6px 14px',
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  confirmCancelBtn: {
    padding: '6px 14px',
    backgroundColor: '#F2F2F7',
    color: '#1D1D1F',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // Progress Card
  progressCard: {
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '12px',
  },
  progressLabel: {
    color: '#1D1D1F',
  },
  progressValue: {
    fontWeight: '500',
    color: '#007AFF',
  },
  progressBar: {
    height: '4px',
    backgroundColor: '#E5E5EA',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  progressStats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '11px',
    color: '#86868B',
  },
  indeterminateBar: {
    height: '4px',
    borderRadius: '2px',
    background: 'repeating-linear-gradient(45deg, #007AFF, #007AFF 10px, #5AC8FA 10px, #5AC8FA 20px)',
    backgroundSize: '200% 100%',
  },

  // Success Card
  successCard: {
    padding: '8px 12px',
    backgroundColor: '#F0F9FF',
    borderRadius: '4px',
    color: '#0958D9',
    fontSize: '12px',
  },

  // Download Section
  downloadInputRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  downloadInput: {
    flex: 1,
    minWidth: '200px',
    padding: '6px 10px',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: '#fff',
  },
  downloadBtn: {
    padding: '6px 14px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  cancelDownloadBtn: {
    padding: '6px 12px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  configBtn: {
    padding: '6px 12px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#1D1D1F',
  },

  // Duplicate Dialog
  duplicateDialog: {
    padding: '12px',
    backgroundColor: '#FFF7E6',
    borderRadius: '6px',
    border: '1px solid #FFE58F',
    textAlign: 'center',
  },
  duplicateDialogContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  duplicateIcon: {
    fontSize: '24px',
  },
  duplicateTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#D48806',
  },
  duplicateText: {
    fontSize: '12px',
    color: '#874D00',
  },
  duplicateButtons: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  dangerBtn: {
    padding: '6px 12px',
    backgroundColor: '#FF3B30',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // History Section
  emptyHistory: {
    padding: '20px',
    textAlign: 'center',
    color: '#86868B',
    fontSize: '12px',
  },
  emptyIcon: {
    fontSize: '24px',
    marginBottom: '4px',
  },
  historyList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  historyItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
    cursor: 'pointer',
    gap: '6px',
  },
  historyItemSelected: {
    border: '1px solid #007AFF',
    backgroundColor: '#F0F7FF',
  },
  historyItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  historyItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  historyItemName: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#1D1D1F',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  historyItemMeta: {
    fontSize: '10px',
    color: '#86868B',
  },
  historyItemActions: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    padding: '2px 8px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '3px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  deleteActionBtn: {
    backgroundColor: '#FFF1F0',
    border: '1px solid #FFCCC7',
  },
  selectedPackageInfo: {
    padding: '6px 10px',
    backgroundColor: '#F0F7FF',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#007AFF',
  },

  // Info Card
  infoCard: {
    padding: '10px',
    backgroundColor: '#F2F2F7',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#1D1D1F',
    lineHeight: '1.6',
  },
  infoCardTitle: {
    fontWeight: '500',
    marginBottom: '6px',
  },
  infoCardList: {
    margin: 0,
    paddingLeft: '16px',
  },
  infoCardText: {
    margin: 0,
  },

  // Package Section
  packageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  uploadBtn: {
    padding: '6px 14px',
    backgroundColor: '#34C759',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  packageListSection: {
    marginTop: '12px',
  },
  packageListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  packageListTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  refreshBtn: {
    padding: '4px 10px',
    backgroundColor: '#F2F2F7',
    border: '1px solid #E5E5EA',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    color: '#1D1D1F',
  },
  loadingText: {
    textAlign: 'center',
    color: '#86868B',
    fontSize: '12px',
    padding: '16px',
  },
  packageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  packageItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #E5E5EA',
    cursor: 'pointer',
  },
  packageItemSelected: {
    border: '1px solid #007AFF',
    backgroundColor: '#F0F7FF',
  },
  packageInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  packageName: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#1D1D1F',
  },
  packageMeta: {
    fontSize: '10px',
    color: '#86868B',
  },

  // Execute Section
  executeSection: {
    padding: '12px',
    backgroundColor: '#F9F9F9',
    borderRadius: '8px',
    textAlign: 'center',
  },
  executeBtn: {
    padding: '10px 32px',
    backgroundColor: '#5856D6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default UpgradeTab;
