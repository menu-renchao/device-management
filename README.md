# Menusifu 设备管理平台

POS 设备扫描管理系统，用于网络扫描、设备管理、Linux 服务器远程控制等功能。

## 技术栈

### 后端
- **框架**: Go Gin
- **ORM**: GORM
- **数据库**: SQLite
- **认证**: JWT (JSON Web Token)
- **SSH**: golang.org/x/crypto/ssh
- **文件传输**: pkg/sftp

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **路由**: React Router v6
- **HTTP 客户端**: Axios
- **UI 组件**: 自定义 Apple 风格组件

---

## 目录结构

```
pos-scanner-web/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── components/          # 通用组件
│   │   │   ├── auth/           # 认证相关组件
│   │   │   ├── linux/          # Linux 配置页面组件
│   │   │   ├── DetailModal.jsx # 设备详情弹窗（分类展示、过滤null值）
│   │   │   ├── ScanTable.jsx   # 设备列表表格
│   │   │   └── ...
│   │   ├── pages/              # 页面组件
│   │   ├── services/           # API 服务
│   │   ├── contexts/           # React Context
│   │   └── App.jsx             # 主应用
│   ├── package.json
│   └── vite.config.js
│
├── backend-go/                  # Go 后端
│   ├── cmd/server/main.go      # 主程序入口
│   ├── internal/
│   │   ├── config/             # 配置管理
│   │   ├── handlers/           # HTTP 处理器
│   │   ├── middleware/         # 中间件
│   │   ├── models/             # 数据模型
│   │   ├── repository/         # 数据访问层
│   │   └── services/           # 业务逻辑层
│   ├── pkg/
│   │   ├── jwt/                # JWT 工具
│   │   ├── response/           # 响应封装
│   │   └── ssh/                # SSH 客户端封装
│   └── go.mod
│
└── README.md
```

---

## 快速开始

### 环境要求
- Go 1.21+
- Node.js 18+
- npm 或 yarn

### 后端启动

```bash
cd backend-go

# 安装依赖
go mod download

# 启动服务
go run cmd/server/main.go

# 或编译后运行
go build -o server.exe cmd/server/main.go
./server.exe
```

后端服务运行在 `http://localhost:5000`

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 生产构建
npm run build
```

前端服务运行在 `http://localhost:3000`

### 默认账号
- **管理员**: `admin` / `admin123`

---

## 功能模块

### 1. 网络扫描
- 自动发现本地网络中的 POS 设备
- 实时显示扫描进度
- 支持多网卡扫描
- 设备信息自动保存

### 2. 设备管理
- 设备列表展示（分页、搜索）
- 设备详情查看
  - 公司信息（名称、商户ID、地址、联系方式等）
  - 应用信息（版本、许可状态、补丁号）
  - 设备实例列表（POS、KIOSK、EMENU等，按类型颜色区分）
  - 营业时间
  - 图片资源
  - 请求结果状态
  - 自动过滤 null 值字段
- 设备占用管理
- 设备认领流程
- 设备性质标记

### 3. Linux 远程管理
- SSH 连接管理
- POS 应用控制（启动/停止/重启）
- WAR 包上传部署
- 数据备份与恢复
- 实时日志查看（WebSocket）
- 配置文件管理
- 版本信息查询
- 一键升级功能

### 4. 用户管理
- 用户注册/登录
- JWT Token 认证
- 角色权限控制（普通用户/管理员）
- 用户审核流程
- 密码修改

### 5. 移动设备管理
- 移动设备信息管理
- 设备图片上传
- 占用状态管理

---

## API 文档

### 认证接口 `/api/auth`

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/register` | 用户注册 | 否 |
| POST | `/login` | 用户登录 | 否 |
| POST | `/logout` | 用户登出 | 是 |
| GET | `/profile` | 获取用户信息 | 是 |
| PUT | `/password` | 修改密码 | 是 |

### 管理员接口 `/api/admin`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/users` | 获取用户列表 |
| POST | `/users` | 创建用户 |
| PUT | `/users/:id` | 更新用户 |
| PUT | `/users/:id/approve` | 审核通过 |
| PUT | `/users/:id/reject` | 审核拒绝 |
| PUT | `/users/:id/reset-password` | 重置密码 |
| DELETE | `/users/:id` | 删除用户 |
| GET | `/device-properties` | 获取设备性质 |
| PUT | `/device-properties` | 设置设备性质 |

### 设备接口 `/api/device`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/occupancy` | 获取占用列表 |
| PUT | `/occupancy` | 设置占用 |
| DELETE | `/occupancy/:merchant_id` | 释放占用 |
| POST | `/claim` | 提交认领 |
| GET | `/claims` | 认领列表 |
| POST | `/claim/:id/approve` | 通过认领 |
| POST | `/claim/:id/reject` | 拒绝认领 |
| DELETE | `/:merchant_id` | 删除设备 |

### 扫描接口 `/api/scan`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/ips` | 获取本地IP列表 |
| POST | `/start` | 开始扫描 |
| POST | `/stop` | 停止扫描 |
| GET | `/status` | 扫描状态 |
| GET | `/device/:ip/details` | 设备详情 |
| GET | `/devices` | 设备列表(分页) |

### Linux 管理接口 `/api/linux`

#### 连接管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/connect` | 建立 SSH 连接 |
| POST | `/disconnect` | 断开连接 |
| GET | `/status` | 连接状态 |
| POST | `/test-connection` | 测试连接 |

#### POS 控制
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/pos/stop` | 停止 POS |
| POST | `/pos/start` | 启动 POS |
| POST | `/pos/restart` | 重启 POS |
| POST | `/tomcat/restart` | 重启 Tomcat |

#### 文件上传
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/upload/war` | 上传 WAR 包 |
| GET | `/upload/progress/:taskId` | 上传进度 |

#### 备份管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/backup/create` | 创建备份 |
| GET | `/backup/list` | 备份列表 |
| POST | `/backup/restore` | 恢复备份 |

#### 日志管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/logs/list` | 日志列表 |
| GET | `/logs/download` | 下载日志 |
| GET | `/logs/content` | 读取日志内容 |

#### 版本信息
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/version/app` | 应用版本 |
| GET | `/version/cloud` | CloudDataHub 版本 |

#### 配置管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/config` | 获取配置 |
| GET | `/config/list` | 配置列表 |
| POST | `/config` | 更新配置 |

#### 其他
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/md5/remote` | 远程 MD5 |
| POST | `/md5/local` | 本地 MD5 |
| POST | `/upgrade` | 一键升级 |
| GET | `/system/info` | 系统信息 |

### WebSocket 接口

| 路径 | 描述 |
|------|------|
| `/ws/linux/logs` | 实时日志推送 |

---

## 数据库模型

### users - 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名(唯一) |
| password_hash | TEXT | 密码哈希 |
| email | TEXT | 邮箱 |
| name | TEXT | 姓名 |
| role | TEXT | 角色(user/admin) |
| status | TEXT | 状态(pending/approved/rejected) |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### scan_results - 扫描结果表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| ip | TEXT | IP 地址 |
| merchant_id | TEXT | 商户 ID |
| name | TEXT | 设备名称 |
| version | TEXT | 版本 |
| type | TEXT | 类型(linux/windows等) |
| full_data | TEXT | 完整数据(JSON) |
| scanned_at | DATETIME | 扫描时间 |
| is_online | BOOLEAN | 是否在线 |
| last_online_time | DATETIME | 最后在线时间 |
| owner_id | INTEGER | 拥有者 ID |

### device_occupancies - 设备占用表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| merchant_id | TEXT | 商户 ID(唯一) |
| user_id | INTEGER | 用户 ID |
| purpose | TEXT | 占用目的 |
| start_time | DATETIME | 开始时间 |
| end_time | DATETIME | 结束时间 |

### device_claims - 设备认领表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| merchant_id | TEXT | 商户 ID |
| user_id | INTEGER | 用户 ID |
| status | TEXT | 状态(pending/approved/rejected) |
| created_at | DATETIME | 创建时间 |
| processed_at | DATETIME | 处理时间 |

### device_properties - 设备性质表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| merchant_id | TEXT | 商户 ID(唯一) |
| property | TEXT | 性质标签 |

### mobile_devices - 移动设备表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 设备名称 |
| device_type | TEXT | 设备类型 |
| sn | TEXT | 序列号 |
| image_a | TEXT | 图片 A |
| image_b | TEXT | 图片 B |
| occupier_id | INTEGER | 占用者 ID |
| purpose | TEXT | 占用目的 |

---

## 前端页面

| 路由 | 页面 | 描述 | 权限 |
|------|------|------|------|
| `/login` | LoginPage | 登录页面 | 公开 |
| `/register` | RegisterPage | 注册页面 | 公开 |
| `/` | ScanPage | 扫描页面(主页) | 登录 |
| `/mobile-devices` | MobileDevicesPage | 移动设备管理 | 登录 |
| `/linux-config/:merchantId` | LinuxConfigPage | Linux 配置管理 | 登录 |
| `/admin/users` | AdminUsersPage | 管理员页面 | 管理员 |

---

## 配置说明

### 后端环境变量

```env
# 服务器配置
PORT=5000
GIN_MODE=debug

# JWT 配置
JWT_SECRET_KEY=your-secret-key
JWT_ACCESS_TOKEN_EXPIRES=24      # 小时
JWT_REFRESH_TOKEN_EXPIRES=720    # 小时

# 数据库
DATABASE_PATH=data.db
```

### 前端配置 (vite.config.js)

```javascript
{
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': 'ws://localhost:5000'  // WebSocket 代理
    }
  }
}
```

---

## 部署说明

### 生产环境构建

```bash
# 后端
cd backend-go
go build -o pos-scanner cmd/server/main.go

# 前端
cd frontend
npm run build
# 产物在 dist/ 目录
```

### 静态文件服务

后端可以同时服务前端静态文件，将 `frontend/dist` 目录内容放到后端的 `static` 目录即可。

---

## 开发说明

### 添加新的 API 端点

1. 在 `internal/models/` 定义数据模型
2. 在 `internal/repository/` 创建数据访问层
3. 在 `internal/services/` 创建业务逻辑层
4. 在 `internal/handlers/` 创建 HTTP 处理器
5. 在 `cmd/server/main.go` 注册路由

### 添加新的前端页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/services/api.js` 添加 API 调用方法
3. 在 `src/App.jsx` 添加路由配置

---

## 更新日志

### v1.5.1.8 (当前版本)
- 优化设备详情弹窗 (DetailModal)
  - 自动过滤 null 值字段，只显示有效数据
  - 分类展示：公司信息、应用信息、设备实例、营业时间、图片资源
  - 设备实例以卡片形式展示，不同类型显示不同颜色标签
  - 添加加载状态和错误处理
- 优化后端数据过滤逻辑

### v1.5.1.7
- 重构后端为 Go Gin 框架
- 添加 Linux 远程管理功能
- 添加实时日志 WebSocket
- 添加用户管理功能
- 添加移动设备管理
- 优化 UI 设计为 Apple 风格

---

## 许可证

私有项目，仅供内部使用。
