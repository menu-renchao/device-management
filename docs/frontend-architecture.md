# 前端架构详解

> 文档版本：v1.0 | 更新日期：2026-03-05

---

## 1. 目录结构

```
frontend/
├── index.html                   # Vite 入口 HTML
├── vite.config.js               # Vite 配置（代理、端口）
├── package.json
└── src/
    ├── App.jsx                  # 根组件：路由配置、导航栏、布局
    ├── App.css                  # 全局样式
    ├── main.jsx                 # React 挂载入口
    │
    ├── pages/                   # 页面级组件（与路由一一对应）
    │   ├── LoginPage.jsx        # 登录
    │   ├── RegisterPage.jsx     # 注册
    │   ├── ScanPage.jsx         # POS 设备扫描（主页）
    │   ├── LinuxConfigPage.jsx  # Linux 远程控制
    │   ├── MobileDevicesPage.jsx # 移动设备管理
    │   ├── WarPackageManagePage.jsx # WAR 包管理
    │   ├── WorkspacePage.jsx    # 工作台（我的借用、我的设备）
    │   ├── BorrowApprovalPage.jsx # 借用审批
    │   ├── AdminUsersPage.jsx   # 管理员用户管理
    │   ├── ProfilePage.jsx      # 个人中心
    │   └── HelpPage.jsx         # 帮助中心
    │
    ├── components/              # 可复用组件
    │   ├── auth/
    │   │   └── PrivateRoute.jsx  # 路由守卫（PrivateRoute / AdminRoute / PublicRoute）
    │   ├── linux/               # Linux 控制页面子组件
    │   │   ├── UpgradeTab.jsx
    │   │   ├── BackupTab.jsx
    │   │   └── WarPackageManager.jsx
    │   ├── workspace/           # 工作台子组件
    │   │   ├── MyBorrowsTab.jsx
    │   │   ├── MyDevicesTab.jsx
    │   │   └── PendingApprovalsTab.jsx
    │   ├── ScanTable.jsx        # 设备列表表格
    │   ├── DetailModal.jsx      # 设备详情弹窗
    │   ├── NotificationBell.jsx # 通知铃铛组件
    │   ├── ConfirmDialog.jsx    # 自定义确认对话框
    │   └── ToastContainer.jsx   # Toast 消息容器
    │
    ├── contexts/                # React Context 全局状态
    │   ├── AuthContext.jsx      # 用户认证状态
    │   ├── NotificationContext.jsx # 通知状态
    │   └── ToastContext.jsx     # Toast/Confirm 通知
    │
    └── services/
        ├── api.js               # 所有 API 调用（按模块分组导出）
        └── authService.js       # 登录/注册/Token 管理
```

---

## 2. 路由结构

```
/login              → LoginPage          (PublicRoute，已登录自动跳转首页)
/register           → RegisterPage       (PublicRoute)
/                   → ScanPage           (PrivateRoute，登录用户)
/mobile             → MobileDevicesPage  (PrivateRoute)
/linux-config/:merchantId → LinuxConfigPage (PrivateRoute)
/war-packages       → WarPackageManagePage (PrivateRoute)
/workspace          → WorkspacePage      (PrivateRoute)
/borrow-approval    → BorrowApprovalPage (PrivateRoute)
/help               → HelpPage           (PrivateRoute)
/profile            → ProfilePage        (PrivateRoute)
/admin/users        → AdminUsersPage     (AdminRoute，仅管理员)
*                   → 重定向到 /
```

### 路由守卫

| 守卫组件 | 未满足条件时 | 使用场景 |
|---------|------------|---------|
| `PrivateRoute` | 跳转 `/login` | 需要登录的页面 |
| `AdminRoute` | 跳转 `/` | 仅管理员可访问页面 |
| `PublicRoute` | 已登录跳转 `/` | 登录/注册页（避免重复登录） |

---

## 3. 状态管理

项目采用 **React Context + localStorage** 方案，无 Redux/Zustand 等外部状态库。

### AuthContext

管理全局用户认证状态：

```jsx
const { user, isAdmin, login, logout } = useAuth();
```

| 字段/方法 | 类型 | 说明 |
|----------|------|------|
| `user` | Object \| null | 当前登录用户信息 |
| `isAdmin()` | Function | 是否为管理员 |
| `login(username, password)` | async Function | 登录，写入 localStorage |
| `logout()` | async Function | 登出，清除 token |

Token 存储：`localStorage.access_token` / `localStorage.refresh_token`

### NotificationContext

管理通知铃铛的未读数量，定时轮询后端：

```jsx
const { unreadCount, refreshCount } = useNotification();
```

### ToastContext

替代浏览器原生对话框的全局通知系统（详见[开发规范](./development-guide.md)）：

```jsx
const toast = useToast();

toast.success('操作成功');
toast.error('操作失败');
const ok = await toast.confirm('确定删除吗？', { title: '删除确认' });
```

---

## 4. API 服务层

所有 API 调用集中在 `src/services/api.js`，按业务模块分组导出：

| 导出对象 | 对应后端模块 |
|---------|------------|
| `scanAPI` | `/api/scan/*`, `/api/devices` |
| `deviceAPI` | `/api/device/*`, `/api/mobile/*` |
| `linuxAPI` | `/api/linux/*` |
| `workspaceAPI` | `/api/workspace/*` |
| `notificationAPI` | `/api/notifications/*` |

### Axios 实例与拦截器

```
api (axios 实例)
  ├── baseURL: /api
  ├── 请求拦截：自动注入 Authorization: Bearer <token>
  └── 响应拦截：401 → 自动清除 token 并跳转 /login

createAuthAxios() → 动态创建带 token 的实例（用于特殊请求）
```

**设计说明**：部分接口（如文件上传）使用全局 `axios` 实例直接调用，同样注册了 401 拦截器。

### 实时通信

| 技术 | 使用场景 | 前端处理 |
|------|---------|---------|
| WebSocket (`gorilla/websocket`) | 实时日志查看 | 原生 `WebSocket` API |
| SSE (Server-Sent Events) | 升级任务进度 | 原生 `EventSource` API，URL 通过 `linuxAPI.getUpgradeStreamUrl(taskId)` 获取 |
| HTTP 轮询 | 扫描进度、WAR 下载进度 | `setInterval` 每秒请求 |

---

## 5. 组件设计规范

### 页面组件 (pages/)

- 负责数据加载、状态管理
- 调用 `services/api.js` 中的 API 方法
- 将数据以 props 传递给展示组件

### 展示组件 (components/)

- 无状态或局部状态
- 通过 props 接收数据和回调
- 不直接调用 API

### 重要组件说明

**ScanTable.jsx**  
设备列表核心表格，支持：
- 分页（前端分页）
- 关键字搜索
- 在线/离线状态展示
- 设备类型颜色标记
- 行操作（查看详情、Linux 配置、借用、删除）

**DetailModal.jsx**  
设备详情弹窗，自动过滤 null 值字段，分类展示：
- 公司信息（名称、商户ID、地址等）
- 应用信息（版本、许可状态）
- 设备实例列表（POS/KIOSK/EMENU，不同类型颜色标签）
- 营业时间
- 图片资源

**LinuxConfigPage.jsx**  
Linux 远程管理页面，Tab 结构：
- 连接管理
- POS 控制
- 升级（SSE 进度）
- 备份/恢复
- 实时日志（WebSocket）
- 配置文件管理
- 版本信息

---

## 6. UI 设计系统

本项目采用自研 **Apple 风格**组件，无 Ant Design / Material UI 等第三方 UI 库。

### 设计原则

- 圆角卡片布局，大量留白
- 半透明毛玻璃导航栏（`backdrop-filter: blur`）
- 颜色系统遵循 Apple HIG：`#1D1D1F`（主文字）、`#86868B`（次要文字）、`#007AFF`（主色）、`#FF3B30`（危险色）
- 所有样式以 inline style 对象形式定义（避免 CSS 类名冲突）

### 字体与颜色

| 用途 | 颜色 |
|------|------|
| 主要文字 | `#1D1D1F` |
| 次要文字 | `#86868B` |
| 主品牌色 | `#007AFF` |
| 危险操作 | `#FF3B30` |
| 成功状态 | `#34C759` |
| 警告状态 | `#FF9F0A` |
| 背景色 | `#F5F5F7` |
| 卡片背景 | `#FFFFFF` |

---

## 7. Vite 代理配置

开发环境所有请求通过 Vite 代理转发，无跨域问题：

```js
proxy: {
  '/api': 'http://localhost:5000',          // REST API
  '/api/linux/upgrade/stream': {            // SSE 特殊配置
    target: 'http://localhost:5000',
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Connection', 'keep-alive');
        proxyReq.setHeader('Cache-Control', 'no-cache');
      });
    }
  },
  '/uploads': 'http://localhost:5000',      // 静态图片
  '/ws': { target: 'ws://localhost:5000', ws: true }  // WebSocket
}
```

---

## 8. 构建与部署

```bash
# 开发
npm run dev       # 启动 Vite dev server（:3000）

# 生产构建
npm run build     # 输出到 frontend/dist/
npm run preview   # 本地预览构建产物
```

生产部署时，将 `dist/` 内容复制到后端 `static/` 目录，由 Go 服务直接提供静态文件服务，无需单独 Node.js 进程。
