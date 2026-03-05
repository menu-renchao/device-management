# 后端架构详解

> 文档版本：v1.0 | 更新日期：2026-03-05

---

## 1. 目录结构

```
backend-go/
├── cmd/
│   ├── server/
│   │   └── main.go              # 应用入口：初始化、依赖注入、路由注册
│   └── cleanup/
│       └── main.go              # 数据清理工具（独立可执行）
├── internal/                    # 内部包（不对外暴露）
│   ├── config/
│   │   └── config.go            # 配置加载（Viper + .env）
│   ├── handlers/                # HTTP 处理层
│   │   ├── auth.go
│   │   ├── device.go
│   │   ├── scan.go
│   │   ├── linux.go
│   │   ├── war_download.go
│   │   ├── war_package.go
│   │   ├── workspace.go
│   │   └── ...
│   ├── middleware/
│   │   └── logger.go            # CORS / RequestID / Logger / Recovery / Auth
│   ├── models/                  # GORM 数据模型
│   │   ├── user.go
│   │   ├── scan_result.go
│   │   ├── device_occupancy.go
│   │   ├── device_claim.go
│   │   ├── device_borrow_request.go
│   │   ├── device_property.go
│   │   ├── mobile_device.go
│   │   ├── mobile_borrow_request.go
│   │   ├── scan_session.go
│   │   ├── file_config.go
│   │   ├── system_config.go
│   │   ├── system_notification.go
│   │   └── war_package_metadata.go
│   ├── repository/              # 数据访问层
│   │   ├── device_repo.go
│   │   ├── user_repo.go
│   │   └── ...
│   ├── services/                # 业务逻辑层
│   │   ├── auth_service.go
│   │   ├── scan_service.go
│   │   ├── linux_service.go
│   │   ├── war_download_service.go
│   │   ├── notification_service.go
│   │   └── upgrade_task_service.go
│   └── logger/
│       ├── logger.go            # 结构化日志封装
│       └── gorm_logger.go       # GORM 日志适配器
└── pkg/                         # 可复用公共包
    ├── jwt/                     # JWT 生成与验证
    ├── response/                # 统一响应格式封装
    └── ssh/
        ├── sftp.go              # SFTP 文件传输
        └── session_pool.go      # SSH 连接池管理
```

---

## 2. 分层架构

### 调用链路

```
HTTP Request
    │
    ▼
middleware（CORS → RequestID → Logger → Recovery → Auth）
    │
    ▼
Handler（参数绑定、参数校验、调用 Service）
    │
    ▼
Service（业务逻辑、调用 Repository）
    │
    ▼
Repository（GORM 封装、SQL 操作）
    │
    ▼
SQLite (data.db)
```

### 各层职责

| 层次 | 职责 | 禁止事项 |
|------|------|---------|
| Handler | 解析请求参数、调用 Service、格式化响应 | 不直接操作数据库 |
| Service | 业务规则、事务协调 | 不直接写 HTTP 响应 |
| Repository | 数据库 CRUD 封装 | 不包含业务逻辑 |
| Model | 数据结构定义 | 不包含业务方法（除密码哈希）|

---

## 3. 依赖注入方式

项目采用**手动依赖注入**（在 `main.go` 中显式构造），无 IoC 容器：

```go
// main.go 依赖注入顺序
userRepo     := repository.NewUserRepository(db)
deviceRepo   := repository.NewDeviceRepository(db)
...
authService  := services.NewAuthService(userRepo)
scanService  := services.NewScanService()
...
authHandler  := handlers.NewAuthHandler(authService, userRepo, notificationService)
```

优点：依赖关系一目了然，无反射开销，测试易于替换 mock。

---

## 4. 中间件栈

注册顺序（从外到内）：

```
CORS → RequestIDMiddleware → LoggerMiddleware → RecoveryMiddleware
                                    [受保护路由]
                                    → Auth(JWT 验证)
                                    → AdminOnly(角色校验)
```

### CORS

开发环境默认允许 `*`，生产环境通过 `CORS_ORIGINS` 配置白名单。

### RequestID

- 优先从请求头 `X-Request-ID` 读取
- 若无，生成 UUID v4
- 写入 Gin Context 和响应头，方便日志追踪

### LoggerMiddleware

记录每个请求的方法、路径、客户端 IP、耗时、状态码和 RequestID，以结构化 JSON 格式输出。

### RecoveryMiddleware

捕获 panic，记录错误日志，返回 HTTP 500，防止服务崩溃。

### Auth（JWT 验证）

从 `Authorization: Bearer <token>` 提取并验证 JWT，将解析出的 user_id 存入 Context。

### AdminOnly

从 Context 取 user_id，查库确认角色为 `admin`，否则返回 403。

---

## 5. 核心 Service 详解

### 5.1 ScanService

扫描采用**双阶段并发 Worker Pool**模式：

```
阶段一：端口探活
  ipChan(缓冲) → [200 goroutines] → resultChan
  每个 worker：TCP Dial port 22080，超时 2s

阶段二：设备信息采集
  fetchChan(缓冲) → [100 goroutines] → fetchResultChan
  每个 worker：
    GET /kpos/webapp/store/fetchCompanyProfile  (超时5s，重试2次)
    GET /kpos/webapp/os/getOSType              (超时3s)
```

扫描状态通过 `sync.RWMutex` 保护的共享结构体对外暴露，前端轮询获取进度。

### 5.2 LinuxService

通过 `ssh.SessionPool` 管理多个 POS 服务器的 SSH 长连接：

```
SessionPool (map[merchantID]*SSHSession)
    │
    ├── Connect(merchantID, config) → 建立连接并缓存
    ├── Execute(merchantID, cmd)    → 复用连接执行命令
    ├── UploadFile(...)             → SFTP 上传
    └── Disconnect(merchantID)     → 关闭并移除
```

**升级任务**使用独立的 `UpgradeTaskManager`，每个任务生成 UUID，通过 SSE 流式推送进度给前端。

### 5.3 WarDownloadService

管理 WAR/ZIP 包的远程下载流程：

- 创建下载任务（异步 goroutine）
- 进度通过 `taskId` 轮询查询
- 支持 Cookie 注入（用于需要认证的下载源）
- 本地文件上传入库

### 5.4 NotificationService

系统消息通知机制：

- 触发点：用户注册、借用申请提交/审批/拒绝等
- 存储于 `system_notifications` 表
- 前端通过 `NotificationBell` 组件轮询未读数量

---

## 6. 统一响应格式

由 `pkg/response` 包提供：

```json
// 成功
{
  "code": 200,
  "message": "success",
  "data": { ... }
}

// 失败
{
  "code": 400,
  "message": "参数错误",
  "data": null
}
```

---

## 7. 日志系统

日志采用结构化输出，支持 JSON 和文本两种格式：

```
LOG_LEVEL=info        # debug / info / warn / error
LOG_FORMAT=json       # json / text
LOG_OUTPUT=both       # file / stdout / both
LOG_FILE_PATH=logs/app.log
LOG_MAX_SIZE=100      # MB，超过后 rotate
LOG_MAX_BACKUPS=10    # 保留最近 10 个日志文件
LOG_MAX_AGE=30        # 日志保留天数
LOG_COMPRESS=true     # 旧文件 gzip 压缩
```

每条日志包含：`time`, `level`, `msg`, `request_id`（HTTP 请求日志）。

---

## 8. 配置管理

配置通过 `Viper` 从 `.env` 文件和环境变量读取，优先级：环境变量 > `.env` > 默认值。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 5000 | 服务监听端口 |
| `GIN_MODE` | debug | debug / release |
| `JWT_SECRET_KEY` | dev-secret-key | 生产必须修改 |
| `JWT_ACCESS_TOKEN_EXPIRES` | 24 | 小时 |
| `DATABASE_PATH` | data.db | SQLite 文件路径 |
| `CORS_ORIGINS` | * | 跨域白名单 |
| `UPLOAD_PATH` | uploads | 图片上传目录 |
| `DOWNLOADS_DIR` | downloads | WAR 包存储目录 |

---

## 9. 数据库初始化策略

启动时自动执行 GORM `AutoMigrate`，幂等创建/更新表结构，不会丢失现有数据。

首次启动自动创建默认管理员：

```
用户名：admin
密码：admin123（bcrypt 加密存储）
角色：admin
状态：approved
```

**生产环境务必修改默认密码。**

---

## 10. 路由权限矩阵

| 路由前缀 | Auth 要求 | Admin 要求 |
|---------|-----------|-----------|
| `POST /api/auth/register` | 无 | 无 |
| `POST /api/auth/login` | 无 | 无 |
| `GET /api/scan/*` | 无 | 无 |
| `GET /api/auth/profile` | 是 | 否 |
| `GET /api/devices` | 是 | 否 |
| `GET /api/device/occupancy` | 是 | 否 |
| `PUT /api/device/occupancy` | 是 | **是** |
| `POST /api/device/claim` | 是 | 否 |
| `POST /api/device/claim/:id/approve` | 是 | **是** |
| `DELETE /api/device/:id` | 是 | **是** |
| `GET /api/linux/*` | 是 | 否 |
| `POST /api/linux/file-configs` | 是 | **是** |
| `GET /api/admin/*` | 是 | **是** |
| `GET /api/mobile/devices` | 是 | 否 |
| `POST /api/mobile/devices` | 是 | **是** |
| `GET /api/workspace/*` | 是 | 否 |
| `GET /api/notifications/*` | 是 | 否 |
