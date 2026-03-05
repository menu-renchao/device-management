# Menusifu 设备管理平台 — 系统架构总览

> 文档版本：v1.0 | 更新日期：2026-03-05

---

## 1. 系统简介

Menusifu 设备管理平台是一套面向 POS 设备运维团队的内部管理系统，核心功能包括：

- **网络扫描**：自动发现局域网内所有 POS 设备，实时展示在线状态
- **设备管理**：设备认领、借用审批、性质标记、占用管理
- **Linux 远程控制**：通过 SSH 对 Linux POS 服务器进行一键升级、备份恢复、实时日志查看等运维操作
- **WAR 包管理**：集中管理 POS 应用安装包的下载、元数据维护与部署
- **移动设备管理**：平板/手持设备的借用申请与归还流程
- **用户体系**：注册审核、角色权限、消息通知

---

## 2. 技术栈总览

| 层次 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | React | 18 |
| 前端构建 | Vite | 最新 |
| 前端路由 | React Router | v6 |
| 前端 HTTP | Axios | — |
| 前端 UI | 自研 Apple 风格组件 | — |
| 后端框架 | Go Gin | v1.9.1 |
| ORM | GORM | v1.25.5 |
| 数据库 | SQLite (glebarez/sqlite) | — |
| 身份认证 | JWT (golang-jwt/jwt v5) | v5.2.0 |
| SSH/SFTP | golang.org/x/crypto + pkg/sftp | — |
| WebSocket | gorilla/websocket | v1.5.1 |
| 实时推送 | Server-Sent Events (SSE) | — |
| 配置管理 | Viper | v1.18.2 |
| 日志 | 自研结构化日志 + lumberjack | — |

---

## 3. 系统整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         浏览器 / 客户端                           │
│                    React SPA (Vite, port 3000)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ ScanPage │ │LinuxPage │ │WarPkgMgr │ │  WorkspacePage   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│         │            │ WebSocket/SSE            │               │
└─────────┼────────────┼──────────────────────────┼───────────────┘
          │ HTTP/REST  │                           │
          ▼            ▼                           │
┌─────────────────────────────────────────────────┼───────────────┐
│                  Go Gin 后端 (port 5000)          │               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      中间件层                            │    │
│  │  CORS │ RequestID │ Logger │ Recovery │ Auth(JWT)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐    │
│  │  Auth   │ │  Scan  │ │ Linux  │ │ Device │ │   WAR    │    │
│  │ Handler │ │Handler │ │Handler │ │Handler │ │ Handler  │    │
│  └────┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘    │
│       │          │          │           │            │          │
│  ┌────▼──────────▼──────────▼───────────▼────────────▼──────┐  │
│  │                       Service 层                          │  │
│  │  AuthService │ ScanService │ LinuxService │ WarDownload   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                            │                                   │
│  ┌─────────────────────────▼───────────────────────────────┐  │
│  │                    Repository 层                         │  │
│  │  UserRepo │ DeviceRepo │ MobileRepo │ WarPackageRepo     │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                   │
└────────────────────────────┼───────────────────────────────────┘
                             ▼
              ┌──────────────────────────┐
              │    SQLite 数据库          │
              │    (data.db)             │
              └──────────────────────────┘
                             
                  ┌──────────────────────┐
                  │   POS 设备 (局域网)    │
                  │  port 22080 (HTTP)   │
                  │  port 22    (SSH)    │
                  └──────────────────────┘
```

---

## 4. 核心业务流程

### 4.1 设备扫描流程

```
用户选择网卡 IP → POST /api/scan/start
        │
        ▼ (Go goroutine 异步执行)
  阶段一：端口扫描 (0–45%)
  ├── /23 网段 (~512 个 IP)
  ├── 200 并发 worker
  ├── TCP 端口 22080，超时 2s
  └── 收集开放 IP 列表
        │
        ▼
  阶段二：设备信息采集 (45–95%)
  ├── 100 并发 worker
  ├── GET /kpos/webapp/store/fetchCompanyProfile
  ├── GET /kpos/webapp/os/getOSType
  └── 每个设备立即写入 SQLite
        │
        ▼
  阶段三：收尾处理 (95–100%)
  ├── 未取消 → 标记不在结果中的设备为离线
  └── 更新 scan_sessions 最后扫描时间

前端每秒轮询 GET /api/scan/status 更新进度条
```

### 4.2 Linux 远程控制流程

```
用户进入 Linux 配置页面
        │
        ▼
POST /api/linux/connect (SSH 连接建立，存入 SessionPool)
        │
  ┌─────┴──────────────────────────────────────┐
  │  POS 控制  │  WAR 部署  │  备份/日志  │  升级  │
  └─────┬──────────────────────────────────────┘
        │
        ▼ (升级专用)
POST /api/linux/upgrade/task → 返回 taskId
GET  /api/linux/upgrade/stream/:taskId (SSE 实时推送进度)
```

### 4.3 设备借用审批流程

```
普通用户                    管理员
    │                          │
    ├─ POST /device/borrow-requests (提交借用申请)
    │                          │
    │              消息通知 ←───┤
    │                          ├─ GET /device/borrow-requests
    │                          ├─ POST /borrow-requests/:id/approve
    │                          │   或
    │                          └─ POST /borrow-requests/:id/reject
    │
    ├─ GET /notifications (收到通知)
    └─ GET /workspace/my-borrows (查看已借设备)
```

---

## 5. 认证与授权

### JWT 认证机制

```
POST /api/auth/login
    │
    ▼
AuthService.Login()
    ├── bcrypt 校验密码
    ├── 生成 access_token (24h 有效期)
    └── 生成 refresh_token (720h 有效期)

客户端将 token 存储于 localStorage
每次请求在 Authorization: Bearer <token> 头中携带
```

### 权限等级

| 角色 | 说明 | 可访问接口 |
|------|------|-----------|
| 游客 | 未登录 | `/api/auth/login`, `/api/auth/register` |
| 普通用户 (user) | 审核通过后激活 | 扫描、查看设备、提交借用申请、工作台 |
| 管理员 (admin) | 内置 admin 账号 | 全部接口，含审批、删除、用户管理 |

### 用户状态流转

```
注册 → pending → (管理员审核) → approved / rejected
```

---

## 6. 实时通信机制

| 场景 | 协议 | 路径 |
|------|------|------|
| 实时日志流 | WebSocket | `/ws/linux/logs` |
| 升级任务进度 | SSE | `/api/linux/upgrade/stream/:taskId` |
| 扫描进度 | HTTP 轮询 (1s) | `/api/scan/status` |

---

## 7. 文件存储

| 内容 | 存储位置 | 访问路径 |
|------|----------|---------|
| 移动设备图片 | `uploads/` | `/uploads/*` |
| WAR/ZIP 安装包 | `downloads/` | `/api/linux/war/file/:name` |
| 日志文件 | `logs/app.log` | — |
| 数据库 | `data.db` | — |

---

## 8. 部署架构

```
开发环境：
  frontend (Vite dev, :3000) ──proxy──▶ backend-go (:5000)

生产环境（推荐）：
  frontend 构建产物 (dist/) ──静态文件──▶ backend-go (:5000) 同时提供静态服务
  或
  Nginx 反向代理 → frontend dist / backend-go API
```

### 快速启动

```bash
# 后端
cd backend-go
go run cmd/server/main.go

# 前端
cd frontend
npm run dev
```

---

## 9. 文档索引

| 文档 | 路径 |
|------|------|
| 系统架构总览（本文） | `docs/architecture-overview.md` |
| 后端架构详解 | `docs/backend-architecture.md` |
| 前端架构详解 | `docs/frontend-architecture.md` |
| 数据库设计 | `docs/database-design.md` |
| 开发规范 | `docs/development-guide.md` |
| 扫描逻辑专项 | `docs/scan-logic.md` |
