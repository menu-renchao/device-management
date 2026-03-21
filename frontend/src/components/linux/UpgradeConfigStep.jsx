import React from 'react';

const UpgradeConfigStep = ({
  styles,
  env,
  setEnv,
  configSectionExpanded,
  setConfigSectionExpanded,
  isAdmin,
  setShowConfigModal,
  selectedConfigs,
  handleExecuteConfigsOnly,
  executingConfigs,
  configExecuteResults,
  setConfigExecuteResults,
  loadingConfigs,
  configs,
  handleSelectAllConfigs,
  handleSelectConfig,
  expandedConfig,
  setExpandedConfig,
  handleToggleConfig,
  setEditingConfig,
  handleDeleteConfig,
}) => (
  <div style={styles.stepCard}>
    <div style={styles.stepCardHeader}>
      <div style={styles.stepCardTitleWrap}>
        <span style={styles.stepCardBadge}>步骤 1</span>
        <h4 style={styles.stepCardTitle}>环境与配置</h4>
      </div>
    </div>
    <div style={styles.stepCardBody}>
      <div style={styles.envSection}>
        <span style={styles.envLabel}>目标环境</span>
        <select
          value={env}
          onChange={(e) => setEnv(e.target.value)}
          style={styles.envSelect}
        >
          <option value="QA">QA (测试环境)</option>
          <option value="PROD">PROD (生产环境)</option>
          <option value="DEV">DEV (开发环境)</option>
        </select>
      </div>

      <div style={styles.configSection}>
        <div
          style={styles.configHeader}
          onClick={() => setConfigSectionExpanded(!configSectionExpanded)}
        >
          <div style={styles.configHeaderLeft}>
            <span style={styles.expandIcon}>{configSectionExpanded ? '▼' : '▶'}</span>
            <span style={styles.configHeaderText}>文件配置（默认执行启用配置，一般无需修改，可单独执行）</span>
          </div>
          <div style={styles.configHeaderRight} onClick={(e) => e.stopPropagation()}>
            {isAdmin() && (
              <button
                onClick={() => setShowConfigModal(true)}
                style={styles.manageBtn}
              >
                新增配置
              </button>
            )}
          </div>
        </div>

        {configSectionExpanded && (
          <div style={styles.configExecuteBar}>
            <span style={styles.configSelectInfo}>
              已选择 {selectedConfigs.length} 个配置
            </span>
            <button
              onClick={handleExecuteConfigsOnly}
              disabled={executingConfigs || selectedConfigs.length === 0}
              style={{
                ...styles.executeConfigBtn,
                ...(executingConfigs || selectedConfigs.length === 0 ? styles.disabled : {}),
              }}
            >
              {executingConfigs ? '执行中...' : '单独执行配置修改'}
            </button>
          </div>
        )}

        {configExecuteResults && (
          <div style={styles.configResultsCard}>
            <div style={styles.configResultsHeader}>
              执行结果：{configExecuteResults.success || 0} 成功，{configExecuteResults.failed || 0} 失败
            </div>
            {configExecuteResults.results && configExecuteResults.results.length > 0 && (
              <div style={styles.configResultsList}>
                {configExecuteResults.results.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...styles.configResultItem,
                      ...(result.startsWith('[失败]') ? styles.configResultFailed : styles.configResultSuccess),
                    }}
                  >
                    {result}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setConfigExecuteResults(null)}
              style={styles.closeResultsBtn}
            >
              关闭
            </button>
          </div>
        )}

        {configSectionExpanded && (
          <>
            {loadingConfigs ? (
              <div style={styles.loadingText}>加载中...</div>
            ) : configs.length === 0 ? (
              <div style={styles.emptyText}>暂无配置，请先添加配置</div>
            ) : (
              <div style={styles.configList}>
                <div style={styles.configItemHeader}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedConfigs.length === configs.filter((c) => c.enabled).length && configs.filter((c) => c.enabled).length > 0}
                      onChange={(e) => handleSelectAllConfigs(e.target.checked)}
                    />
                    全选
                  </label>
                  <span style={{ ...styles.configColName, flex: '1 1 0' }}>配置名称</span>
                  <span style={{ ...styles.configColPath, flex: '2 1 0' }}>文件路径</span>
                  <span style={{ ...styles.configColStatus, flex: '1 1 0' }}>状态</span>
                  <span style={styles.configColAction}>操作</span>
                </div>
                {configs.map((config) => (
                  <div key={config.id}>
                    <div style={styles.configItem}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedConfigs.includes(config.id)}
                          onChange={(e) => handleSelectConfig(config.id, e.target.checked)}
                          disabled={!config.enabled}
                        />
                      </label>
                      <span
                        style={{ ...styles.configColName, flex: '1 1 0' }}
                        onClick={() => setExpandedConfig(expandedConfig === config.id ? null : config.id)}
                      >
                        <span style={styles.expandIcon}>{expandedConfig === config.id ? '▼' : '▶'}</span>
                        {config.name}
                      </span>
                      <span style={{ ...styles.configColPath, flex: '2 1 0' }}>{config.file_path}</span>
                      <span
                        style={{
                          ...styles.configColStatus,
                          flex: '1 1 0',
                          color: config.enabled ? '#34C759' : '#86868B',
                        }}
                      >
                        <span style={styles.statusDot(config.enabled)}></span>
                        {config.enabled ? '启用' : '禁用'}
                      </span>
                      <div style={styles.configColActionBtns}>
                        {isAdmin() && (
                          <>
                            <button
                              onClick={() => handleToggleConfig(config.id, !config.enabled)}
                              style={styles.toggleBtn}
                            >
                              {config.enabled ? '禁用' : '启用'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingConfig(config);
                                setShowConfigModal(true);
                              }}
                              style={styles.editBtn}
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteConfig(config.id)}
                              style={styles.deleteBtn}
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {expandedConfig === config.id && (
                      <div style={styles.configDetail}>
                        {config.key_values && config.key_values.map((kv, idx) => (
                          <div key={idx} style={styles.detailRow}>
                            <span style={styles.detailKey}>{kv.key}</span>
                            <span style={styles.detailValues}>
                              <span style={styles.detailValueItem}>
                                <span style={styles.detailEnvLabel}>QA:</span>
                                <span style={styles.detailEnvValue}>{kv.qa_value || '-'}</span>
                              </span>
                              <span style={styles.detailValueItem}>
                                <span style={styles.detailEnvLabel}>PROD:</span>
                                <span style={styles.detailEnvValue}>{kv.prod_value || '-'}</span>
                              </span>
                              <span style={styles.detailValueItem}>
                                <span style={styles.detailEnvLabel}>DEV:</span>
                                <span style={styles.detailEnvValue}>{kv.dev_value || '-'}</span>
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

export default UpgradeConfigStep;
