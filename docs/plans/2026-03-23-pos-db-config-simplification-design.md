# POS 默认数据库连接极简化设计

## 1. 背景

当前项目里的数据库配置模块已经偏离真实业务前提：

- 产品设备统一使用同一套 MySQL 用户、密码、端口、库名
- 设备之间真正变化的主要只有 `device.IP`
- 但现有实现仍按设备保存连接信息
- 密码使用 AES-GCM 加密入库
- 解密密钥复用 `JWT_SECRET_KEY`
- SQL 模板执行又强依赖设备级连接表

这导致了几类无业务价值的复杂度：

- `device_db_connections` 表需要维护
- 前端要维护“保存连接 / 使用已保存密码 / 测试当前填写连接”
- 后端要维护密码加密、解密、密钥管理
- `JWT_SECRET_KEY` 变化会导致数据库连接密码无法解密
- 菜单导入导出、整库备份恢复、SQL 执行三条链路无法稳定共用同一套默认连接能力

本次重整目标是彻底回到真实业务模型：统一默认连接，按设备 IP 直连，移除设备级数据库连接管理。

---

## 2. 目标

新的数据库连接设计必须满足：

- 所有 POS 设备统一使用全局默认 MySQL 配置
- 连接目标主机由 `device.IP` 决定
- 不再保存设备级数据库连接信息
- 不再对数据库密码做加密入库
- 不再让 SQL 模板执行依赖 `device_db_connections`
- 菜单导入导出、整库备份恢复、SQL 模板执行共用一套默认 POS DB 连接构造逻辑

---

## 3. 非目标

本次明确不做：

- 为少数门店保留设备级数据库连接覆盖
- 保留旧的密码加密逻辑作为兼容分支
- 保留“读取旧连接记录”的过渡能力
- 支持多种数据库类型，仍只支持 MySQL
- 重构 SQL 模板体系本身

---

## 4. 新架构

### 4.1 全局默认连接

系统只保留以下全局配置：

- `POS_DB_PORT`
- `POS_DB_USER`
- `POS_DB_PASSWORD`
- `POS_DB_NAME`

运行时连接参数统一为：

- `host = device.IP`
- `port = POS_DB_PORT`
- `user = POS_DB_USER`
- `password = POS_DB_PASSWORD`
- `database = POS_DB_NAME`

### 4.2 统一连接解析器

新增统一默认 POS DB 连接模块，例如：

- `backend-go/internal/services/pos_db_runtime.go`

职责只有两件事：

1. 根据 `merchant_id` 查询设备，获取 `device.IP`
2. 根据全局配置生成标准 `DBConnectionInput` 或 MySQL DSN

所有业务模块必须复用它：

- 菜单导入导出
- 整库备份恢复
- SQL 模板执行

禁止业务模块自行拼接主机、端口、密码来源。

### 4.3 SQL 执行模块

SQL 模板与执行历史继续保留，但执行链路改为：

1. 前端选择模板
2. 后端根据 `merchant_id` 找到设备
3. 统一默认连接解析器构造连接
4. Go 进程内直连 MySQL 执行 SQL
5. 落执行历史与明细

SQL 执行不再需要：

- 保存设备连接
- 读取设备连接
- 复用已保存密码
- 解密密码

### 4.4 菜单 / 备份模块

菜单导入导出和整库备份恢复不再有独立的“凭据来源”。

它们共享：

- 同一个设备 IP 来源
- 同一个默认端口/用户名/密码/库名来源
- 同一个默认 POS DB 连接模块

这样可以避免三条链路出现不同的密码逻辑与连接行为。

---

## 5. 数据模型调整

### 5.1 删除设备级连接表职责

现有表：

- `device_db_connections`

不再承担任何业务职责。

建议直接删除以下字段对应的整张表：

- `merchant_id`
- `host`
- `port`
- `database_name`
- `username`
- `password_encrypted`

### 5.2 删除加密逻辑

删除以下逻辑：

- `pkg/crypto/password_cipher.go`
- `DBConfigService.decryptConnection`
- `DBConfigService.getCipherSecret`
- `UseSavedPassword`
- 任何基于 `JWT_SECRET_KEY` 的数据库连接密码解密

这样可以直接消灭：

- `cipher: message authentication failed`
- 数据库连接和 JWT 密钥耦合
- 设备级密码保存与恢复

---

## 6. 接口调整

### 6.1 保留

- `GET /api/db-config/templates`
- `POST /api/db-config/execute`
- `GET /api/db-config/history`
- `GET /api/db-config/history/:taskId`
- `POST /api/db-config/test-default`
- 可选：`GET /api/db-config/default-connection`

### 6.2 删除

- `GET /api/db-config/connections/:merchantId`
- `PUT /api/db-config/connections/:merchantId`
- 所有设备级连接保存 / 读取接口

### 6.3 新接口语义

`test-default`：

- 输入：`merchant_id`
- 行为：使用 `device.IP + POS_DB_*` 测试默认连接

`default-connection`：

- 输入：`merchant_id`
- 输出：
  - `host = device.IP`
  - `port`
  - `username`
  - `database_name`
  - `password_set = true`

不返回明文密码。

---

## 7. 前端调整

### 7.1 DB 配置页重定义

`DBConfigPage` 改成“默认连接 + SQL 执行页”，不再是“设备级连接配置页”。

页面结构建议为：

1. 默认连接信息卡片
   - 当前设备 IP
   - 默认端口
   - 默认用户名
   - 默认库名
   - 密码状态：使用系统默认密码

2. 默认连接测试
   - “测试默认连接”按钮

3. SQL 模板管理
   - 保留现有模板列表、创建、编辑、删除

4. SQL 执行与历史
   - 保留现有执行结果与历史

### 7.2 删除交互

前端删除以下概念：

- 保存连接
- 编辑主机/端口/用户名/密码
- 使用已保存密码
- 设备级连接表单状态

这样页面会显著变简单，也更符合实际业务。

---

## 8. 风险与控制

### 8.1 风险

1. 错误的全局默认密码会影响全部设备
2. 现有 SQL 执行页逻辑会依赖已删除的连接接口
3. 菜单 / 备份 / SQL 三条链路的连接行为若未统一，后续还会分叉

### 8.2 控制

1. 增加默认连接测试接口
2. 所有连接统一走默认 POS DB 连接模块
3. 重构完成后删除旧接口，避免双轨并存
4. 通过集成测试验证：
   - SQL 模板执行
   - 菜单导出导入
   - 数据库备份恢复

---

## 9. 最终结论

新的正确模型不是“每台设备一份数据库配置”，而是：

- 设备决定主机 IP
- 系统决定默认用户名/密码/端口/库名

因此应当：

- 删除 `device_db_connections`
- 删除所有数据库密码加解密逻辑
- 删除设备级连接配置 UI 与接口
- 将数据库执行、菜单导入导出、整库备份恢复统一到一套默认 POS DB 连接能力上

这套方案最符合真实业务，也最能稳定地压低系统复杂度。
