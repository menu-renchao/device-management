import React from 'react';

const UpgradeExecutionOverlay = ({
  styles,
  executing,
  executeResult,
  executeProgress,
  upgradeSteps,
  currentStepIndex,
  executeMessage,
  executeError,
  handleCloseUpgradeResult,
}) => {
  if (!executing && executeResult === null) {
    return null;
  }

  return (
    <div style={styles.upgradeOverlay}>
      <div style={styles.upgradeModal}>
        {executeResult === null ? (
          <>
            <div style={styles.upgradeHeader}>
              <div style={styles.upgradeTitle}>正在升级</div>
              <div style={styles.upgradeProgressText}>{Math.round(executeProgress)}%</div>
            </div>

            <div style={styles.upgradeProgressBar}>
              <div
                style={{
                  ...styles.upgradeProgressFill,
                  width: `${executeProgress}%`,
                }}
              ></div>
            </div>

            {upgradeSteps.length > 0 && (
              <div style={styles.upgradeStepsContainer}>
                {upgradeSteps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.upgradeStepItem,
                      ...(index === currentStepIndex ? styles.upgradeStepActive : {}),
                      ...(step.status === 'completed' ? styles.upgradeStepCompleted : {}),
                      ...(step.status === 'failed' ? styles.upgradeStepFailed : {}),
                    }}
                  >
                    <div style={styles.upgradeStepIcon}>
                      {step.status === 'completed' && '✅'}
                      {step.status === 'running' && '🔄'}
                      {step.status === 'failed' && '❌'}
                      {step.status === 'pending' && '⏳'}
                    </div>
                    <div style={styles.upgradeStepContent}>
                      <div style={styles.upgradeStepName}>{step.name}</div>
                      {step.status === 'running' && step.message && (
                        <div style={styles.upgradeStepMessage}>{step.message}</div>
                      )}
                      {step.status === 'failed' && step.message && (
                        <div style={styles.upgradeStepError}>{step.message}</div>
                      )}
                    </div>
                    <div style={styles.upgradeStepStatus}>
                      {step.status === 'completed' && '完成'}
                      {step.status === 'running' && '进行中...'}
                      {step.status === 'failed' && '失败'}
                      {step.status === 'pending' && '等待中'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.upgradeMessage}>{executeMessage}</div>

            <div style={styles.upgradeWarning}>
              ⚠️ 请勿关闭页面或刷新，否则可能导致升级失败
            </div>
          </>
        ) : executeResult === 'success' ? (
          <>
            <div style={styles.upgradeSuccessIcon}>✅</div>
            <div style={{ ...styles.upgradeTitle, color: '#34C759' }}>升级成功</div>
            <div style={styles.upgradeMessage}>设备已成功完成升级</div>
            <div style={styles.upgradeDoneHint}>
              请确认设备已正常启动后，再点击关闭
            </div>
            <button onClick={handleCloseUpgradeResult} style={styles.upgradeConfirmBtn}>
              关闭
            </button>
          </>
        ) : (
          <>
            <div style={styles.upgradeErrorIcon}>✕</div>
            <div style={{ ...styles.upgradeTitle, color: '#FF3B30' }}>升级失败</div>
            <div style={styles.upgradeErrorBox}>{executeError}</div>
            <button onClick={handleCloseUpgradeResult} style={styles.upgradeConfirmBtn}>
              关闭
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpgradeExecutionOverlay;
