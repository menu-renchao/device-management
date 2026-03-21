import React from 'react';

const UpgradeModeStep = ({
  styles,
  upgradeMode,
  setUpgradeMode,
  packageFileInputRef,
  handlePackageFileSelect,
  packageFile,
  handlePackageUpload,
  packageUploading,
  packageUploadProgress,
  loadUpgradePackages,
  loadingPackages,
  upgradePackages,
  selectedPackage,
  setSelectedPackage,
}) => (
  <div style={styles.stepCard}>
    <div style={styles.stepCardHeader}>
      <div style={styles.stepCardTitleWrap}>
        <span style={styles.stepCardBadge}>步骤 3</span>
        <h4 style={styles.stepCardTitle}>选择升级模式</h4>
      </div>
    </div>
    <div style={styles.stepCardBody}>
      <div style={styles.modeSelector}>
        <button
          style={{
            ...styles.modePill,
            ...(upgradeMode === 'direct' ? styles.modePillActive : {}),
          }}
          onClick={() => setUpgradeMode('direct')}
        >
          直接替换 WAR
        </button>
        <button
          style={{
            ...styles.modePill,
            ...(upgradeMode === 'package' ? styles.modePillActive : {}),
          }}
          onClick={() => setUpgradeMode('package')}
        >
          升级包升级
        </button>
      </div>

      {upgradeMode === 'direct' && (
        <div style={styles.modeContent}>
          <div style={styles.infoCard}>
            <div style={styles.infoCardTitle}>直接替换 WAR 模式将执行以下操作：</div>
            <ol style={styles.infoCardList}>
              <li>停止 POS 服务</li>
              <li>替换 /opt/tomcat7/webapps/kpos.war</li>
              <li>执行配置修改（如果启用了配置）</li>
              <li>重启 POS 服务</li>
            </ol>
          </div>
        </div>
      )}

      {upgradeMode === 'package' && (
        <div style={styles.modeContent}>
          <div style={styles.infoCard}>
            升级包升级模式将使用远程服务器上的升级包目录，执行其中的 update.sh 脚本进行升级。
          </div>

          <div style={styles.packageActions}>
            <input
              ref={packageFileInputRef}
              type="file"
              accept=".zip"
              onChange={handlePackageFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => packageFileInputRef.current?.click()}
              style={styles.outlineBtn}
            >
              上传升级包
            </button>
            {packageFile && (
              <>
                <span style={styles.fileName}>{packageFile.name}</span>
                <button
                  onClick={handlePackageUpload}
                  disabled={packageUploading}
                  style={{
                    ...styles.uploadBtn,
                    ...(packageUploading ? styles.disabled : {}),
                  }}
                >
                  {packageUploading ? `上传中 ${packageUploadProgress}%` : '上传'}
                </button>
              </>
            )}
          </div>

          {packageUploading && (
            <div style={styles.progressCard}>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${packageUploadProgress}%` }} />
              </div>
            </div>
          )}

          <div style={styles.packageListSection}>
            <div style={styles.packageListHeader}>
              <span style={styles.packageListTitle}>选择升级包</span>
              <button
                onClick={loadUpgradePackages}
                disabled={loadingPackages}
                style={styles.refreshBtn}
              >
                {loadingPackages ? '刷新中...' : '刷新'}
              </button>
            </div>

            {loadingPackages ? (
              <div style={styles.loadingText}>扫描中...</div>
            ) : upgradePackages.filter((pkg) => pkg.has_update_sh).length === 0 ? (
              <div style={styles.emptyHistory}>未找到升级包，请先上传</div>
            ) : (
              <div style={styles.historyList}>
                {upgradePackages.filter((pkg) => pkg.has_update_sh).map((pkg) => (
                  <div
                    key={pkg.name}
                    style={{
                      ...styles.historyItem,
                      ...(selectedPackage === pkg.name ? styles.historyItemSelected : {}),
                    }}
                    onClick={() => setSelectedPackage(pkg.name)}
                  >
                    <div style={styles.historyItemLeft}>
                      <input
                        type="radio"
                        name="upgradePackage"
                        checked={selectedPackage === pkg.name}
                        onChange={() => setSelectedPackage(pkg.name)}
                      />
                      <div style={styles.historyItemInfo}>
                        <span style={styles.historyItemName}>{pkg.name}</span>
                        <span style={styles.historyItemMeta}>
                          {pkg.mod_time}
                          {pkg.has_update_sh ? '' : ' | 无 update.sh'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default UpgradeModeStep;
