# 文件配置集成到升级部署 - 设计文档

## 概述

将 `linux_file_config` 模块的功能集成到升级部署（UpgradeTab）中，移除现有的简单配置文件编辑器（ConfigTab）。

## 需求

1. 移除现有的 ConfigTab 模块
2. 在 UpgradeTab 中集成文件配置管理功能
3. 支持三环境配置：QA / PROD / DEV
4. 配置管理权限仅限管理员
5. 配置数据存储在后端 SQLite
6. 支持两种执行方式：
   - 单独执行配置修改
   - 一键升级时自动执行启用的配置修改

## UI 设计

```
┌─────────────────────────────────────────────────────────┐
│  环境选择: [QA ▼]  (仅管理员可见配置管理按钮)            │
├─────────────────────────────────────────────────────────┤
│  📁 配置文件修改                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ☑ cloudUrlConfig.json    kpos/front/js/...    3键   ││
│  │ ☑ app.properties         WEB-INF/classes/...  2键   ││
│  │ ☐ db_config.json         config/db.json      1键    ││
│  └─────────────────────────────────────────────────────┘│
│  [执行选中配置]  [执行所有启用配置]  [管理配置(管理员)]   │
├─────────────────────────────────────────────────────────┤
│  📦 WAR 包上传 (现有功能)                                │
│  ...                                                     │
├─────────────────────────────────────────────────────────┤
│  [一键升级] (自动包含启用的配置修改)                      │
└─────────────────────────────────────────────────────────┘
```

## 数据库设计

新增 `file_configs` 表：

```sql
CREATE TABLE file_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,           -- 配置名称
    file_path TEXT NOT NULL,             -- 相对路径（相对于 /opt/tomcat7/webapps/）
    key_values TEXT NOT NULL,            -- JSON: [{key, qa_value, prod_value, dev_value}]
    enabled INTEGER DEFAULT 1,           -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API 设计

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/linux/file-configs | 获取配置列表 | 所有登录用户 |
| POST | /api/linux/file-configs | 新增配置 | 管理员 |
| PUT | /api/linux/file-configs/:id | 更新配置 | 管理员 |
| DELETE | /api/linux/file-configs/:id | 删除配置 | 管理员 |
| POST | /api/linux/file-configs/execute | 执行配置修改 | 所有登录用户 |

### API 详细说明

#### GET /api/linux/file-configs
返回所有配置项列表

#### POST /api/linux/file-configs
```json
{
  "name": "cloudUrlConfig",
  "file_path": "kpos/front/js/cloudUrlConfig.json",
  "key_values": [
    {
      "key": "api.url",
      "qa_value": "http://qa-api.example.com",
      "prod_value": "https://api.example.com",
      "dev_value": "http://localhost:8080"
    }
  ],
  "enabled": true
}
```

#### POST /api/linux/file-configs/execute
```json
{
  "merchant_id": "TEST001",
  "config_ids": [1, 2],  // 可选，不传则执行所有启用的
  "env": "QA"
}
```

## 一键升级流程（更新后）

1. 停止 POS 服务
2. 创建备份
3. 替换 WAR 包
4. 执行启用的配置修改（根据选择的环境）
5. 重启 POS（使用现有方法）

## 文件修改范围

### 后端 (Go)
- `internal/models/` - 新增 FileConfig 模型
- `internal/handlers/linux.go` - 新增配置相关 API
- `internal/services/linux_service.go` - 新增配置修改执行逻辑
- `cmd/server/main.go` - 注册新路由

### 前端 (React)
- `components/linux/ConfigTab.jsx` - 删除
- `components/linux/UpgradeTab.jsx` - 重构，集成配置管理
- `components/linux/FileConfigModal.jsx` - 新增，配置管理弹窗（管理员专用）
- `services/api.js` - 新增配置相关 API
- `pages/LinuxConfigPage.jsx` - 移除 ConfigTab 引用

## 配置文件格式支持

- JSON 文件：解析后按 key.path 修改值
- Properties 文件：按 key=value 格式替换
- 纯文本文件：简单字符串替换
