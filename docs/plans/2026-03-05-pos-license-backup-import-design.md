# POS 设备 License 备份/导入功能设计

## 1. 背景与目标

当前 POS 设备列表的“更多”操作中缺少 License 数据迁移能力。  
目标是在 POS 设备维度补充两个动作：

- `License备份`
- `License导入`

并对齐参考实现 `pos_tool_new/license_backup` 的核心行为：  
备份生成 SQL 文件，导入按 SQL 文件执行并支持事务回滚。

## 2. 已确认需求（本次 brainstorming 结论）

1. **连接方式**：固定参数直连（方案 B）
   - `host = 设备IP`
   - `port = 22108`
   - `database = kpos`
   - 固定账号密码（与参考实现一致）
2. **权限范围**：管理员 + 负责人 + 当前借用人（方案 C）
3. **菜单显示条件**：只要设备有 `merchantId` 就显示（方案 B）
   - 设备离线不隐藏入口，点击时由后端返回连接失败
4. **导入文件来源**：仅支持本地上传 `.sql`（方案 A）
5. **备份内容范围**：完全对齐参考实现（方案 A）
   - `company_profile` 备份 SQL
   - 指定 `system_configuration` 备份 SQL
   - 额外 SQL 更新段

## 3. 方案对比与选型

### 方案 1（采用）：后端直连 MySQL，专用 License 备份/导入接口

- 在 `backend-go` 新增 License 领域服务与接口
- 备份直接返回 SQL 文件下载
- 导入上传 `.sql` 后事务执行

**优点**

- 与参考实现最一致
- 与 Linux/Windows 设备无耦合（只依赖 IP + MySQL 可达）
- 前端改动小，入口清晰

**缺点**

- 后端需要新增一组 SQL 生成/执行逻辑

### 方案 2：复用 db-config 模板执行框架

**不采用原因**

- 备份导出文件与导入上传文件场景不自然
- 需要绕行模板模型，复杂度更高

### 方案 3：通过 SSH 在设备端执行

**不采用原因**

- 对 Windows 设备不友好
- 与本次“离线可见入口、点击失败提示”目标不匹配

## 4. 架构与模块设计

## 4.1 前端

- 页面入口：`ScanTable` 的“更多”菜单新增两项
  - `License备份`
  - `License导入`
- 页面承载：`ScanPage` 负责动作触发、确认、调用 API、结果提示
- API 封装：`frontend/src/services/api.js` 新增 `deviceAPI` 下 License 接口

## 4.2 后端

- 路由前缀建议：`/api/device/license`
- 处理层：可放在 `internal/handlers/device.go`（同设备域）或拆分新 handler
- 服务层：新增 LicenseService（Go）
  - 连接设备 MySQL（固定参数）
  - 生成备份 SQL
  - 执行导入 SQL（事务）

## 5. 接口设计

## 5.1 备份接口

- `POST /api/device/license/backup`
- 请求体：

```json
{
  "merchant_id": "M123456"
}
```

- 鉴权与权限：
  - 登录态必需
  - 管理员 / 负责人 / 当前借用人
- 返回：
  - 成功：附件下载流（`application/sql` 或 `application/octet-stream`）
  - 失败：标准错误 JSON

## 5.2 导入接口

- `POST /api/device/license/import`
- 请求体：`multipart/form-data`
  - `merchant_id`（string）
  - `file`（.sql）
- 鉴权与权限：
  - 登录态必需
  - 管理员 / 负责人 / 当前借用人
- 返回：
  - 成功：`executed_count` 等摘要
  - 失败：错误信息 + 失败语句序号（如可得）

## 6. 业务流程

## 6.1 License备份

1. 前端点击“更多 -> License备份”
2. 前端 `toast.confirm` 二次确认
3. 后端根据 `merchant_id` 查设备IP
4. 用固定连接参数连接目标 MySQL
5. 查询并组装 SQL：
   - `company_profile` -> `UPDATE ...`
   - `system_configuration` 指定项 -> `DELETE + INSERT`
   - 追加参考实现的额外 SQL
6. 写入内存/临时流并以附件响应下载
7. 前端触发浏览器下载，toast 提示成功/失败

## 6.2 License导入

1. 前端点击“更多 -> License导入”
2. 选择本地 `.sql` 文件
3. 前端 `toast.confirm` 危险确认
4. 后端校验文件类型与内容
5. 后端连接目标 MySQL，开启事务
6. 解析 SQL 文件并逐条执行
7. 全部成功则提交；任一失败则回滚
8. 返回执行结果，前端 toast 提示

## 7. SQL 内容对齐策略（参考实现 A）

备份 SQL 文件由以下部分组成：

1. 文件头注释（商户ID、生成时间、工具标识）
2. `company_profile` 相关字段更新 SQL
3. `system_configuration` 指定键清理 + 插入 SQL
4. 额外更新 SQL 段（与参考实现保持一致）

命名规则：

- `License{merchantId}_{yyyyMMdd_HHmmss}.sql`

## 8. 权限与安全

## 8.1 权限判定

- 复用当前设备权限口径：
  - 管理员
  - 设备负责人
  - 当前借用人（借用未过期）

## 8.2 安全要求

- 日志禁止输出明文密码
- 导入仅允许 `.sql`
- 导入执行必须事务包裹，避免半成功状态
- 前端禁止使用 `window.confirm/alert/prompt`，统一 `toast.confirm/toast.*`

## 9. 异常处理

- `400`：参数错误、文件格式错误、连接失败、SQL 执行错误
- `401`：未登录
- `403`：无设备权限
- `404`：设备不存在或商家ID无效
- `500`：服务内部错误

错误文案需可直接给前端展示，避免“未知错误”。

## 10. 前端交互细节

- `License备份`：
  - `toast.confirm`（`variant: 'primary'`）
  - 执行中禁用重复点击
  - 成功后下载文件并提示
- `License导入`：
  - 文件选择后显示文件名
  - `toast.confirm`（危险操作）
  - 上传中禁用重复点击
  - 成功显示执行条数，失败显示回滚结果

## 11. 测试与验收

## 11.1 后端

- 备份 SQL 结构与关键语句完整性
- 导入 SQL 解析（含字符串分号场景）
- 导入事务回滚验证（中途失败）
- 权限矩阵验证（管理员/负责人/借用人/无权限）

## 11.2 前端

- “更多”菜单显示条件：仅依赖 `merchantId`
- 备份下载链路可用
- 导入上传、确认、结果提示可用
- 离线设备点击后返回失败提示（不隐藏入口）

## 12. 改动范围（预估）

- 前端
  - `frontend/src/components/ScanTable.jsx`
  - `frontend/src/pages/ScanPage.jsx`
  - `frontend/src/services/api.js`
  - （如需）`frontend/src/App.css`
- 后端
  - `backend-go/cmd/server/main.go`
  - `backend-go/internal/handlers/device.go`
  - `backend-go/internal/services/*license*`

---

文档状态：已确认（brainstorming 阶段）  
下一步：进入 implementation plan（writing-plans 阶段）
