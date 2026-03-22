# 面向 Java / Python 背景的项目快速上手指南

## 这份文档是给谁的

这份文档是写给下面这类同学的：

- 能读 Java、Python
- 不熟悉 Go
- 不熟悉 React
- 接手了这个项目，但希望尽快达到“能看懂、能定位、能小改”的状态

如果你正好是这种情况，不要先去系统学完整的 Go 和 React，再回来读项目。最快的方法是先把“这个项目在做什么、代码怎么组织、一个功能如何流转”看懂，再在阅读过程中补 Go/React 语法。

---

## 先用一句话理解项目

这是一个 POS 设备管理平台，核心能力包括：

- 扫描局域网中的 POS 设备
- 展示设备详情
- 管理设备归属、借用、审批
- 远程连接 Linux 设备并执行运维操作
- 管理升级包、备份、日志、数据库配置
- 提供工作台、通知和需求反馈能力

你可以把它理解成：

“设备资产管理 + 运维控制台 + 协作审批系统”

---

## 先看懂目录，不要先看语法

项目主要分成两部分：

- `frontend/`：前端，React + Vite
- `backend-go/`：后端，Go + Gin + GORM + SQLite

### 前端目录怎么理解

前端主要看这几个目录：

- `frontend/src/pages/`
  - 页面级组件
  - 可以理解成“每个菜单打开后看到的整页内容”

- `frontend/src/components/`
  - 可复用组件
  - 可以理解成页面里的表格、弹窗、功能块

- `frontend/src/contexts/`
  - 全局上下文
  - 类似全局状态或跨页面共享的数据
  - 例如登录状态、通知、Toast

- `frontend/src/services/`
  - 调后端 API 的地方
  - 如果你会 Python 里的 `requests` 或 Java 里的 HTTP client，这里就是统一封装调用逻辑的地方

### 后端目录怎么理解

后端可以直接按 Java 的经典分层去看：

- `backend-go/internal/handlers/`
  - 相当于 Controller
  - 负责收请求、校验参数、返回响应

- `backend-go/internal/services/`
  - 相当于 Service
  - 负责业务逻辑

- `backend-go/internal/repository/`
  - 相当于 DAO / Repository
  - 负责数据库读写

- `backend-go/internal/models/`
  - 相当于 Entity / Model
  - 负责定义数据库模型和业务对象

- `backend-go/internal/middleware/`
  - 中间件
  - 负责认证、日志、跨域、异常恢复等横切逻辑

- `backend-go/cmd/server/main.go`
  - 后端入口
  - 相当于 Spring Boot 里的启动类 + 路由注册总表

---

## 你最该先看的 3 个文件

如果你只有 30 分钟，先看这 3 个文件：

### 1. 前端总入口

`frontend/src/App.jsx`

它负责：

- 注册前端路由
- 定义页面入口
- 组合认证和通知上下文
- 决定哪些页面需要登录、哪些页面需要管理员权限

看完它，你就知道这个系统有哪些页面：

- 登录
- 注册
- POS 设备扫描页
- 移动设备页
- Linux 配置页
- 数据库配置页
- WAR 包管理页
- 工作台
- 帮助页
- 个人中心
- 管理中心
- 需求反馈页

### 2. 前端 API 总表

`frontend/src/services/api.js`

这个文件非常关键，因为它几乎就是“项目功能目录”。

它把接口按业务模块分成了：

- `scanAPI`
- `deviceAPI`
- `linuxAPI`
- `dbConfigAPI`
- `workspaceAPI`
- `notificationAPI`
- `featureRequestAPI`
- `borrowAPI`

如果你想搞懂某个页面在干什么，先看页面里调用了哪个 API，再回到这个文件找对应方法。

### 3. 后端总入口

`backend-go/cmd/server/main.go`

这个文件负责：

- 初始化配置
- 初始化日志
- 初始化数据库
- 自动建表
- 初始化 repository / service / handler
- 注册全部 API 路由

它最重要的价值不是代码本身，而是“全局地图”。

你在这里能快速知道：

- 登录接口有哪些
- 扫描接口有哪些
- Linux 管理接口有哪些
- 数据库配置接口有哪些
- 通知、借用、工作台接口有哪些

---

## 用 Java 思维翻译这个 Go 项目

如果你只会 Java，这里其实很好迁移：

### Java 里的 Controller

对应这里的：

- `internal/handlers/*.go`

例如：

- `internal/handlers/scan.go`
- `internal/handlers/auth.go`
- `internal/handlers/linux.go`

### Java 里的 Service

对应这里的：

- `internal/services/*.go`

例如：

- `internal/services/scan_service.go`
- `internal/services/auth_service.go`
- `internal/services/linux_service.go`

### Java 里的 Repository / DAO

对应这里的：

- `internal/repository/*.go`

例如：

- `internal/repository/device_repo.go`
- `internal/repository/user_repo.go`

### Java 里的 Entity

对应这里的：

- `internal/models/*.go`

例如：

- `internal/models/user.go`
- `internal/models/scan_result.go`

所以当你追一个后端功能时，可以直接套用这个阅读顺序：

1. 在 `main.go` 找路由
2. 找对应 `handler`
3. 看它调用了哪个 `service`
4. 再看它依赖了哪个 `repository`
5. 最后回到 `model`

这个顺序比从头扫代码高效得多。

---

## 用“页面 + 接口 + 状态”理解 React

你不用先把 React 学全。

在这个项目里，先抓住 3 个概念就够了：

### 1. 页面组件

就是 `pages/` 下面的文件，比如：

- `ScanPage.jsx`
- `LinuxConfigPage.jsx`
- `WorkspacePage.jsx`

它们负责：

- 展示整页
- 发起接口请求
- 管理页面自己的状态
- 组合多个子组件

### 2. 可复用组件

就是 `components/` 下面的文件，比如：

- `ScanTable.jsx`
- `DetailModal.jsx`
- `ConfirmDialog.jsx`

它们负责：

- 专注显示某一块 UI
- 接收父页面传进来的数据和事件

### 3. 状态

这里最常见的是：

- `useState`
  - 保存页面状态
  - 比如当前设备列表、是否正在扫描、弹窗是否打开

- `useEffect`
  - 在页面加载或依赖变化时执行逻辑
  - 比如页面加载时请求数据、开始轮询、检查登录状态

- `Context`
  - 存全局状态
  - 比如 `AuthContext`、`ToastContext`

如果你想用一句话记住 React 页面阅读法：

“先看 state 存了什么，再看 effect 什么时候请求数据，最后看 render 输出了什么”

---

## 推荐你先打通的第一条链路

最推荐先读的是：

`登录 -> 扫描设备 -> 查看设备详情 -> 进入 Linux 配置页`

原因有 3 个：

- 它覆盖了这个项目的核心业务
- 它能同时让你理解前端和后端如何配合
- 它比审批、通知、WAR 包管理更容易形成整体认识

---

## 扫描模块怎么读

扫描模块是非常适合入门的一条链路。

### 前端入口：`ScanPage.jsx`

文件：

- `frontend/src/pages/ScanPage.jsx`

这个页面负责：

- 获取本机 IP
- 发起扫描
- 轮询扫描状态
- 加载设备列表
- 搜索、过滤、分页
- 打开设备详情弹窗
- 发起占用、借用、POS 打开、备份恢复等操作

你读这个页面时，不要试图一次读完所有细节。优先只抓下面几块：

1. 页面初始化加载什么
2. 点“开始扫描”后发生什么
3. 扫描中的轮询逻辑是什么
4. 扫描完成后列表怎么刷新

### 前端 API：`scanAPI`

文件：

- `frontend/src/services/api.js`

关键方法包括：

- `getLocalIPs`
- `startScan`
- `getScanStatus`
- `stopScan`
- `getDeviceDetails`

你可以把它理解成：

“ScanPage 的按钮动作，最终都会落到这里的某个 HTTP 请求上”

### 后端入口：`ScanHandler`

文件：

- `backend-go/internal/handlers/scan.go`

这里负责：

- 接收前端传来的请求
- 校验参数
- 调用扫描服务
- 把结果保存到数据库
- 返回统一响应

比如：

- `StartScan`
  - 收到 `local_ip`
  - 调用 `scanService.StartScan`
  - 扫描过程中把结果写入数据库
  - 扫描结束后更新扫描时间和设备在线状态

- `GetScanStatus`
  - 返回当前扫描进度

- `GetDeviceDetails`
  - 根据 IP 拉取详细信息

### 后端核心业务：`ScanService`

文件：

- `backend-go/internal/services/scan_service.go`

这是扫描的核心逻辑。

它主要做了几件事：

1. 根据本机 IP 推导要扫描的网段
2. 生成要探测的主机列表
3. 并发探测哪些 IP 的目标端口可访问
4. 对可访问的设备继续发 HTTP 请求拿设备信息
5. 提取商户号、名称、版本等核心字段
6. 更新扫描进度和结果

这里你会第一次碰到 Go 的并发，但不要害怕。你可以先把它理解成：

- 第一批并发：探测端口是否开放
- 第二批并发：请求设备详情

如果你会 Java，可以把它类比成：

- 线程池 + 任务队列 + 共享状态更新

只不过 Go 用的是：

- goroutine
- channel
- mutex

---

## Linux 管理模块怎么读

这是第二条推荐你读的链路。

### 前端入口：`LinuxConfigPage.jsx`

文件：

- `frontend/src/pages/LinuxConfigPage.jsx`

页面负责：

- 根据 `merchantId` 进入某个设备的 Linux 管理页
- 先做 SSH 连接
- 连接成功后展示多个 tab

几个 tab 大致代表：

- `control`
  - POS 启停、重启

- `upgrade`
  - 升级部署

- `backup`
  - 备份恢复

- `logs`
  - 日志查看

- `version`
  - 版本信息查看

你可以先把这个页面理解成一个“远程运维控制台”。

### 后端接口分组：`/api/linux`

在 `main.go` 里，这一组接口很多，但其实就是围绕远程 Linux 运维展开。

例如：

- 连接管理
- POS 控制
- 上传 WAR
- 备份恢复
- 日志查看
- 配置管理
- 升级任务
- 系统信息

你的阅读策略不是把所有接口一次看完，而是跟着页面 tab 一块块追。

---

## 认证模块怎么读

如果你想先理解登录状态怎么维持，建议看下面几个文件：

- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/services/authService.js`
- `frontend/src/services/authClient.js`
- `backend-go/internal/handlers/auth.go`
- `backend-go/internal/services/auth_service.go`
- `backend-go/internal/middleware/auth.go`

你重点关心这几个问题：

1. 登录成功后 token 存在哪
2. 前端发请求时怎么自动带 token
3. token 过期后怎么处理
4. 后端怎么从 token 里识别当前用户
5. 哪些接口需要管理员权限

只要把这 5 个问题弄清楚，后面看任何页面都会轻松很多。

---

## 工作台 / 借用 / 审批模块怎么读

这个模块体现的是“业务规则”，不是技术难点。

你可以重点理解：

- 谁能借设备
- 谁能审批
- 借用和占用的区别是什么
- 管理员和普通用户的行为差异是什么

这一类代码通常分散在：

- `frontend/src/pages/WorkspacePage.jsx`
- `frontend/src/components/workspace/*`
- `frontend/src/services/api.js` 里的 `borrowAPI`、`workspaceAPI`
- `backend-go/internal/handlers/borrow.go`
- `backend-go/internal/services/borrow_service.go`

读这块代码时，最有效的方法不是背接口，而是先把“角色”和“流程图”画出来。

例如：

- 普通用户可以提交借用申请
- 管理员可以审批
- 负责人、借用人、管理员对设备的可操作范围不同

---

## 你现在最需要学的 Go 知识

不需要全学，只补下面这些就够开始读项目：

### 第一批

- 结构体 `struct`
- 方法定义
- 指针 `*`
- 切片 `[]`
- map
- `if err != nil`

### 第二批

- 接口 `interface{}`
- JSON tag
- goroutine
- channel
- `sync.Mutex`

### 第三批

- package 组织方式
- 构造函数风格 `NewXXX`
- 错误返回模式

你会发现这个项目的 Go 代码整体是“工程化 + 朴素分层”的风格，不是那种特别炫技的写法，所以对 Java 程序员其实很友好。

---

## 你现在最需要学的 React 知识

同样不需要全学，只补能支撑你看项目的部分：

### 第一批

- 函数组件
- JSX
- props
- `useState`
- `useEffect`

### 第二批

- 条件渲染
- 列表渲染
- 表单输入绑定
- 事件处理

### 第三批

- Context
- 路由
- 组件拆分

这个项目里最常见的页面模式其实就是：

1. 初始化时请求数据
2. 把结果存进 state
3. 点按钮再调用接口
4. 成功后刷新列表或更新局部状态

你把这个模式认出来后，很多 React 页面都会“长得差不多”。

---

## 7 天快速学习计划

下面这套路线适合“先能上手，再逐步理解”。

### 第 1 天：建立全局地图

只看：

- `frontend/src/App.jsx`
- `frontend/src/services/api.js`
- `backend-go/cmd/server/main.go`

目标：

- 知道有哪些页面
- 知道有哪些接口模块
- 知道前后端模块如何对应

### 第 2 天：打通登录链路

只看：

- `AuthContext.jsx`
- `authService.js`
- `authClient.js`
- 后端 auth 相关 handler / service / middleware

目标：

- 搞清楚登录、登出、权限校验、token 传递

### 第 3 天：打通扫描链路

只看：

- `ScanPage.jsx`
- `scan.go`
- `scan_service.go`

目标：

- 看懂前端如何发起扫描
- 看懂后端如何并发扫描和保存结果

### 第 4 天：打通 Linux 管理链路

只看：

- `LinuxConfigPage.jsx`
- `components/linux/*`
- 后端 linux handler / service

目标：

- 看懂 SSH 连接、POS 控制、日志、备份、升级的大致流程

### 第 5 天：打通借用审批链路

只看：

- `WorkspacePage.jsx`
- `borrowAPI`
- 后端 borrow 相关代码

目标：

- 看懂角色、借用申请、审批和状态变化

### 第 6 天：做一个极小改动

建议改下面这类低风险内容：

- 页面文案
- 按钮显示条件
- 表格列顺序
- 默认筛选条件

目标：

- 完成第一次“自己改并跑起来”

### 第 7 天：做一个小功能或小修复

建议选择：

- 给列表新增一个字段展示
- 给接口多传一个已有字段
- 调整一个页面交互

目标：

- 形成“我已经能动这个项目”的信心

---

## 阅读代码时的固定问法

每次看一段代码，只问自己下面几个问题：

### 看前端页面时

1. 这个页面负责展示什么
2. 页面加载时会请求哪些接口
3. 用户点哪个按钮会触发什么动作
4. 数据存在什么 state 里
5. 成功或失败后页面怎么更新

### 看后端 handler 时

1. 这个接口接收什么参数
2. 参数在哪里校验
3. 它调用了哪个 service
4. 它最后返回了什么结构

### 看后端 service 时

1. 真正的业务逻辑是什么
2. 它依赖哪些 repository
3. 有没有并发、超时、重试、权限等关键逻辑
4. 它改动了哪些数据

### 看 repository 时

1. 查的是哪张表
2. 条件是什么
3. 更新了哪些字段

只要你始终这样问，阅读效率会高很多。

---

## 第一批建议你收藏的文件

推荐先反复看这些文件：

- `frontend/src/App.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/services/api.js`
- `frontend/src/pages/ScanPage.jsx`
- `frontend/src/pages/LinuxConfigPage.jsx`
- `backend-go/cmd/server/main.go`
- `backend-go/internal/handlers/scan.go`
- `backend-go/internal/services/scan_service.go`

如果这 8 个文件你看顺了，整个项目就已经不再陌生了。

---

## 你现阶段不需要做的事

为了节省时间，下面这些事先不要做：

- 不要先系统学完整 Go 语法
- 不要先系统学完整 React 原理
- 不要一开始就通读全部文件
- 不要先研究所有测试
- 不要先研究全部 Linux / WAR / DB 配置细节

这些都很容易让你“看了很多，但没有形成项目理解”。

---

## 最后给你的学习原则

这套项目的最佳学习策略不是：

“先学语言，再学项目”

而是：

“先学项目骨架，再按需要补语言知识”

你已经会 Java 和 Python，这意味着你真正缺的不是软件工程思维，而只是：

- 对 Go 的语法熟悉度
- 对 React 页面组织方式的熟悉度

这两个差距都可以在读项目的过程中补上。

所以你的目标不是一周内变成 Go/React 专家，而是先做到下面这三件事：

- 能找到一个功能的前后端入口
- 能顺着调用链把逻辑追下去
- 能安全地做小修改

做到这一步，你就已经完成了“接手这个项目”的第一阶段。

---

## 下一步建议

建议你接下来继续做这两件事中的一件：

1. 精读扫描模块
   - 目标：看懂一条完整业务链

2. 精读登录认证模块
   - 目标：看懂系统权限和请求机制

如果你愿意，我可以继续给你补下一篇文档：

- `扫描模块精读.md`
- `认证模块精读.md`
- `Linux 管理模块精读.md`

建议优先写“扫描模块精读”。
