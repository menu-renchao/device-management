# POS DB 配置简化设计

## 1. 背景

当前项目的 POS 数据库连接设计存在三层不必要复杂度：

- 后端按设备把连接信息存到 `device_db_connections`
- 密码通过 `pkg/crypto/password_cipher.go` 加解密，并复用 `JWT_SECRET_KEY`
- 前端页面允许用户输入端口、库名、用户名、密码，同时内置默认值

这套设计与实际业务不匹配。当前真正变化的只有设备 IP，数据库端口、库名、用户名、密码本质上是全局固定配置。继续保留“设备级存储 + 密码加解密 + 前端输入”的模型，会带来以下问题：

- 运行链路依赖 `device_db_connections`，结构冗余
- JWT 密钥变化可能导致数据库密码无法解密
- 前端存在硬编码默认密码，风险高且维护成本高
- SQL 模板执行前还要先保存连接，交互多余

本次改造目标是把 POS 数据库连接收敛为统一运行时配置：

- `host` 永远取当前设备 IP
- `port / database / username / password` 永远取服务端 `.env`
- 前端只展示当前生效信息，不再提供输入或保存

## 2. 目标

- 统一通过 `.env` 明文配置 POS 数据库端口、库名、用户名、密码
- 移除 `device_db_connections` 的运行时读写逻辑
- 移除数据库密码加解密逻辑
- 前端数据库连接区域改为信息展示，不再允许编辑
- SQL 模板测试连接与执行都直接使用“当前设备 IP + `.env` 配置”

## 3. 非目标

- 不支持设备级数据库连接覆盖
- 不保留“读旧连接表作为兼容回退”的双轨逻辑
- 不在本次改造中自动删除历史 SQLite 表 `device_db_connections`
- 不扩展到多数据库类型，仍只支持 MySQL

## 4. 配置模型

后端新增统一 POS 数据库环境变量：

- `POS_DB_PORT`
- `POS_DB_NAME`
- `POS_DB_USER`
- `POS_DB_PASSWORD`

可保留：

- `POS_DB_TYPE=mysql`

运行时连接参数统一规则：

- `host = 当前设备 IP`
- `port = POS_DB_PORT`
- `database_name = POS_DB_NAME`
- `username = POS_DB_USER`
- `password = POS_DB_PASSWORD`

前端不再拥有默认数据库密码，也不再生成数据库连接保存请求。

## 5. 后端设计

### 5.1 配置层

在 `backend-go/internal/config/config.go` 中为 `Config` 增加 POS 数据库配置结构，例如：

- `Type`
- `Port`
- `Name`
- `User`
- `Password`

`config.Init()` 负责：

- 从 `.env` 读取 `POS_DB_*`
- 设置合理默认值（如 `mysql` 与默认端口）
- 让后续业务代码只依赖 `config.AppConfig.POSDatabase`

`.env.example` 需要同步补充这些字段。

### 5.2 运行时连接解析

在服务层新增统一解析能力，例如 `backend-go/internal/services/pos_db_runtime.go`。

职责：

1. 根据 `merchant_id` 查询设备记录
2. 从设备记录中取得当前设备 IP
3. 将设备 IP 与 `config.AppConfig.POSDatabase` 组合成标准 `DBConnectionInput`

该能力会成为 POS 数据库访问的唯一运行时来源，避免后续再出现多处各自拼接主机、端口、用户名、密码的情况。

### 5.3 DBConfigService 重构

`DBConfigService` 不再依赖 `DeviceDBConnectionRepository`。

重构后行为：

- `GetConnection(merchantID)` 返回基于当前设备 IP 和 `.env` 生成的只读连接信息
- `TestConnectionForMerchant(merchantID)` 不再接收用户输入密码，不再处理 `use_saved_password`
- `ExecuteTemplates()` 直接使用运行时解析出的连接参数访问 MySQL

需要移除：

- `UpsertConnection`
- `resolveTestConnectionInput`
- `decryptConnection`
- `getCipherSecret`
- `UseSavedPassword`
- 对 `pkg/crypto/password_cipher.go` 的依赖

### 5.4 Handler 与 API

保留并重定义：

- `GET /api/db-config/connections/:merchantId`
  - 返回当前生效连接信息
  - `host` 为当前设备 IP
  - `port / database_name / username` 为服务端环境配置
  - 不返回明文密码，可返回 `password_configured: true`

- `POST /api/db-config/connections/:merchantId/test`
  - 不依赖前端提交连接参数
  - 直接测试当前生效配置

移除：

- `PUT /api/db-config/connections/:merchantId`

这样可以在尽量少改动前端 API 入口的前提下，彻底移除存储逻辑。

### 5.5 数据模型与迁移

需要从运行时代码中移除：

- `backend-go/internal/models/device_db_connection.go`
- `backend-go/internal/repository/device_db_connection_repo.go`
- `cmd/server/main.go` 中相关仓储初始化和 `AutoMigrate` 注册

本次不做自动删表。原因：

- 目标是先移除运行时依赖，降低改造风险
- 历史表中可能仍有存量数据，自动删除属于破坏性动作
- 后续若需要清理，可单独安排一次安全的数据迁移

## 6. 前端设计

### 6.1 页面职责重定义

`DBConfigPage` 改为“数据库连接信息展示 + SQL 模板执行”页面，而不是“设备数据库连接编辑页面”。

页面连接信息区域只展示：

- 当前设备 IP
- 当前数据库端口
- 当前数据库名
- 当前数据库用户名
- 密码状态文案，例如“已由服务端环境变量配置”

### 6.2 交互调整

需要移除的前端交互：

- 编辑端口、库名、用户名、密码
- 保存连接
- 使用已保存密码
- 前端数据库连接校验
- 默认数据库密码硬编码

保留的交互：

- 测试连接
- 执行 SQL 模板
- 新增、编辑、删除 SQL 模板

其中“测试连接”和“执行 SQL 模板”都直接调用后端，前端不再构造数据库凭据。

### 6.3 组件与状态简化

`ConnectionPanel` 由表单组件改为展示组件。

`DBConfigPage` 中以下状态和逻辑应删除：

- `hasSavedPassword`
- `ensureConnectionSynced`
- `validateConnection`
- `buildConnectionPayloadForRequest`
- 对 `saveConnection()` 的调用

以下辅助文件应同步简化或删除：

- `frontend/src/pages/connectionDefaults.js`
- `frontend/src/pages/dbConnectionFormState.js`
- `frontend/src/pages/dbConnectionRequestState.js`
- 对应测试文件

## 7. 测试设计

### 7.1 后端

需要新增或调整测试覆盖：

- 配置读取 `POS_DB_*` 的行为
- 运行时连接解析正确使用设备 IP
- `DBConfigService` 在没有 `device_db_connections` 的前提下仍能测试连接和执行 SQL
- `main.go` 的 `autoMigrateModels()` 不再包含 `DeviceDBConnection`
- 处理设备不存在或设备 IP 为空时的错误

不再保留的测试方向：

- 密码加解密
- `use_saved_password`
- 旧连接记录回填

### 7.2 前端

需要覆盖：

- 连接信息区域为只读展示
- 页面不再发起保存连接请求
- 测试连接调用不依赖用户输入
- 执行 SQL 模板不再先同步连接

## 8. 风险与控制

### 8.1 风险

- `.env` 配置错误会影响所有 POS 设备
- 运行时代码如果仍残留对旧仓储的依赖，会导致编译或逻辑错误
- 前端若仍保留旧状态流，可能继续发送已失效的请求结构

### 8.2 控制措施

- 增加配置读取与运行时解析测试
- 通过删除旧模型、仓储和服务依赖，避免“逻辑上不用、代码里还在”的半收敛状态
- 保留 `GET /connections/:merchantId` 与 `POST /connections/:merchantId/test`，降低接口迁移范围
- 不自动删历史表，先完成逻辑收敛，再视需要独立清理数据

## 9. 结论

本次改造后的正确模型应当是：

- 设备决定连接目标主机，即当前设备 IP
- 系统决定默认数据库端口、库名、用户名、密码，即 `.env`
- 前端只负责展示和触发操作，不负责编辑数据库凭据

这能直接消除当前设计中最主要的复杂来源：

- `device_db_connections` 的设备级存储
- 密码加解密链路
- 前端默认值与输入表单

最终结果是更符合真实业务、更容易维护、也更不容易出错的 POS 数据库连接模型。
