# 扫描模块精读

## 这份文档解决什么问题

这份文档不是为了完整介绍扫描模块的全部细节，而是为了帮你做到下面三件事：

- 看懂“扫描设备”这条前后端链路
- 知道出了问题应该先看哪里
- 能开始做小范围修改

如果你只会 Java / Python，这份文档建议你配合下面这些文件一起看：

- `frontend/src/pages/ScanPage.jsx`
- `frontend/src/services/api.js`
- `frontend/src/components/ScanTable.jsx`
- `backend-go/cmd/server/main.go`
- `backend-go/internal/handlers/scan.go`
- `backend-go/internal/handlers/device.go`
- `backend-go/internal/services/scan_service.go`

---

## 先用一句话理解扫描模块

扫描模块做的事情是：

“根据本机 IP 推导局域网网段，探测哪些设备开放了目标端口，再去这些设备上取 POS 信息，并把结果落库后返回给前端展示。”

你可以把它拆成 4 段：

1. 前端发起扫描
2. 后端并发探测设备
3. 后端把结果写进数据库
4. 前端轮询进度并刷新设备列表

---

## 先看整体调用链

推荐你按这个顺序追代码：

1. `ScanPage.jsx`
2. `api.js` 里的 `scanAPI`
3. `main.go` 里的 `/api/scan`
4. `scan.go`
5. `scan_service.go`
6. `device.go` 里的设备列表接口
7. `ScanTable.jsx`

把它翻译成一句更直白的话就是：

“页面点按钮 -> 调接口 -> 后端开始扫描 -> 数据写库 -> 页面拿进度 -> 页面重新加载列表”

---

## 一、前端入口：`ScanPage.jsx`

文件：

- `frontend/src/pages/ScanPage.jsx`

这是扫描模块的总控页面。

它做的事情很多，但你第一次读时，重点只看下面这些职责：

- 加载本机 IP 列表
- 发起扫描
- 停止扫描
- 轮询扫描状态
- 加载设备列表
- 搜索、过滤、分页
- 打开设备详情、Linux 配置、数据库配置

### 1. 页面初始化时做什么

页面一加载，主要会做两类事情：

第一类是加载环境信息：

- 获取本机 IP 列表
- 选择默认 IP

第二类是加载历史数据：

- 获取设备列表
- 获取筛选项
- 如果是管理员，还会加载自动扫描配置和历史任务

也就是说，这个页面不是“只有点扫描按钮才工作”，而是本身也是设备总览页。

### 2. 点“开始扫描”后做什么

`startScan` 的逻辑大致是：

1. 检查是否选择了本机 IP
2. 把页面状态切到“正在扫描”
3. 清空当前设备列表显示
4. 调用 `scanAPI.startScan(selectedIP)`
5. 如果失败，恢复扫描状态

这里有个很重要的点：

前端并不会等扫描结果一次性返回。

它只是告诉后端“开始扫描”，然后进入轮询。

### 3. 扫描中怎么更新进度

页面里有一个 `useEffect` 会在 `isScanning === true` 时启动定时轮询。

轮询做的事情是：

- 调 `scanAPI.getScanStatus()`
- 拿到当前进度
- 更新当前正在扫的 IP
- 如果后端状态里已经带有结果，就把结果先展示出来
- 如果扫描结束，再重新加载设备列表

这个设计很典型：

- 扫描是异步任务
- 前端靠轮询拿实时状态
- 最终以数据库中的正式设备列表为准

### 4. 页面里为什么还有很多别的功能

你会发现 `ScanPage.jsx` 非常大，因为它不仅负责扫描，还承载了：

- 设备详情弹窗
- 占用 / 借用操作
- 设备归属操作
- POS 打开模式
- 自动扫描配置
- 数据库备份恢复入口
- License 备份恢复入口

这意味着：

`ScanPage` 不是单纯的“扫描页”，而是“设备主工作台”。

所以你第一次读时，不要想把整个文件一次看完。建议先只锁定下面 5 个函数或逻辑块：

- 获取本机 IP
- `loadDevices`
- `startScan`
- `stopScan`
- 扫描状态轮询 `useEffect`

---

## 二、前端 API：`scanAPI`

文件：

- `frontend/src/services/api.js`

扫描模块对应的接口封装非常直接，主要是这些：

- `getLocalIPs`
- `startScan`
- `getScanStatus`
- `stopScan`
- `getDeviceDetails`
- `getAutoConfig`
- `updateAutoConfig`
- `getJobs`
- `runAutoScan`

### 你应该怎么看这个文件

你不用关心 Axios 的细节，重点只看三件事：

1. 请求地址是什么
2. 请求方法是什么
3. 传了哪些参数

例如：

- `startScan(localIP)`
  - 发到 `/scan/start`
  - 请求体带 `local_ip`

- `getScanStatus()`
  - 发到 `/scan/status`
  - 不带复杂参数

- `getDeviceDetails(ip)`
  - 发到 `/scan/device/:ip/details`

所以如果你在页面里看到一个按钮行为不理解，先回到 `api.js` 看它打了哪个接口，问题会立刻清晰很多。

---

## 三、后端路由入口：`main.go`

文件：

- `backend-go/cmd/server/main.go`

扫描模块在后端是这样注册的：

- `/api/scan/ips`
- `/api/scan/start`
- `/api/scan/status`
- `/api/scan/stop`
- `/api/scan/device/:ip/details`

管理员额外还有：

- `/api/scan/auto-config`
- `/api/scan/jobs`
- `/api/scan/auto-run`

另外，设备总列表不在 `/api/scan` 下，而是在：

- `/api/devices`
- `/api/devices/filter-options`

这个点要特别记住。

因为很多人第一次看会以为：

“扫描结果列表接口应该也在 `/scan` 下面”

但这个项目不是这么设计的。它把“扫描动作”和“设备主列表”拆开了：

- `/scan/*`：处理扫描流程
- `/devices*`：处理正式设备列表展示

---

## 四、后端入口：`ScanHandler`

文件：

- `backend-go/internal/handlers/scan.go`

如果你按 Java 思维理解，这一层就是 Controller。

### `GetLocalIPs`

作用：

- 获取当前机器可用的本地 IPv4 地址

前端为什么需要它：

- 因为手动扫描要基于本机 IP 推导扫描网段

### `StartScan`

这是扫描模块最核心的入口。

它做的事情可以拆成下面几步：

1. 解析前端传来的 `local_ip`
2. 校验参数
3. 调用 `scanService.StartScan`
4. 给扫描服务传一个回调函数
5. 每发现一个设备时，通过回调把结果写入数据库
6. 启动一个 goroutine 监听扫描是否结束
7. 扫描结束后更新离线状态和最后扫描时间

这个回调设计很重要。

因为扫描过程不是“全部完成后一次入库”，而是：

- 扫到一个
- 处理一个
- 入库一个

这样前端和数据库都能更早看到结果。

### `GetScanStatus`

作用：

- 返回当前扫描状态

内容包括：

- 是否还在扫描
- 当前进度
- 当前正在处理的 IP
- 已获取到的结果
- 错误信息
- 是否被取消

前端轮询拿到的就是它。

### `StopScan`

作用：

- 通知扫描服务停止当前任务

### `GetDeviceDetails`

作用：

- 根据 IP 到设备上重新拉一份详细数据

它和设备列表里的简要信息不是一回事。

设备列表主要展示精简字段，例如：

- merchantId
- 名称
- 版本
- 类型

而详情接口拿的是更完整的原始信息，再做一层空值过滤。

### 自动扫描相关接口

管理员还可以通过同一个 handler 管理自动扫描：

- 查看自动扫描配置
- 更新自动扫描配置
- 查看自动扫描任务历史
- 手动触发一次自动扫描

所以 `ScanHandler` 其实同时承载了两类职责：

- 手动扫描
- 自动扫描配置与任务管理

---

## 五、真正的核心：`ScanService`

文件：

- `backend-go/internal/services/scan_service.go`

如果整个扫描模块只允许你精读一个后端文件，那就是这个。

它是真正执行网络扫描的地方。

---

## 六、`ScanService` 的核心数据结构

### `ScanStatus`

这个结构体是“扫描任务的运行时状态”。

里面最关键的字段有：

- `IsScanning`
- `Progress`
- `CurrentIP`
- `Results`
- `Error`
- `WasCancelled`
- `MerchantIDs`

你可以把它理解成一个内存中的任务状态对象，前端轮询时看到的就是它。

### `ScanRunConfig`

这是扫描配置对象。

包含：

- 扫描触发方式
- CIDR 网段列表
- 目标端口
- 连接超时
- 请求超时
- 端口探测 worker 数
- 信息抓取 worker 数

这意味着扫描服务本身既能处理“手动扫描”，也能处理“自动扫描”。

---

## 七、手动扫描是怎么开始的

`StartScan(localIP, onResult)` 内部主要做两件事：

1. 先把本机 IP 转成默认扫描配置
2. 再走统一的 `RunScanWithConfig`

### `buildManualScanConfig`

这里的关键点是：

- 它会把本机 IP 变成一个 `/23` 网段

例如本机 IP 是某个局域网地址，它会默认扫描这个地址所在的 `/23` 范围。

这不是用户手动输网段，而是系统帮你推导。

### `RunScanWithConfig`

这是统一入口。

它主要负责：

- 检查当前是否已有扫描进行中
- 校验 CIDR 是否合法
- 补默认参数
- 重置扫描状态
- 创建 `context` 和取消函数
- 开 goroutine 真正执行扫描

你可以把它理解成：

“准备任务运行环境，然后把耗时工作异步丢出去”

---

## 八、扫描真正是怎么做的

`performScan` 可以分成两个阶段。

### 阶段 1：探测哪些 IP 开放了目标端口

这一步做的事情是：

1. 根据 CIDR 生成所有主机地址
2. 去重
3. 用 worker pool 并发探测端口
4. 把开放端口的 IP 收集起来

默认关键参数是：

- 端口：`22080`
- 连接超时：`2 秒`
- 端口探测 worker：`200`

你可以把这一步理解成：

“先从整个局域网里筛出疑似 POS 设备”

### 阶段 2：对开放端口的设备抓详情

这一步做的事情是：

1. 对开放端口的 IP 再开一组 worker
2. 调设备上的 HTTP 接口抓公司 / POS 信息
3. 再调一个接口判断设备 OS
4. 把提取后的结果写进 `status.Results`
5. 通过回调交给 handler 入库

默认关键参数是：

- 抓详情 worker：`100`
- 请求设备详情接口
- 请求设备 OS 类型接口

你可以把这一步理解成：

“第一阶段筛出了候选设备，第二阶段再确认它是不是我们要的设备，并提取关键信息”

---

## 九、为什么这里要用并发

因为扫描网络本质上是 I/O 密集型操作：

- 建 TCP 连接
- 等超时
- 发 HTTP 请求
- 等响应

如果串行扫一个网段，会非常慢。

所以这里的 Go 并发不是为了炫技，而是非常合理的工程选择。

如果用 Java 类比，你可以想成：

- 一个线程池做端口探测
- 另一个线程池做详情抓取
- 中间通过共享队列和状态对象协作

Go 这里对应的实现方式是：

- goroutine
- channel
- mutex

你第一次读时不需要把每一行并发代码吃透，只要先抓住这个业务意图就够了。

---

## 十、设备信息是怎么拿到的

### `fetchCompanyProfile`

它会请求设备上的一个 HTTP 地址：

- `http://ip:22080/kpos/webapp/store/fetchCompanyProfile`

主要作用：

- 获取设备完整业务信息

这说明这个项目不是靠 ping 或 SSH 识别设备，而是靠设备暴露的业务接口来识别。

### `guessOS`

它会请求另一个接口：

- `http://ip:22080/kpos/webapp/os/getOSType`

主要作用：

- 获取设备 OS 类型

### `extractRequiredInfo`

从完整响应里抽出页面和数据库最关心的字段，例如：

- merchantId
- name
- version

也就是说，扫描服务做了两层数据处理：

1. 取完整原始数据
2. 再提炼出业务需要的关键字段

---

## 十一、为什么设备列表接口单独存在

虽然扫描过程里已经能拿到结果，但页面最终显示的设备列表走的是：

- `/api/devices`

对应后端文件：

- `backend-go/internal/handlers/device.go`

这样设计的好处是：

- 扫描流程和设备展示解耦
- 列表可以支持分页、搜索、筛选
- 列表可以混合数据库里的归属、占用、分类等业务字段

也就是说：

- 扫描接口只关心“发现设备”
- 设备列表接口关心“面向用户展示的完整设备视图”

---

## 十二、设备列表为什么比扫描结果复杂

因为扫描到的原始结果，只包含一部分基础信息。

真正显示在列表里的内容，还会叠加很多业务信息，例如：

- 是否在线
- 负责人
- 借用状态
- 归还时间
- 分类标签
- 是否有权限进入 Linux 配置页

前端这部分主要体现在：

- `ScanPage.jsx`
- `ScanTable.jsx`

### `ScanTable.jsx` 负责什么

它主要负责设备表格展示和行级操作：

- 打开 POS
- 查看详情
- 进入 Linux 配置
- 进入数据库配置
- 编辑分类
- 借用 / 释放
- 删除设备
- 管理 License 备份
- 管理数据库备份恢复

这里你可以看出一个重要事实：

“扫描模块的 UI 不只是扫描结果表格，它是设备管理入口表”

所以如果你以后要改设备行上的按钮、权限、文案、展示顺序，基本都要看 `ScanTable.jsx`。

---

## 十三、扫描完成后为什么还要更新数据库状态

在 `ScanHandler.StartScan` 里，扫描启动后会再开一个 goroutine，专门等待扫描结束。

扫描结束后，它会做两件关键事：

### 1. 标记离线设备

如果扫描是正常完成、不是用户取消的，那么后端会把本次没扫到的设备标记为离线。

这件事很关键。

因为在线状态不是一个永久真值，而是“基于最近一次扫描结果推导出来的”。

### 2. 更新最后扫描时间

它会更新扫描会话的最后扫描时间。

前端展示“上次扫描时间”时，就会依赖这类信息。

---

## 十四、自动扫描和手动扫描的关系

这个模块里同时存在两种扫描：

### 手动扫描

特点：

- 用户在页面点按钮触发
- 基于当前机器 IP 推导扫描网段

### 自动扫描

特点：

- 管理员配置固定 CIDR 范围
- 后台定时调度
- 记录任务历史

这两者共用同一个扫描服务，所以核心扫描逻辑没有重复实现。

也就是说：

- 扫描怎么做：共用 `ScanService`
- 扫描什么时候触发：由手动页面或自动调度器决定

这个设计是合理的，因为它把“执行逻辑”和“触发方式”拆开了。

---

## 十五、如果你要查 Bug，优先看哪里

下面给你一个非常实用的排查路径。

### 场景 1：点开始扫描没反应

先看：

1. `ScanPage.jsx` 的 `startScan`
2. `api.js` 的 `scanAPI.startScan`
3. `scan.go` 的 `StartScan`

重点问自己：

- 前端有没有把 `selectedIP` 传出去
- 后端有没有收到 `local_ip`
- 当前是不是已经有扫描在进行中

### 场景 2：进度条不动

先看：

1. `ScanPage.jsx` 的轮询 `useEffect`
2. `scan.go` 的 `GetScanStatus`
3. `scan_service.go` 里的状态更新

重点问自己：

- 前端有没有轮询
- 后端状态里的 `Progress` 有没有更新
- `IsScanning` 有没有提前被置回 `false`

### 场景 3：能扫到设备，但列表里没有

先看：

1. `scan.go` 的 `saveScanResult`
2. `deviceRepo` 写库逻辑
3. `/api/devices` 列表接口

重点问自己：

- 扫描结果有没有回调入库
- merchantId 是否为空
- 设备列表查询条件是否把它过滤掉了

### 场景 4：设备详情打开失败

先看：

1. `ScanTable.jsx` 或 `ScanPage.jsx` 的详情触发逻辑
2. `scanAPI.getDeviceDetails`
3. `scan.go` 的 `GetDeviceDetails`
4. `scan_service.go` 的 `FetchDeviceDetails`

### 场景 5：某些设备总是识别不到

先看：

1. 目标端口是否真是 `22080`
2. `fetchCompanyProfile` 接口是否能返回预期结构
3. `extractRequiredInfo` 是否提取失败

这种问题很多时候不是“扫描没扫到”，而是“扫到了，但业务字段没提取出来”。

---

## 十六、如果你要改功能，优先从哪些点入手

下面这些改动相对适合入门：

### 低风险改动

- 调整扫描页文案
- 调整列表列顺序
- 调整默认分页大小
- 调整默认筛选行为
- 修改按钮显示条件

### 中风险改动

- 新增一个设备列表字段展示
- 在详情里展示更多 `fullData` 字段
- 调整扫描完成后的提示文案

### 较高风险改动

- 修改 CIDR 推导逻辑
- 修改端口探测并发数和超时
- 修改设备识别规则
- 修改在线 / 离线标记逻辑

如果你刚接手项目，建议先从低风险改动开始建立信心。

---

## 十七、阅读这个模块时最该记住的几个点

### 点 1

扫描模块不是“只扫一下就结束”，而是：

- 启动扫描
- 持续更新状态
- 边扫边入库
- 扫完刷新正式列表

### 点 2

`/api/scan/*` 和 `/api/devices*` 是两套职责不同的接口。

### 点 3

`ScanPage.jsx` 不只是扫描页面，它还是设备主工作台。

### 点 4

真正的扫描核心在 `scan_service.go`，而不是 handler。

### 点 5

很多“扫不到设备”的问题，其实是：

- 端口不通
- 业务接口没响应
- 返回结构和提取逻辑不匹配

而不一定是前端问题。

---

## 十八、推荐你的精读顺序

如果你准备真正把这个模块吃透，建议按这个顺序精读：

1. `frontend/src/pages/ScanPage.jsx`
2. `frontend/src/services/api.js` 里的 `scanAPI`
3. `backend-go/cmd/server/main.go` 里的扫描路由
4. `backend-go/internal/handlers/scan.go`
5. `backend-go/internal/services/scan_service.go`
6. `backend-go/internal/handlers/device.go`
7. `frontend/src/components/ScanTable.jsx`

每读一层，只回答 3 个问题：

1. 输入是什么
2. 逻辑在哪
3. 输出给谁

如果你能稳定这样读，扫描模块很快就会变得清晰。

---

## 下一步建议

在看完这份文档后，建议你继续做下面两件事中的一件：

1. 跟着代码把“手动扫描”完整追一遍
2. 再看“自动扫描配置和任务历史”那一块

如果继续往下学，下一篇最适合补的是：

- `认证模块精读`

因为扫描页的很多能力都依赖：

- 登录态
- 管理员权限
- 当前用户身份

把认证看懂后，你对整个系统的理解会更稳。
