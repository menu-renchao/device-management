# POS 页面外网跳板访问设计

**Problem**

当前平台中的“打开设备”按钮直接执行 `window.open(\`http://${ip}:22080\`)`，这只适用于和 POS 设备处于同一局域网的用户。域名 `https://device.menusifu.cloud` 已经可以被外网访问，但外网用户无法直接打开同局域网内的 POS 页面，因此现有入口在公网场景下失效。

同时，内网用户仍然应该优先走局域网直连，避免所有流量绕过服务器，增加时延和服务器负担。

本次设计目标是在现有 Go + React 平台内增加“按设备身份解析目标 IP 的受控跳板访问能力”，让外网通过 `device.menusifu.cloud` 打开内网 POS 页面，同时保留局域网优先直连策略。

**Decision**

采用“应用层跳板 + 前端优先直连 + 失败回退代理”方案：

- 前端不再直接依赖裸 IP 打开 POS，而是先通过设备身份获取访问元信息。
- 后端只接受 `merchantId` 之类的设备身份参数，由服务端查出设备当前 IP 和端口。
- 前端优先尝试局域网直连；如果失败，则自动打开平台代理 URL。
- 平台代理仅允许访问数据库中已登记、且属于内网地址段的 POS 目标，禁止任意 IP 转发。
- 对外统一使用域名 `https://device.menusifu.cloud`。

**Why This Approach**

1. 纯 Nginx 动态反向代理不适合做“先查数据库再决定目标地址”的场景。
2. 允许客户端提交任意 IP/端口会让服务器变成 SSRF / open proxy，风险不可接受。
3. 现有平台已经有设备扫描、设备权限、JWT 认证与设备列表入口，最合适的落点就是扩展当前应用层。
4. 该方案兼顾内网体验、外网可用性和后续可维护性。

**Scope**

本期包含：

- 新增 POS Web 访问元信息接口
- 新增 POS Web 反向代理接口
- 后端根据 `merchantId` 解析设备 IP
- 仅允许代理固定白名单端口，默认 `22080`
- 仅允许代理 RFC1918 私网地址
- 前端新增“打开 POS”访问决策逻辑
- 前端保留“通过平台访问”稳定兜底入口
- 访问审计日志

本期不包含：

- 任意 IP/端口转发
- VPN / SD-WAN 方案
- 设备端 HTTPS 改造
- 大规模 HTML 内容重写引擎
- 跨多端口、多协议的通用隧道

**Current Context**

当前后端设备相关路由位于 [backend-go/cmd/server/main.go](D:/menusifu/device_management/backend-go/cmd/server/main.go)：

- `/api/device/...` 设备操作入口
- `/api/devices` 设备列表入口

设备扫描结果模型位于 [backend-go/internal/models/scan_result.go](D:/menusifu/device_management/backend-go/internal/models/scan_result.go)，已包含：

- `ip`
- `merchant_id`
- `is_online`
- `last_online_time`

前端当前“打开设备”逻辑位于：

- [frontend/src/pages/ScanPage.jsx](D:/menusifu/device_management/frontend/src/pages/ScanPage.jsx)
- [frontend/src/components/ScanTable.jsx](D:/menusifu/device_management/frontend/src/components/ScanTable.jsx)

两处都仍然是固定 `http://<ip>:22080` 打开。

**Architecture**

整体分为三层：

1. 设备目标解析层
- 输入：`merchantId`
- 输出：设备当前可访问的 `ip`、`port`、`directUrl`、`proxyBaseUrl`
- 由后端服务实现，不允许客户端指定最终目标

2. 访问入口编排层
- 前端先请求访问元信息
- 优先尝试 `directUrl`
- 失败后回退 `proxyBaseUrl`

3. 应用层代理层
- 由 Go 后端接收外网请求
- 校验权限
- 校验目标地址
- 反向代理到实际 POS 页面

**URL Design**

对外统一域名：

- 平台入口：`https://device.menusifu.cloud`

建议新增两个接口：

1. 访问元信息接口

`GET /api/device/:merchantId/pos-access`

返回示例：

```json
{
  "merchantId": "M123456",
  "ip": "192.168.1.50",
  "port": 22080,
  "directUrl": "http://192.168.1.50:22080/",
  "proxyBaseUrl": "https://device.menusifu.cloud/api/device/M123456/pos-proxy/",
  "preferDirect": true
}
```

2. 代理接口

`ANY /api/device/:merchantId/pos-proxy/*path`

示例：

- `GET /api/device/M123456/pos-proxy/`
- `GET /api/device/M123456/pos-proxy/kpos/webapp/...`
- `POST /api/device/M123456/pos-proxy/login`

**Backend Design**

建议在现有设备处理器基础上增加独立的 POS 访问服务，而不是把所有解析逻辑直接塞进 handler。

建议新增：

- `backend-go/internal/services/pos_access_service.go`

职责：

- 按 `merchantId` 查设备
- 校验设备在线状态
- 校验 IP 为私网地址
- 生成 `directUrl` 和 `proxyBaseUrl`
- 给代理层提供安全的目标地址

建议扩展：

- `backend-go/internal/repository/device_repo.go`
- `backend-go/internal/handlers/device.go`
- `backend-go/cmd/server/main.go`

后端处理流程：

1. 用户请求 `/api/device/:merchantId/pos-access`
2. handler 校验登录态
3. 校验当前用户是否有设备访问权限
4. `pos_access_service` 按 `merchantId` 查 `scan_results.ip`
5. 端口默认使用 `22080`
6. 生成 `directUrl` 与 `proxyBaseUrl`
7. 返回给前端

代理请求流程：

1. 用户请求 `/api/device/:merchantId/pos-proxy/*path`
2. handler 校验登录态与设备访问权限
3. `pos_access_service` 解析目标地址
4. 再次校验目标 IP / 端口是否允许
5. 使用 `httputil.ReverseProxy` 代理到 `http://<ip>:22080`
6. 记录访问审计

**Authorization Rules**

设备访问权限应与现有设备管理口径一致：

- 管理员可访问
- 设备负责人可访问
- 当前有效借用人可访问

可复用当前 `device.go` 中现有的设备权限判断逻辑，避免再造一套不一致的规则。

**Security Rules**

这是本设计最关键的部分。

必须满足：

- 客户端不能提交任意 IP 作为最终目标
- 目标 IP 只能来自数据库中的设备记录
- IP 必须属于私网地址段
- 禁止：
  - `127.0.0.0/8`
  - `169.254.0.0/16`
  - 公网地址
  - 组播地址
  - 未解析成功的地址
- 端口只允许白名单，首期只放行 `22080`
- 必须有登录态
- 必须记录访问日志
- 要设置连接超时和响应头超时

这套限制是为了避免把 `device.menusifu.cloud` 变成开放代理或 SSRF 跳板。

**Reverse Proxy Behavior**

代理层需要处理：

- 转发方法：`GET/POST/PUT/DELETE`
- 保留查询参数
- 透传 Cookie
- 重写 `Host`
- 必要时改写 `Location` 响应头，把跳回内网地址的重定向改回平台代理地址
- 为后续 WebSocket 兼容预留扩展点

首期假设目标为普通 HTTP 页面；如果后续发现 POS 页面依赖 WebSocket，再单独补 `Upgrade` 支持。

**Frontend Design**

前端不再直接调用 `window.open(\`http://${ip}:22080\`)`。

建议新增设备访问 API：

- `deviceAPI.getPosAccess(merchantId)`
- `deviceAPI.getPosProxyUrl(merchantId)` 可选，不单独暴露也可以

前端入口策略：

1. 用户点击“打开 POS”
2. 前端请求 `/api/device/:merchantId/pos-access`
3. 得到 `directUrl` 与 `proxyBaseUrl`
4. 尝试短超时直连探测
5. 成功则直开 `directUrl`
6. 失败则打开 `proxyBaseUrl`

同时保留一个稳定兜底入口：

- “通过平台访问”

原因：

- 平台域名大概率使用 `HTTPS`
- POS 页面是 `HTTP`
- 浏览器对从 HTTPS 页面访问 HTTP 内网资源可能存在限制
- 因此自动探测逻辑要保守实现，且保留用户可见兜底入口

建议前端改动点：

- [frontend/src/pages/ScanPage.jsx](D:/menusifu/device_management/frontend/src/pages/ScanPage.jsx)
- [frontend/src/components/ScanTable.jsx](D:/menusifu/device_management/frontend/src/components/ScanTable.jsx)
- [frontend/src/services/api.js](D:/menusifu/device_management/frontend/src/services/api.js)

建议把访问决策逻辑提取到一个单独的纯函数文件中，便于测试。

**Data Model**

首期不强制新增设备 Web 配置表，直接使用：

- `scan_results.ip`
- 固定端口 `22080`

如需增强，再加：

`device_web_access_configs`

建议字段：

- `merchant_id`
- `port`
- `enabled`
- `proxy_enabled`
- `updated_by`
- `updated_at`

首期同时建议新增访问审计表，例如：

`device_web_access_logs`

建议字段：

- `id`
- `merchant_id`
- `target_ip`
- `target_port`
- `access_mode` (`proxy`)
- `user_id`
- `client_ip`
- `status`
- `error_message`
- `created_at`

**Deployment**

推荐部署方式：

- `Nginx` 暴露 `device.menusifu.cloud`
- `Nginx` 只负责：
  - 前端静态资源
  - `/api/` 转发到 Go 后端
- Go 后端负责设备身份解析与 POS 代理

不推荐把“按设备 ID 查库再转发”的逻辑放到 Nginx 层。

**Error Handling**

需要明确返回以下错误：

1. 设备不存在
2. 设备无 `merchantId`
3. 设备当前无 IP
4. 设备离线
5. 目标 IP 非私网
6. 用户无权限
7. 代理连接失败
8. 目标拒绝连接
9. 代理超时

前端用户提示应区分：

- “局域网直连失败，已切换平台访问”
- “设备离线，无法打开页面”
- “您没有权限访问该设备”

**Risks**

1. POS 页面可能写死绝对内网 URL
- 需要 `Location` 头重写
- 极端情况下需要 HTML 内容重写

2. 浏览器混合内容限制
- 不能假设所有浏览器都允许 HTTPS 页面自由探测 HTTP 内网地址
- 因此前端必须保留兜底入口

3. 设备 IP 变化
- 方案依赖扫描结果实时更新
- 访问前应总是按最新 `merchantId -> ip` 关系解析

**Acceptance Criteria**

- 内网用户点击“打开 POS”时，优先成功直连设备
- 外网用户点击“打开 POS”时，可自动回退到 `device.menusifu.cloud` 跳板
- 未授权用户无法访问设备 POS 页面
- 服务器不能代理任意 IP / 端口
- POS 页面中的基础资源和表单提交可正常工作
- 设备 IP 更新后，无需前端改链接即可继续访问
- 访问失败时，有明确错误提示和服务端日志

**Implementation Notes**

建议实现顺序：

1. 先做后端目标解析与代理
2. 再做审计日志
3. 再做前端访问决策与双入口
4. 最后做部署验证与代理兼容性修补

---

文档状态：已在 brainstorming 阶段确认总体方案与域名 `device.menusifu.cloud`。
下一步：进入 implementation plan，拆出可执行任务。
