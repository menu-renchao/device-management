import React from 'react';
import { linuxAPI } from '../../services/api';

const UpgradeWarSelectionStep = ({
  styles,
  selectMode,
  handleSelectMode,
  fileInputRef,
  handleFileSelect,
  handleChooseLocalFile,
  file,
  uploading,
  executing,
  localMD5,
  remoteMD5,
  md5Comparing,
  md5Match,
  showMd5Confirm,
  handleConfirmUpload,
  handleCancelUpload,
  remoteProgress,
  uploadProgress,
  uploadComplete,
  formatSize,
  downloadUrl,
  setDownloadUrl,
  downloading,
  handleStartDownload,
  handleCancelDownload,
  isAdmin,
  setShowDownloadConfig,
  duplicateVersion,
  handleUseExisting,
  handleOverwriteDownload,
  setDuplicateVersion,
  downloadProgress,
  selectedHistoryPackage,
  historyPackages,
  handleSelectHistoryPackage,
  handleDeletePackage,
}) => (
  <div style={styles.stepCard}>
    <div style={styles.stepCardHeader}>
      <div style={styles.stepCardTitleWrap}>
        <span style={styles.stepCardBadge}>步骤 2</span>
        <h4 style={styles.stepCardTitle}>选择 WAR 包</h4>
      </div>
    </div>
    <div style={styles.stepCardBody}>
      <div style={styles.modeSelector}>
        <button
          style={{
            ...styles.modePill,
            ...(selectMode === 'local' ? styles.modePillActive : {}),
          }}
          onClick={() => handleSelectMode('local')}
        >
          本地上传
        </button>
        <button
          style={{
            ...styles.modePill,
            ...(selectMode === 'download' ? styles.modePillActive : {}),
          }}
          onClick={() => handleSelectMode('download')}
        >
          网络下载
        </button>
        <button
          style={{
            ...styles.modePill,
            ...(selectMode === 'history' ? styles.modePillActive : {}),
          }}
          onClick={() => handleSelectMode('history')}
        >
          历史版本
        </button>
      </div>

      {selectMode === 'local' && (
        <div style={styles.modeContent}>
          <div style={styles.fileRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".war"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={handleChooseLocalFile}
              style={styles.outlineBtn}
              disabled={uploading}
            >
              选择文件
            </button>
            {file && (
              <div style={styles.fileInfo}>
                <span style={styles.fileName}>{file.name}</span>
                <span style={styles.fileSize}>{formatSize(file.size)}</span>
              </div>
            )}
          </div>

          {(localMD5 || md5Comparing) && (
            <div style={styles.md5Card}>
              <div style={styles.md5Header}>MD5 校验比对</div>
              <div style={styles.md5Row}>
                <span style={styles.md5Label}>本地文件</span>
                <code style={styles.md5Code}>{localMD5 || '计算中...'}</code>
              </div>
              <div style={styles.md5Row}>
                <span style={styles.md5Label}>远程 kpos.war</span>
                {md5Comparing ? (
                  <span style={styles.md5Loading}>比对中...</span>
                ) : remoteMD5 ? (
                  <code
                    style={{
                      ...styles.md5Code,
                      color: md5Match ? '#FF9500' : '#34C759',
                    }}
                  >
                    {remoteMD5}
                  </code>
                ) : (
                  <span style={styles.md5NotFound}>远程文件不存在</span>
                )}
              </div>
              {md5Match !== null && (
                <div
                  style={{
                    ...styles.md5Result,
                    ...(md5Match ? styles.md5MatchWarning : styles.md5NoMatchSuccess),
                  }}
                >
                  {md5Match ? (
                    <>⚠️ MD5 匹配！目标设备上已存在相同的 WAR 包</>
                  ) : (
                    <>✓ MD5 不匹配，这是一个新版本的 WAR 包</>
                  )}
                </div>
              )}
            </div>
          )}

          {showMd5Confirm && md5Match && (
            <div style={styles.confirmDialog}>
              <div style={styles.confirmDialogContent}>
                <div style={styles.confirmIcon}>⚠️</div>
                <div style={styles.confirmTitle}>MD5 匹配提示</div>
                <div style={styles.confirmText}>
                  检测到目标设备上已存在相同的 WAR 包（MD5 匹配）。
                  如需更新，请点击“开始执行”。
                </div>
                <div style={styles.confirmButtons}>
                  <button onClick={handleConfirmUpload} style={styles.confirmPrimaryBtn}>
                    知道了
                  </button>
                  <button onClick={handleCancelUpload} style={styles.confirmCancelBtn}>
                    重新选择
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploading && !executing && (
            <div style={styles.progressCard}>
              <div style={styles.progressHeader}>
                <span style={styles.progressLabel}>
                  {remoteProgress ? '远程写入进度' : '上传进度'}
                </span>
                <span style={styles.progressValue}>
                  {remoteProgress
                    ? `${remoteProgress.percentage?.toFixed(1) || 0}%`
                    : `${uploadProgress}%`}
                </span>
              </div>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: remoteProgress
                      ? `${remoteProgress.percentage || 0}%`
                      : `${uploadProgress}%`,
                  }}
                />
              </div>
              {remoteProgress && (
                <div style={styles.progressStats}>
                  <span>{formatSize(remoteProgress.transferred || 0)} / {formatSize(remoteProgress.total_size || 0)}</span>
                </div>
              )}
              {!remoteProgress && uploadProgress === 100 && (
                <div style={styles.progressStats}>
                  <span>正在连接远程服务器...</span>
                </div>
              )}
            </div>
          )}

          {uploadComplete && file && !executing && (
            <div style={styles.successCard}>
              <span>✓ 上传完成</span>
            </div>
          )}
        </div>
      )}

      {selectMode === 'download' && (
        <div style={styles.modeContent}>
          <div style={styles.downloadInputRow}>
            <input
              type="text"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="输入 TeamCity 或其他下载 URL..."
              style={styles.downloadInput}
            />
            <button
              onClick={() => handleStartDownload()}
              disabled={downloading || !downloadUrl.trim()}
              style={{
                ...styles.downloadBtn,
                ...((downloading || !downloadUrl.trim()) ? styles.disabled : {}),
              }}
            >
              {downloading ? '下载中...' : '开始下载'}
            </button>
            {downloading && (
              <button onClick={handleCancelDownload} style={styles.cancelDownloadBtn}>
                取消
              </button>
            )}
            {isAdmin() && (
              <button onClick={() => setShowDownloadConfig(true)} style={styles.configBtn}>
                配置
              </button>
            )}
          </div>

          {duplicateVersion && (
            <div style={styles.duplicateDialog}>
              <div style={styles.duplicateDialogContent}>
                <div style={styles.duplicateIcon}>⚠️</div>
                <div style={styles.duplicateTitle}>版本已存在</div>
                <div style={styles.duplicateText}>
                  版本 <strong>{duplicateVersion.version}</strong> 已存在于历史记录中。
                </div>
                <div style={styles.duplicateButtons}>
                  <button onClick={handleUseExisting} style={styles.confirmPrimaryBtn}>
                    使用已有版本
                  </button>
                  <button onClick={handleOverwriteDownload} style={styles.dangerBtn}>
                    覆盖重新下载
                  </button>
                  <button onClick={() => setDuplicateVersion(null)} style={styles.confirmCancelBtn}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {downloading && downloadProgress && (
            <div style={styles.progressCard}>
              <div style={styles.progressHeader}>
                <span style={styles.progressLabel}>
                  下载进度 - {downloadProgress.name || '获取中...'}
                </span>
                {downloadProgress.total > 0 && (
                  <span style={styles.progressValue}>{downloadProgress.percentage?.toFixed(1)}%</span>
                )}
              </div>
              {downloadProgress.total > 0 ? (
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${downloadProgress.percentage || 0}%` }} />
                </div>
              ) : (
                <div style={styles.indeterminateBar} />
              )}
              <div style={styles.progressStats}>
                <span>
                  {formatSize(downloadProgress.downloaded || 0)}
                  {downloadProgress.total > 0 && ` / ${formatSize(downloadProgress.total)}`}
                </span>
                <span>{downloadProgress.speed || ''}</span>
              </div>
            </div>
          )}

          {!downloading && selectedHistoryPackage && (localMD5 || md5Comparing || remoteMD5) && (
            <div style={styles.md5Card}>
              <div style={styles.md5Header}>MD5 校验比对</div>
              <div style={styles.md5Row}>
                <span style={styles.md5Label}>下载包</span>
                <code style={styles.md5Code}>{localMD5 || '获取中...'}</code>
              </div>
              <div style={styles.md5Row}>
                <span style={styles.md5Label}>远程 kpos.war</span>
                {md5Comparing ? (
                  <span style={styles.md5Loading}>比对中...</span>
                ) : remoteMD5 ? (
                  <code style={{ ...styles.md5Code, color: md5Match ? '#FF9500' : '#34C759' }}>
                    {remoteMD5}
                  </code>
                ) : (
                  <span style={styles.md5NotFound}>远程文件不存在</span>
                )}
              </div>
              {md5Match !== null && (
                <div style={{ ...styles.md5Result, ...(md5Match ? styles.md5MatchWarning : styles.md5NoMatchSuccess) }}>
                  {md5Match ? <>⚠️ MD5 匹配！</> : <>✓ 新版本</>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectMode === 'history' && (
        <div style={styles.modeContent}>
          {historyPackages.length === 0 ? (
            <div style={styles.emptyHistory}>暂无历史下载的包</div>
          ) : (
            <>
              <div style={styles.historyList}>
                {historyPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    style={{
                      ...styles.historyItem,
                      ...(selectedHistoryPackage === pkg.name ? styles.historyItemSelected : {}),
                    }}
                    onClick={() => handleSelectHistoryPackage(pkg)}
                  >
                    <div style={styles.historyItemLeft}>
                      <input
                        type="radio"
                        name="historyPackage"
                        checked={selectedHistoryPackage === pkg.name}
                        onChange={() => handleSelectHistoryPackage(pkg)}
                      />
                      <div style={styles.historyItemInfo}>
                        <span style={styles.historyItemName}>{pkg.name}</span>
                        <span style={styles.historyItemMeta}>{formatSize(pkg.size)}</span>
                      </div>
                    </div>
                    <div style={styles.historyItemActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(linuxAPI.downloadWarPackageUrl(pkg.name), '_blank');
                        }}
                        style={styles.actionBtn}
                        title="下载到本地"
                      >
                        下载
                      </button>
                      {isAdmin() && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePackage(pkg.name);
                          }}
                          style={{ ...styles.actionBtn, ...styles.deleteActionBtn }}
                          title="删除"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {selectedHistoryPackage && (
                <div style={styles.selectedPackageInfo}>
                  已选择: <strong>{selectedHistoryPackage}</strong>
                </div>
              )}
              {selectedHistoryPackage && (localMD5 || md5Comparing || remoteMD5) && (
                <div style={styles.md5Card}>
                  <div style={styles.md5Header}>MD5 校验比对</div>
                  <div style={styles.md5Row}>
                    <span style={styles.md5Label}>选中包</span>
                    <code style={styles.md5Code}>{localMD5 || '获取中...'}</code>
                  </div>
                  <div style={styles.md5Row}>
                    <span style={styles.md5Label}>远程 kpos.war</span>
                    {md5Comparing ? (
                      <span style={styles.md5Loading}>比对中...</span>
                    ) : remoteMD5 ? (
                      <code style={{ ...styles.md5Code, color: md5Match ? '#FF9500' : '#34C759' }}>
                        {remoteMD5}
                      </code>
                    ) : (
                      <span style={styles.md5NotFound}>远程文件不存在</span>
                    )}
                  </div>
                  {md5Match !== null && (
                    <div style={{ ...styles.md5Result, ...(md5Match ? styles.md5MatchWarning : styles.md5NoMatchSuccess) }}>
                      {md5Match ? <>⚠️ MD5 匹配！</> : <>✓ 新版本</>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  </div>
);

export default UpgradeWarSelectionStep;
