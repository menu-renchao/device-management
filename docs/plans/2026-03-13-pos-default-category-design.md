# POS Default Category Design

**Problem**

POS 页面当前把没有 `device_properties` 记录的设备显示成 `PC`，但筛选查询仍然只匹配 `device_properties.property`。这导致默认 PC 设备在列表里看起来属于 `PC`，筛选时却永远命不中。

**Decision**

采用“显式且完整”的分类元数据设计：`device_properties` 不再用“缺失记录”表达默认分类，默认 `PC` 也要成为明确的分类值。

**Design**

- 保留 `device_properties` 作为 POS 设备分类元数据表，不把人工维护分类并入 `scan_results`。
- 为现有缺少记录的 POS 设备补齐 `device_properties(property='PC')`。
- 历史数据补齐通过独立 SQL 执行，不在运行时业务代码中做回填。
- 为后续查询增加统一的默认分类语义，确保即使遇到历史脏数据，列表展示和分类筛选都把缺失值视为 `PC`。
- 让筛选选项包含 `PC`，避免“列表里有默认分类，但筛选器里没有”。

**Why This Approach**

- 分类语义明确，不再依赖“没有数据”。
- 保持扫描结果和人工维护元数据分层，后续扩展风险小。
- 对现有前端影响最小，能够一次性修复展示、筛选和数据一致性问题。

**Verification**

- 仓库层回归测试覆盖“无 `device_properties` 记录时按 `PC` 能筛中”。
- 仓库层回归测试覆盖“筛选选项包含 `PC`”。
- 需要确认已有显式分类设备仍按原分类命中，不被默认值覆盖。
