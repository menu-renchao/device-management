# 数据库设计文档

> 文档版本：v1.0 | 更新日期：2026-03-05  
> 数据库引擎：SQLite（文件：`data.db`）

---

## 1. ER 关系图

```
users ◄──────────────── scan_results (owner_id)
  │                          │
  │                          ├── device_occupancies (merchant_id)
  │                          ├── device_claims (merchant_id)
  │                          ├── device_borrow_requests (merchant_id)
  │                          └── device_properties (merchant_id)
  │
  ├── mobile_devices (owner_id / occupier_id)
  │       └── mobile_borrow_requests (device_id)
  │
  └── system_notifications (user_id)

scan_sessions (独立，记录扫描会话)
file_configs  (独立，SSH 文件配置模板)
system_config (独立，系统全局配置 KV)
war_package_metadata (独立，WAR 包元数据)
```

---

## 2. 表详细设计

### 2.1 users — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AutoIncrement | 用户 ID |
| username | TEXT(50) | NOT NULL, UNIQUE | 登录用户名 |
| password_hash | TEXT(256) | NOT NULL | bcrypt 密码哈希 |
| email | TEXT(100) | UNIQUE, nullable | 邮箱（可为空）|
| name | TEXT(50) | nullable | 显示名称 |
| role | TEXT(20) | DEFAULT 'user' | `user` / `admin` |
| status | TEXT(20) | DEFAULT 'pending' | `pending` / `approved` / `rejected` |
| created_at | DATETIME | | 注册时间 |
| updated_at | DATETIME | | 更新时间 |

**索引**：`username`（唯一），`email`（唯一）

**业务规则**：
- 新注册用户 `status = pending`，需管理员审核后才能登录（`approved`）
- `admin` 账号在首次启动时自动创建
- 密码使用 bcrypt DefaultCost 哈希

---

### 2.2 scan_results — POS 设备扫描结果表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| ip | TEXT(50) | NOT NULL | 设备 IP 地址 |
| merchant_id | TEXT(100) | INDEX, nullable | 商户 ID（POS 系统唯一标识）|
| name | TEXT(200) | nullable | 设备/商家名称 |
| version | TEXT(50) | nullable | POS 应用版本 |
| type | TEXT(50) | nullable | OS 类型（Linux/Windows/Unknown）|
| full_data | TEXT | nullable | 完整 JSON 响应（来自 fetchCompanyProfile）|
| scanned_at | DATETIME | | 最近扫描时间 |
| is_online | BOOLEAN | DEFAULT true | 是否在线 |
| last_online_time | DATETIME | | 最后一次在线时间 |
| owner_id | INTEGER | FK→users, INDEX, nullable | 设备认领者 |
| deleted_at | DATETIME | INDEX, nullable | 软删除时间戳（GORM 软删除）|

**索引**：`merchant_id`，`owner_id`，`deleted_at`

**设备唯一性标识规则**：
- 有 `merchant_id`：以 `merchant_id` 为唯一键，扫描时 upsert
- 无 `merchant_id`：以 `ip` 为标识，IP 相同则更新

**在线状态逻辑**：
- 扫描到 → `is_online = true`，`last_online_time = now()`
- 扫描完成（非取消）→ 不在结果集中的设备（有 merchant_id 的）`is_online = false`

---

### 2.3 device_occupancies — 设备占用表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| merchant_id | TEXT(100) | UNIQUE, NOT NULL | 商户 ID（每设备只能有一条活跃占用）|
| user_id | INTEGER | FK→users, NOT NULL | 占用者 |
| purpose | TEXT(500) | | 占用目的 |
| start_time | DATETIME | | 开始时间 |
| end_time | DATETIME | | 预计结束时间 |

**管理员专属**：管理员可直接占用（`PUT /api/device/occupancy`），无需审批流程。

---

### 2.4 device_claims — 设备认领申请表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| merchant_id | TEXT(100) | NOT NULL, INDEX | 商户 ID |
| user_id | INTEGER | FK→users, NOT NULL | 申请者 |
| status | TEXT(20) | DEFAULT 'pending' | `pending` / `approved` / `rejected` |
| created_at | DATETIME | | 申请时间 |
| processed_at | DATETIME | nullable | 处理时间 |

**认领通过效果**：`scan_results.owner_id` 更新为申请者 ID。

---

### 2.5 device_borrow_requests — POS 设备借用申请表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| merchant_id | TEXT(100) | NOT NULL, INDEX | 商户 ID |
| user_id | INTEGER | FK→users, NOT NULL | 申请者 |
| purpose | TEXT(500) | | 借用目的 |
| end_time | DATETIME | | 预计归还时间 |
| status | TEXT(20) | DEFAULT 'pending' | `pending` / `approved` / `rejected` / `completed` |
| rejection_reason | TEXT(500) | nullable | 拒绝原因 |
| created_at | DATETIME | | 申请时间 |
| processed_at | DATETIME | nullable | 处理时间 |
| processed_by | INTEGER | nullable | 审批人 ID |
| deleted_at | DATETIME | INDEX, nullable | 软删除 |

---

### 2.6 device_properties — 设备性质标记表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| merchant_id | TEXT(100) | UNIQUE, NOT NULL | 商户 ID |
| property | TEXT(200) | | 性质标签（如"测试机"、"演示机"）|

管理员专属，可对设备打标签用于区分用途。

---

### 2.7 mobile_devices — 移动设备表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| name | TEXT(200) | NOT NULL | 设备名称 |
| device_type | TEXT(100) | nullable | 设备类型（平板/手持等）|
| sn | TEXT(100) | nullable | 序列号 |
| image_a | TEXT(500) | nullable | 正面图片路径 |
| image_b | TEXT(500) | nullable | 背面图片路径 |
| system_version | TEXT(100) | nullable | 系统版本 |
| owner_id | INTEGER | FK→users, INDEX, nullable | 负责人 |
| occupier_id | INTEGER | FK→users, INDEX, nullable | 当前借用人 |
| purpose | TEXT(500) | nullable | 借用目的 |
| start_time | DATETIME | nullable | 借用开始时间 |
| end_time | DATETIME | nullable | 归还截止时间 |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |
| deleted_at | DATETIME | INDEX, nullable | 软删除 |

**在借判断**：`end_time != null && end_time > now()`

---

### 2.8 mobile_borrow_requests — 移动设备借用申请表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| device_id | INTEGER | FK→mobile_devices, NOT NULL | 申请设备 |
| user_id | INTEGER | FK→users, NOT NULL | 申请者 |
| purpose | TEXT(500) | | 借用目的 |
| end_time | DATETIME | | 预计归还时间 |
| status | TEXT(20) | DEFAULT 'pending' | `pending` / `approved` / `rejected` / `completed` |
| rejection_reason | TEXT(500) | nullable | 拒绝原因 |
| created_at | DATETIME | | |
| processed_at | DATETIME | nullable | |
| processed_by | INTEGER | nullable | 审批人 |
| deleted_at | DATETIME | nullable | 软删除 |

---

### 2.9 scan_sessions — 扫描会话表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| local_ip | TEXT(50) | UNIQUE | 本机网卡 IP（每个 IP 一条记录）|
| last_scan_at | DATETIME | nullable | 最近一次扫描完成时间 |

记录每个网段最近一次扫描时间，便于前端展示。

---

### 2.10 file_configs — SSH 文件配置模板表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| name | TEXT(200) | NOT NULL | 配置名称 |
| remote_path | TEXT(500) | NOT NULL | 远程文件路径 |
| content | TEXT | | 文件内容模板 |
| enabled | BOOLEAN | DEFAULT true | 是否启用 |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

用于批量向 Linux POS 服务器推送配置文件。

---

### 2.11 system_config — 系统全局配置表（KV 存储）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| key | TEXT(100) | UNIQUE, NOT NULL | 配置键 |
| value | TEXT | | 配置值 |
| updated_at | DATETIME | | |

当前使用场景：
- `war_download_cookie`：WAR 包下载源的 Cookie

---

### 2.12 system_notifications — 系统消息通知表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| user_id | INTEGER | FK→users, NOT NULL | 接收者 |
| title | TEXT(200) | NOT NULL | 通知标题 |
| content | TEXT(1000) | | 通知内容 |
| type | TEXT(50) | | 通知类型 |
| is_read | BOOLEAN | DEFAULT false | 是否已读 |
| created_at | DATETIME | | 创建时间 |

通知触发时机：注册审核、借用申请提交/审批结果。

---

### 2.13 war_package_metadata — WAR 包元数据表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | 主键 |
| package_name | TEXT(200) | UNIQUE, NOT NULL | 包文件名 |
| description | TEXT(500) | nullable | 描述 |
| is_release | BOOLEAN | DEFAULT false | 是否为正式发布版 |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

---

## 3. 软删除策略

以下表启用 GORM 软删除（`gorm.DeletedAt`）：

| 表名 | 说明 |
|------|------|
| `scan_results` | 支持管理员删除设备（软删除，历史数据保留）|
| `mobile_devices` | 移动设备删除 |
| `device_borrow_requests` | 借用申请删除 |
| `mobile_borrow_requests` | 移动设备借用申请删除 |

查询时 GORM 自动过滤 `deleted_at IS NOT NULL` 的记录。

---

## 4. 级联删除规则

删除 POS 设备（有 `merchant_id`）时，事务中同时删除：

```
scan_results            (设备本体)
device_occupancies      (占用记录)
device_claims           (认领记录)
device_properties       (性质标签)
device_borrow_requests  (借用申请)
```

---

## 5. 数据库维护

### 备份

SQLite 单文件，直接复制 `data.db` 即可备份。

### 迁移

GORM `AutoMigrate` 仅做新增操作（新增表、新增列），不删除列，生产升级安全。

如需删除列或重命名，需手动执行 SQLite 命令或编写迁移脚本。

### 性能注意事项

- `scan_results.full_data` 字段存储完整 JSON，单条可达数 KB，建议定期清理长期离线设备
- 当设备数量超过 10000 时，考虑对 `ip`、`is_online` 添加复合索引
- SQLite 不支持高并发写入，网络扫描阶段的并发写入通过 GORM 连接池序列化处理
