# POS 数据备份恢复跨 MID 导入设计

## 1. 背景与目标

当前 POS 设备管理中的“更多 -> 数据备份恢复”只支持围绕当前设备 MID 的数据库备份进行：

- 创建当前 MID 的服务端备份
- 列出当前 MID 的服务端备份
- 用当前 MID 的服务端备份恢复当前设备
- 从本地上传 `.sql` 恢复当前设备

本次需求是在不改变 License 业务边界的前提下，新增“导入其他设备数据”能力：

- 入口位于“更多 -> 数据备份恢复”
- 只针对服务端数据库备份，不包含本地上传路径
- 遍历展示可访问的其他 MID 的数据库备份
- 允许把“来源 MID”的数据库备份导入到“当前目标设备”
- 强提醒用户必须先备份当前设备 License
- 最好在交互和后端两层都强校验：只有当前设备至少存在一份 License 服务端备份时，才允许点击并执行导入

同时明确排除项：

- 不支持跨机器导入 License
- 不新增 License 跨 MID 浏览或恢复能力
- 不改变现有当前 MID 数据备份/恢复、本地上传恢复的行为

---

## 2. 本次已确认的设计结论

### 2.1 范围

- 只修改“数据备份恢复”功能
- 只扩展“服务端备份恢复”链路
- 不改“License备份/导入”弹窗
- 不改“从本地上传恢复”逻辑

### 2.2 业务约束

- License 从业务逻辑上绝对不能导入其他机器的数据
- “导入其他设备数据”仅表示导入数据库内容
- 当前目标设备必须先完成自己的 License 备份，才能导入其他设备数据

### 2.3 推荐方案

采用方案 A：新增“跨 MID 数据备份目录 + 按源 MID 导入”接口。

不采用的方案：

- 前端遍历所有设备逐个请求当前接口：请求碎片化，恢复时仍需要后端知道来源 MID
- 先把其他 MID 备份复制到当前 MID 目录再恢复：目录归属会混乱，后续下载/删除也容易误操作

---

## 3. 核心设计原则

1. 目标 MID 与来源 MID 必须显式分离
2. License 只作为当前目标设备的安全门槛，不参与跨 MID 选择
3. 前端禁用只是体验优化，后端必须做最终硬校验
4. 只展示当前用户有权限访问的 MID 备份，避免越权暴露服务器上的全部备份目录
5. 不复用“当前 MID 恢复”去偷偷读取其他 MID 目录，避免语义污染

---

## 4. 后端设计

## 4.1 权限模型

现有数据库备份、License 备份相关接口已经通过 `getPermittedDeviceForLicense` 做权限校验，允许的角色口径为：

- 管理员
- 设备负责人
- 当前借用人

本次跨 MID 导入保持同样口径，但需要同时对两个维度校验：

- 目标 MID：当前正在操作的设备
- 来源 MID：提供数据库备份的设备

规则如下：

1. 用户必须对目标 MID 有管理权限，否则不能打开跨 MID 导入能力
2. 用户必须对来源 MID 也有访问权限，否则该 MID 的备份不应展示，也不能导入
3. 目标 MID 必须至少存在一份 License 服务端备份，否则不能导入任意来源 MID 的数据

## 4.2 新增接口：跨 MID 备份列表

建议新增接口：

- `GET /api/device/db/backups/all?merchant_id=<target_mid>`

语义：

- `merchant_id` 表示当前目标设备 MID
- 接口返回“当前用户可访问、并且有数据库备份的所有来源 MID 备份分组”
- 同时返回目标 MID 的 License 备份状态，供前端禁用按钮

建议返回结构：

```json
{
  "message": "success",
  "data": {
    "target_merchant_id": "M100",
    "license_backup_ready": true,
    "groups": [
      {
        "source_merchant_id": "M200",
        "total": 2,
        "items": [
          {
            "source_merchant_id": "M200",
            "name": "1.0.0_20260316_101010.sql",
            "version": "1.0.0",
            "size": 102400,
            "mod_time": "2026-03-16T10:10:10+08:00"
          }
        ]
      }
    ]
  }
}
```

说明：

- `license_backup_ready` 直接由后端计算，减少前端额外请求
- `groups` 为空时，表示当前用户有权限，但没有其他 MID 的服务端备份可导入
- 默认不返回与目标 MID 相同的备份组，避免与现有“当前 MID 恢复”入口语义重叠

## 4.3 扩展接口：从来源 MID 服务端备份恢复

扩展现有接口：

- `POST /api/device/db/restore/server`

现有字段：

- `merchant_id`
- `file_name`
- `restart_pos_after_restore`

扩展后字段：

- `merchant_id`: 目标设备 MID
- `source_merchant_id`: 来源备份 MID
- `file_name`: 来源 MID 目录下的备份文件名
- `restart_pos_after_restore`

建议请求体：

```json
{
  "merchant_id": "M100",
  "source_merchant_id": "M200",
  "file_name": "1.0.0_20260316_101010.sql",
  "restart_pos_after_restore": false
}
```

后端处理流程：

1. 校验目标 MID 非空
2. 校验来源 MID 非空
3. 校验文件名非空
4. 校验目标 MID 权限
5. 校验来源 MID 权限
6. 校验目标 MID 至少存在一份 License 服务端备份
7. 禁止 `source_merchant_id == merchant_id` 走这条新路径
8. 用目标 MID 找到目标设备 IP
9. 从来源 MID 对应的备份目录读取 SQL 文件
10. 将该 SQL 恢复到目标设备 IP 对应的数据库
11. Linux 设备按原逻辑决定是否重启 POS

## 4.4 service 层改造

当前 `DBBackupService` 的核心能力是：

- `ListBackups(merchantID)`
- `OpenBackupFile(merchantID, fileName)`
- `RestoreFromServerFile(host, merchantID, fileName)`

本次建议新增：

- `ListBackupsByMerchantIDs(merchantIDs []string) (map[string][]DBBackupFileInfo, error)`
- `RestoreFromServerFileForSource(host, sourceMerchantID, fileName string) error`

或等价封装：

- `ListBackupGroups(merchantIDs []string)`
- `ResolveBackupPath(merchantID, fileName)`

关键点不是方法名，而是要把“来源 MID”与“目标设备 host”彻底拆开。

恢复时的实际语义应变成：

- 文件路径来自 `sourceMerchantID`
- 目标数据库连接来自 `host`

不能继续使用“同一个 merchantID 既表示来源目录又表示目标设备”这种旧语义。

## 4.5 License 校验复用

当前 `LicenseService` 已经支持：

- `ListBackups(merchantID string) ([]LicenseBackupFileInfo, error)`

本次不新增 License 跨 MID 功能，只需要在后端新增一个内部判断：

- `target MID` 的 License 备份列表长度是否大于 0

如果为 0：

- 列表接口返回 `license_backup_ready: false`
- 恢复接口直接拒绝执行，并返回明确错误文案

建议错误文案：

- `请先备份当前设备 License 后，再导入其他设备数据`

---

## 5. 前端交互设计

## 5.1 入口位置

继续使用当前 [DBBackupRestoreModal.jsx](/D:/menusifu/device_management/frontend/src/components/db-backup/DBBackupRestoreModal.jsx)。

不新增新页面，不拆新弹窗，只在现有“数据备份/恢复”弹窗中增加一个新区域：

- 区域标题：`导入其他设备数据`

放置位置建议：

- 当前 MID 服务端备份列表下方
- 本地上传恢复区域上方

这样不会干扰现有“创建当前 MID 备份”和“恢复当前 MID 备份”的主流程。

## 5.2 强提醒

在弹窗顶部现有提示下，再增加一条显眼提醒：

- `强提醒：导入其他设备数据前，必须先完成当前设备 License 备份。`
- `若当前设备没有至少一份 License 服务端备份，将禁止导入。`

同时在“导入其他设备数据”区域内再次显示一次禁用原因，形成双重提醒。

## 5.3 按钮与状态

新增按钮：

- `导入其他设备数据`

按钮状态：

1. 正在加载跨 MID 数据时，显示 loading 文案
2. `license_backup_ready = false` 时禁用
3. 禁用时展示原因：
   - `当前设备尚未备份 License，无法导入其他设备数据`

按钮点击行为：

- 首次点击时请求跨 MID 列表接口
- 成功后展开“其他 MID 备份列表区”
- 再次点击可刷新列表，也可保持展开态

## 5.4 列表展示

列表按 `source_merchant_id` 分组展示，每组包含：

- 来源 MID
- 备份数量

每个备份项展示：

- 文件名
- 版本
- 时间
- 大小
- 操作按钮 `导入到当前设备`

来源 MID 等于目标 MID 的数据不显示在这个区域。

## 5.5 二次确认文案

点击 `导入到当前设备` 时，确认框必须明确四件事：

1. 当前目标 MID
2. 来源 MID
3. 备份文件名
4. 会覆盖当前设备数据库

建议确认文案：

`确定将来源 MID ${sourceMid} 的备份 ${fileName} 导入到当前设备 MID ${targetMid} 吗？此操作会覆盖当前设备数据库。导入前请确认当前设备 License 已完成备份。`

建议标题：

- `确认导入其他设备数据`

## 5.6 与现有功能的关系

原有功能保持不变：

- 当前 MID 的“恢复”按钮仍只恢复当前 MID 自己的服务端备份
- 本地上传恢复仍按原逻辑工作

新增功能只处理：

- 从“其他 MID”选择一份服务端数据库备份导入到当前设备

这样用户能清楚区分三种恢复来源：

1. 当前 MID 服务端备份
2. 其他 MID 服务端备份
3. 本地上传 SQL

---

## 6. 详细业务流程

## 6.1 打开弹窗

1. 用户在设备列表点击“更多 -> 数据备份恢复”
2. 弹窗按原逻辑加载当前 MID 的数据库备份
3. 跨 MID 导入区域初始折叠

## 6.2 点击“导入其他设备数据”

1. 前端调用跨 MID 备份列表接口
2. 后端校验目标 MID 权限
3. 后端查询目标 MID 是否存在 License 服务端备份
4. 后端计算当前用户可访问的来源 MID 集合
5. 后端读取这些来源 MID 的数据库备份目录
6. 返回分组列表与 `license_backup_ready`
7. 前端按结果渲染：
   - 未备份 License：显示强提醒并禁用
   - 已备份 License 但无数据：显示空态
   - 有可导入数据：展示分组列表

## 6.3 点击“导入到当前设备”

1. 前端弹出危险确认框
2. 用户确认后调用恢复接口，提交目标 MID、来源 MID、文件名
3. 后端再次校验：
   - 目标 MID 权限
   - 来源 MID 权限
   - 目标 MID License 备份存在
4. 后端从来源 MID 目录读取 SQL 文件
5. 后端将 SQL 恢复到目标设备数据库
6. Linux 设备按原逻辑处理“恢复后重启 POS”
7. 前端展示恢复结果

---

## 7. 错误处理规范

## 7.1 前端提示

前端需要优先展示后端返回的可读错误文案，不要把所有失败都折叠成“恢复失败”。

重点错误场景：

- `请先备份当前设备 License 后，再导入其他设备数据`
- `您没有权限访问来源设备备份`
- `备份文件不存在或已被删除`
- `当前设备数据库恢复失败`

## 7.2 后端状态码建议

- `400`: 参数错误、目标 MID 未完成 License 备份、来源 MID 与目标 MID 相同
- `403`: 对目标 MID 或来源 MID 无权限
- `404`: 目标设备不存在、来源备份不存在
- `500`: 列表读取或恢复过程中出现内部错误

---

## 8. 测试策略

## 8.1 后端 handler 测试

需要补充以下测试：

1. 跨 MID 列表接口在目标 MID 有权限时返回分组数据
2. 目标 MID 没有 License 备份时返回 `license_backup_ready = false`
3. 列表只包含当前用户有权限访问的来源 MID
4. 恢复接口在目标 MID 没有 License 备份时拒绝执行
5. 恢复接口会把 `source_merchant_id` 传入来源目录解析
6. 恢复接口对无权限的来源 MID 返回 403
7. 恢复接口拒绝 `source_merchant_id == merchant_id`

## 8.2 service 测试

需要补充以下测试：

1. 按多个 MID 聚合备份列表，并按时间倒序排序
2. 来源 MID 目录路径解析正确
3. 恢复时读取的是来源 MID 目录下的文件

## 8.3 前端验证

仓库目前没有前端测试框架，本次以构建和联调验证为主：

1. `导入其他设备数据` 按钮在未备份 License 时禁用
2. 按钮禁用原因文案正确
3. 列表按 MID 分组展示
4. 点击导入后二次确认文案包含目标 MID、来源 MID、文件名
5. 不影响当前 MID 服务端恢复和本地上传恢复

---

## 9. 预期改动文件

前端：

- `frontend/src/components/db-backup/DBBackupRestoreModal.jsx`
- `frontend/src/services/api.js`
- `frontend/src/App.css`（如需新增分组区样式）

后端：

- `backend-go/cmd/server/main.go`
- `backend-go/internal/handlers/device_db_backup.go`
- `backend-go/internal/services/db_backup_service.go`
- `backend-go/internal/handlers/device_db_backup_test.go`
- `backend-go/internal/services/*db_backup*_test.go`（如需新增）

---

## 10. 结论

本设计将“导入其他设备数据”限定为“目标设备恢复其他 MID 的数据库备份”，并通过“双重 License 门槛 + 双重权限校验”控制风险：

- License 仍然严格限定为当前设备自己的备份
- 数据导入明确区分目标 MID 与来源 MID
- 前端给出强提醒与禁用态
- 后端提供不可绕过的最终校验

文档状态：已完成并确认  
下一步：进入 implementation plan，拆解为可执行的前后端与测试任务
