# POS 菜单域全量覆盖导入导出设计

## 1. 背景

当前仓库已经具备以下能力：

- 设备维度的 License 备份/恢复
- 整库数据库备份/恢复
- 跨 MID 的整库备份恢复
- Linux 设备远程管理

现有能力主要围绕“整库 SQL 文件”展开，后端通过命令行调用 `mysqldump` / `mysql` 生成和恢复 `.sql` 文件，前端统一挂载在“数据备份/恢复”弹窗中。

但原始 Windows 桌面工具里的“菜单导入/菜单导出”并不是普通整库备份恢复，而是一个独立业务域：

- 菜单导出：导出菜单域的完整快照
- 菜单导入：对目标设备执行菜单域全量覆盖
- 导入前清空目标设备菜单域数据
- 导入后执行若干固定修复步骤
- 不触碰 License、订单、客户、员工等非菜单域数据

本次设计目标是将该能力重构进当前 web 项目，并明确与“整库备份恢复”分离。

---

## 2. 需求定义

### 2.1 核心语义

菜单导入不是增量合并，不是 patch，不是普通 SQL 恢复。

菜单导入的准确定义是：

- 针对“菜单域”执行全量覆盖
- 目标设备当前菜单域数据全部被来源菜单包替换
- 非菜单域数据保持不动
- 导入后执行固定修复与一致性校验

### 2.2 菜单域边界

菜单域不是整个 `kpos` 库，而是与菜单结构、菜单显示、菜单依赖直接相关的一组表。

根据反编译桌面工具和现有业务，第一版菜单域定义建议如下：

- `menu`
- `menu_group`
- `menu_category`
- `menu_item`
- `menu_item_info`
- `menu_item_recipe`
- `item_size`
- `item_unit`
- `item_property`
- `combo_section`
- `combo_section_item_assoc`
- `combo_item_section_assoc`
- `sale_item_price`
- `saleitem_rule_assoc`
- `saleitem_property_assoc`
- `pricing_rule`
- `course`
- `restaurant_hours`
- `menugroup_hours_assoc`
- `category_tax_assoc`
- `company_tax`
- `printer`
- `item_printer_assoc`
- `system_language`
- `membership_level`
- `field_display_name` 中菜单相关类型记录

`field_display_name` 只属于部分菜单域，不能整表覆盖。只允许处理以下 `field_type`：

- `MENU_GROUP`
- `CATEGORY`
- `SALE_ITEM`
- `COMBO_SECTION`
- `MODIFIER_ACTION`
- `GLOBAL_OPTION_CATEGORY`
- `GLOBAL_OPTION`
- `ITEM_SIZE`
- `MENU`
- `ITEM_OPTION`

### 2.3 非目标范围

本次明确不包含：

- License 备份/导入逻辑重构
- 整库数据库备份恢复能力下线
- WAR 上传、Tomcat 重启、SSH 连接管理变更
- 菜单增量同步
- 菜单差异对比 UI
- 任意 SQL 文件导入到菜单模块

---

## 3. 现状与问题

## 3.1 现有项目实现现状

当前后端在 [db_backup_service.go](/D:/menusifu/device_management/backend-go/internal/services/db_backup_service.go) 中通过外部命令实现整库导入导出：

- `mysqldump` 生成 SQL
- `mysql` 读取 SQL 恢复

当前前端在 [DBBackupRestoreModal.jsx](/D:/menusifu/device_management/frontend/src/components/db-backup/DBBackupRestoreModal.jsx) 中已支持：

- 当前 MID 备份
- 当前 MID 备份恢复
- 本地 `.sql` 恢复
- 跨 MID 整库恢复

这套能力是“整库运维能力”，不是“菜单域业务能力”。

## 3.2 原桌面工具的主要问题

原桌面工具可反编译，确认它存在以下设计缺陷：

1. 菜单导入/普通 SQL 导入混在同一窗体，边界不清。
2. 加密、gzip、临时文件、远程上传 `menusifu.gz` 的链路复杂且没有业务价值。
3. 对 `.sql` 的“解密/再压缩/再加密”属于历史包袱，不适合 web 服务。
4. 大量数据库密码、SSH 密码硬编码。
5. 菜单导入后的修复逻辑散落在按钮事件中，无法复用、不可审计。
6. 本地与远程两套逻辑不一致。
7. 命令行恢复是黑盒执行，失败原因与执行进度不可结构化追踪。

## 3.3 现有 web 项目继续沿用整库思路的问题

如果把菜单导入导出继续做成“又一组 SQL 文件备份恢复”，会产生以下问题：

1. 菜单模块和整库恢复语义继续混淆。
2. 用户无法明确知道“覆盖的是菜单域还是整个库”。
3. 系统无法阻止误把普通 SQL 文件当成菜单包导入。
4. 无法在导入前做菜单包结构校验、版本校验、MID 校验。
5. 无法把导入步骤拆成可审计任务。
6. 无法细粒度控制导入前清理与导入后修复。

---

## 4. 方案对比

## 4.1 方案 A：继续沿用 `mysqldump/mysql`，单独加一个“菜单 SQL 包”

做法：

- 菜单导出仍输出 `.sql`
- 菜单导入仍执行 `mysql < file.sql`
- 仅在前后端加一些菜单专属入口

优点：

- 开发成本最低
- 与现有整库备份服务复用高

缺点：

- 本质仍是黑盒 SQL 恢复
- 难以保证只处理菜单域
- 难以做到强校验
- 失败后的可诊断性差
- 会继续把“菜单业务能力”做成“运维工具能力”

结论：

- 不推荐作为目标方案
- 最多只适合作为临时过渡

## 4.2 方案 B：菜单域结构化导出包 + 服务端直连数据库执行全量覆盖

做法：

- 菜单导出不再生成任意 SQL 文件
- 服务端直连 MySQL，按白名单表读取数据
- 生成一个结构化菜单包
- 菜单导入时先校验菜单包，再按固定顺序全量清理与重建
- 导入后执行固定修复与校验

优点：

- 业务边界最清晰
- 可以强约束只处理菜单域
- 可以做版本和数据结构校验
- 每一步有明确日志与错误信息
- 易于审计、测试和后续演进

缺点：

- 实现成本高于直接 SQL 恢复
- 需要定义菜单包格式和导入顺序

结论：

- 推荐方案
- 这是本次设计采用的目标方案

## 4.3 方案 C：仍导出 SQL，但由应用层解析 SQL 再执行

做法：

- 输出菜单 SQL 文件
- 导入时应用层解析 SQL，按语句分类执行

优点：

- 看似兼容旧格式

缺点：

- SQL 解析本身复杂且脆弱
- 仍然难以彻底摆脱历史脚本格式
- 最终会得到一个半黑盒半白盒的尴尬方案

结论：

- 不推荐

---

## 5. 推荐方案

采用方案 B：菜单域结构化导出包 + 服务端直连数据库执行全量覆盖。

核心原则如下：

1. 菜单导入导出是独立业务模块，不挂靠在“整库备份恢复”语义下。
2. 菜单导出产物是“菜单包”，不是任意 SQL 文件。
3. 菜单导入执行“菜单域全量覆盖”，不是整库恢复。
4. 后端通过数据库驱动直连 MySQL，不依赖 `mysqldump/mysql` 外部命令。
5. 导入前清理、导入顺序、导入后修复全部显式实现。
6. 所有操作都走任务化与审计记录。

---

## 6. 菜单包设计

## 6.1 文件格式

菜单包建议使用：

- 扩展名：`.menupack.json`
- 传输层可选 gzip 压缩，但压缩是传输优化，不是业务格式

第一版直接使用 JSON，原因：

- 可读、可调试
- 易校验
- 易做版本演进
- 方便前后端和测试共享样例

## 6.2 顶层结构

```json
{
  "meta": {
    "format_version": "1",
    "source_merchant_id": "M123",
    "source_device_ip": "10.0.0.25",
    "source_version": "1.6.23",
    "exported_at": "2026-03-23T15:30:00+08:00",
    "exported_by": {
      "user_id": 12,
      "username": "admin"
    }
  },
  "scope": {
    "type": "menu-domain-full"
  },
  "tables": {
    "menu": [],
    "menu_group": [],
    "menu_category": [],
    "menu_item": [],
    "menu_item_info": [],
    "menu_item_recipe": [],
    "item_size": [],
    "item_unit": [],
    "item_property": [],
    "combo_section": [],
    "combo_section_item_assoc": [],
    "combo_item_section_assoc": [],
    "sale_item_price": [],
    "saleitem_rule_assoc": [],
    "saleitem_property_assoc": [],
    "pricing_rule": [],
    "course": [],
    "restaurant_hours": [],
    "menugroup_hours_assoc": [],
    "category_tax_assoc": [],
    "company_tax": [],
    "printer": [],
    "item_printer_assoc": [],
    "system_language": [],
    "membership_level": [],
    "field_display_name": []
  }
}
```

## 6.3 菜单包校验规则

导入前必须校验：

1. `format_version` 必填且可识别
2. `scope.type` 必须为 `menu-domain-full`
3. 只允许白名单表名
4. `field_display_name` 只允许白名单 `field_type`
5. 不允许包内出现非菜单域敏感字段或表
6. 每张表记录必须满足最小主键字段要求
7. 菜单包来源 MID 与目标 MID 可相同或不同
8. 同 MID 导入仍视为覆盖恢复，不走跨 MID 特殊逻辑

---

## 7. 后端设计

## 7.1 模块划分

建议新增菜单域服务，而不是继续扩展 `DBBackupService`。

新增模块：

- `internal/services/menu_package_service.go`
- `internal/services/menu_import_service.go`
- `internal/services/menu_export_service.go`
- `internal/services/menu_domain_spec.go`
- `internal/services/menu_import_validator.go`
- `internal/services/menu_repair_service.go`

保留现有：

- `DBBackupService` 继续服务“整库运维备份恢复”

原则：

- 菜单模块和整库备份模块并存
- 但入口、接口、文案、任务记录完全分离

## 7.2 后端接口

统一放在 `/api/device/menu` 下。

### 导出

- `POST /api/device/menu/export`

请求：

```json
{
  "merchant_id": "M100"
}
```

返回：

```json
{
  "message": "菜单导出成功",
  "data": {
    "task_id": "menu-export-xxx",
    "file_id": 12,
    "file_name": "M100_1.6.23_20260323_153000.menupack.json"
  }
}
```

### 当前设备菜单包列表

- `GET /api/device/menu/packages?merchant_id=M100`

### 跨 MID 菜单包列表

- `GET /api/device/menu/packages/all?merchant_id=M100`

返回当前用户有权限访问的所有来源 MID 菜单包分组。

### 下载菜单包

- `GET /api/device/menu/packages/download?id=12`

### 删除菜单包

- `DELETE /api/device/menu/packages?id=12`

### 从服务端菜单包导入

- `POST /api/device/menu/import/server`

请求：

```json
{
  "merchant_id": "M100",
  "package_id": 12,
  "restart_pos_after_import": false
}
```

### 从本地菜单包导入

- `POST /api/device/menu/import/upload`

`multipart/form-data`

- `merchant_id`
- `file`
- `restart_pos_after_import`

### 任务查询

- `GET /api/device/menu/tasks/:taskId`

## 7.3 权限模型

沿用现有 `getPermittedDeviceForLicense` 的设备访问模型：

- 管理员
- 设备负责人
- 当前借用人

校验维度：

1. 导出：必须对来源 MID 有权限
2. 本地导入：必须对目标 MID 有权限
3. 服务端导入：必须同时对目标 MID 和来源菜单包归属 MID 有权限

## 7.4 菜单导出实现

导出流程：

1. 校验目标设备存在、IP 可用、用户有权限
2. 后端直连目标设备 MySQL
3. 开启只读导出上下文
4. 按菜单域白名单逐表读取数据
5. 对 `field_display_name` 加 `field_type` 过滤
6. 组装菜单包 JSON
7. 写入服务端文件存储
8. 写入元数据记录
9. 返回成功结果

说明：

- 不生成 SQL 文件
- 不依赖 `mysqldump`
- 不走 SSH
- 不做加密

## 7.5 菜单导入实现

导入流程：

1. 校验目标设备、权限、文件存在
2. 读取菜单包并做结构校验
3. 连接目标设备 MySQL
4. 开启导入任务
5. 按预定义顺序清理菜单域旧数据
6. 按预定义顺序批量写入菜单包数据
7. 执行导入后修复
8. 执行导入后校验
9. Linux 设备按需重启 POS
10. 记录任务完成状态

这里的关键点不是“SQL 文件恢复”，而是“菜单域重建”。

## 7.6 菜单域清理顺序

清理必须显式控制顺序，避免外键和引用关系问题。

建议顺序：

1. 关联表
   - `item_printer_assoc`
   - `menu_item_recipe`
   - `menu_item_info`
   - `combo_section_item_assoc`
   - `combo_item_section_assoc`
   - `sale_item_price`
   - `saleitem_rule_assoc`
   - `saleitem_property_assoc`
   - `pricing_rule`
   - `menugroup_hours_assoc`
   - `category_tax_assoc`
2. 主表
   - `menu_item`
   - `menu_category`
   - `menu_group`
   - `menu`
   - `combo_section`
   - `item_size`
   - `item_unit`
   - `item_property`
   - `course`
   - `restaurant_hours`
   - `company_tax`
   - `printer`
   - `membership_level`
3. 菜单相关显示名
   - `field_display_name` 仅删除白名单 `field_type`

是否需要 `TRUNCATE`：

- 不建议默认使用 `TRUNCATE`
- 优先使用白名单条件 `DELETE`
- 这样更安全，也更方便控制事务

## 7.7 菜单域导入顺序

导入顺序与依赖相反：

1. 基础表
   - `system_language`
   - `membership_level`
   - `company_tax`
   - `item_unit`
   - `item_property`
   - `item_size`
   - `course`
   - `restaurant_hours`
   - `printer`
2. 菜单主干
   - `menu`
   - `menu_group`
   - `menu_category`
   - `menu_item`
   - `combo_section`
3. 关联与扩展
   - `menu_item_info`
   - `menu_item_recipe`
   - `menugroup_hours_assoc`
   - `category_tax_assoc`
   - `combo_section_item_assoc`
   - `combo_item_section_assoc`
   - `saleitem_rule_assoc`
   - `saleitem_property_assoc`
   - `pricing_rule`
   - `sale_item_price`
   - `item_printer_assoc`
4. 菜单显示名
   - `field_display_name`

## 7.8 导入后修复

保留原桌面工具的业务修复意图，但实现成显式服务方法。

建议拆分为：

### 语言修复

- 中文语言 ID 映射修正
- `field_display_name.language_id` 统一修正

### 菜单显示名重建

- 自动补 `shortName`
- 自动补 `posName`
- 删除 `ITEM_SIZE` 的错误 `shortName`

### 打印与设备解绑

- `global_device` 打印相关字段置空
- `app_instance.receipt_printer_id` 置空

### 菜单项修复

- `menu_item.report_item_id = null`

### 菜单时间修复

如业务确有需要，可保留“统一更新时间字段”的能力，但不建议导入后默认执行。

默认策略：

- 第一版不自动修菜单时间
- 如存在兼容性问题，再作为可选 repair step 打开

## 7.9 事务策略

目标是“菜单域全量覆盖”，但数据量可能较大。

建议：

- 单表批量写入时使用事务
- 整体导入使用“阶段性事务 + 任务状态”
- 不强求整个导入跨所有表一个超大事务

原因：

- 大事务风险高
- 跨多个大表可能导致锁时间过长
- 更适合把流程做成阶段可观测任务

导入任务阶段建议：

1. validate
2. clear-old-menu-domain
3. import-base-tables
4. import-menu-tables
5. import-display-names
6. run-repairs
7. post-check
8. optional-restart

---

## 8. 存储设计

## 8.1 文件存储

建议新增目录：

- `backend-go/downloads/menu-packages/{merchant_id}/`

文件命名：

- `{merchantId}_{version}_{yyyyMMdd_HHmmss}.menupack.json`

如果重名，追加 `_01`、`_02`

## 8.2 元数据表

建议新增表：

### `device_menu_package_files`

- `id`
- `merchant_id`
- `source_device_ip`
- `source_version`
- `file_name`
- `relative_path`
- `size_bytes`
- `created_by`
- `created_at`

### `device_menu_import_jobs`

- `job_id`
- `target_merchant_id`
- `source_type` (`server` / `upload`)
- `source_merchant_id`
- `package_file_id`
- `status`
- `step`
- `error_message`
- `requested_by`
- `created_at`
- `started_at`
- `finished_at`

### `device_menu_export_jobs`

- `job_id`
- `merchant_id`
- `package_file_id`
- `status`
- `step`
- `error_message`
- `requested_by`
- `created_at`
- `started_at`
- `finished_at`

---

## 9. 前端设计

## 9.1 入口位置

不建议把“菜单导入导出”继续塞进现有“数据备份/恢复”弹窗。

推荐做法：

- 在设备列表“更多操作”中新增独立入口：
  - `菜单导出`
  - `菜单导入`

前端组件建议独立：

- `frontend/src/components/menu-transfer/MenuTransferModal.jsx`

原因：

- 文案清晰
- 避免与整库备份恢复混淆
- 更容易做菜单专属风险提示

## 9.2 弹窗结构

弹窗标题：

- `菜单导入/导出`

分两个 Tab：

- `菜单包`
- `导入菜单`

### 菜单包 Tab

功能：

- 创建当前设备菜单包
- 列出当前设备菜单包
- 下载
- 删除

### 导入菜单 Tab

功能：

- 从当前设备菜单包恢复
- 从其他 MID 菜单包覆盖导入
- 从本地上传 `.menupack.json` 导入

注意：

- 不接受 `.sql`
- 不展示“普通数据库备份恢复”的文案

## 9.3 关键交互文案

导入确认框必须明确：

1. 当前目标 MID
2. 来源 MID 或来源文件
3. 本次操作是“菜单域全量覆盖”
4. 非菜单数据不会被修改

推荐文案：

`确定将来源菜单包覆盖导入到当前设备吗？此操作会清空并重建当前设备的菜单域数据，包括菜单结构、菜单项、关联显示名和菜单相关依赖。License、订单、客户、员工等非菜单数据不会被修改。`

## 9.4 不合理设计优化

前端层面的优化原则：

1. 菜单导入导出与整库恢复彻底分离
2. 不再显示 `.sql`、gzip、解密等历史概念
3. 不再复用“数据库恢复”文案
4. 只保留菜单域覆盖相关提示
5. 风险确认使用 `toast.confirm`

---

## 10. 安全与审计

## 10.1 不再加密菜单包

结论很明确：

- 菜单包不需要加密

原因：

1. 这是业务配置数据，不是凭据材料
2. 当前系统已有登录鉴权与权限控制
3. 文件存储在服务端受控目录
4. 加密只会增加调试成本、兼容成本和故障点

如果未来确有合规要求，应走统一的对象存储加密或磁盘加密策略，而不是业务层自制文件加密。

## 10.2 数据库凭据管理

必须避免硬编码在代码中。

改造建议：

- 保持现有固定端口/库名默认值
- 用户名密码从服务配置读取
- 前端不可见
- 后端统一封装连接构造

## 10.3 SQL 安全

本方案不接受任意 SQL 文件，因此：

- 不存在任意 SQL 执行入口
- 菜单导入只接受系统定义的菜单包
- 所有写入由后端白名单表写入实现

这比 `mysql < file.sql` 安全边界清晰得多。

## 10.4 审计日志

每次导入导出必须记录：

- 操作者
- 目标 MID
- 来源 MID 或来源文件
- 开始时间
- 结束时间
- 执行状态
- 失败步骤
- 错误摘要

---

## 11. 测试设计

## 11.1 单元测试

覆盖：

- 菜单域表白名单
- `field_display_name` 过滤规则
- 菜单包结构校验
- 文件命名规则
- 路径安全校验
- 导入顺序与清理顺序生成逻辑

## 11.2 集成测试

覆盖：

- 导出一个菜单包
- 导入同 MID 菜单包
- 导入跨 MID 菜单包
- 导入后校验关键表记录数
- 导入后修复逻辑生效
- 非菜单表未被改动

## 11.3 回归测试

确保以下现有功能不受影响：

- License 备份/导入
- 整库数据库备份恢复
- 跨 MID 整库恢复
- Linux 运维功能

---

## 12. 迁移策略

建议分三期实施。

### 第一期：并行引入菜单模块

- 新增菜单导入导出后端接口
- 新增菜单包存储
- 新增前端菜单弹窗
- 不删除现有整库备份恢复

### 第二期：菜单业务切换

- 将原来可能依赖整库恢复的菜单操作迁移到新入口
- 禁止在菜单场景继续使用整库恢复

### 第三期：能力收口

- 文档中明确：
  - 菜单问题走菜单导入导出
  - 整库恢复只用于运维级场景

---

## 13. 最终结论

本次“菜单导入/导出”重构不应照搬原桌面工具，也不应继续依赖 `mysqldump/mysql + 任意 SQL 文件` 的整库恢复思路。

正确的目标模型应是：

- 菜单导出 = 导出菜单域结构化快照
- 菜单导入 = 对目标设备执行菜单域全量覆盖
- 后端直连数据库，显式清理、显式导入、显式修复、显式校验
- 与整库备份恢复彻底分层

这是最符合当前 web 项目长期维护性的方案。

