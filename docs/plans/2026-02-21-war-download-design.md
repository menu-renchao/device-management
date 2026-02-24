# WAR 包网络下载功能 - 设计文档

## 概述

在升级部署模块中集成 WAR 包网络下载功能，支持从 TeamCity 等 CI/CD 服务器下载 WAR 包，统一存储管理，前端可选择历史下载的包。

## 需求

1. 支持从网络 URL 下载 WAR 包
2. 后端统一存储管理（以文件名作为文件夹）
3. 前端支持选择历史下载的包
4. 支持 Cookie 认证
5. 显示下载进度

## 后端存储结构

```
backend-go/downloads/
├── kpos_v1.5.1/
│   └── kpos.war
├── kpos_v1.5.2/
│   └── kpos.war
└── cloudDatahub_v2.0/
    └── cloudDatahub.war
```

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/linux/war/list | 获取已下载的 WAR 包列表 |
| POST | /api/linux/war/download | 从 URL 下载 WAR 包 |
| GET | /api/linux/war/download/progress/:taskId | 获取下载进度 |
| DELETE | /api/linux/war/:name | 删除已下载的包 |

### API 详细说明

#### GET /api/linux/war/list
返回已下载的 WAR 包列表：
```json
{
  "success": true,
  "data": {
    "packages": [
      {"name": "kpos_v1.5.1", "file_name": "kpos.war", "size": 217000000, "created_at": "2026-02-21T10:00:00Z"},
      {"name": "kpos_v1.5.2", "file_name": "kpos.war", "size": 218000000, "created_at": "2026-02-21T11:00:00Z"}
    ]
  }
}
```

#### POST /api/linux/war/download
```json
{
  "url": "https://teamcity.example.com/buildConfiguration/..."
}
```

返回：
```json
{
  "success": true,
  "data": {
    "task_id": "uuid-here",
    "name": "kpos_v1.5.2"
  }
}
```

#### GET /api/linux/war/download/progress/:taskId
```json
{
  "success": true,
  "data": {
    "status": "downloading",
    "percentage": 45,
    "downloaded": 100000000,
    "total": 217000000,
    "speed": "5.2 MB/s"
  }
}
```

## 前端 UI 设计

在 UpgradeTab 的"选择 WAR 包"区域：

```
┌─────────────────────────────────────────────────┐
│  选择 WAR 包                                     │
│  ┌─────────────────────────────────────────────┐│
│  │ ○ 从本地上传                                ││
│  │ ○ 从网络下载                                ││
│  │ ○ 选择历史包          [下拉选择]            ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  [下载URL输入框 - 仅网络下载模式显示]            │
│  [_______________________________]              │
│  [开始下载]                      进度: 45%      │
└─────────────────────────────────────────────────┘
```

## 配置管理

Cookie 存储在后端配置文件 `config.yaml`:
```yaml
download:
  cookie: "YOUR_COOKIE_HERE"
  downloads_dir: "./downloads"
```

## 文件修改范围

### 后端 (Go)
- `internal/config/config.go` - 添加下载配置
- `internal/handlers/war_download.go` - 新增下载 API
- `internal/services/war_download_service.go` - 下载服务
- `cmd/server/main.go` - 注册路由

### 前端 (React)
- `components/linux/UpgradeTab.jsx` - 添加下载功能 UI
- `services/api.js` - 添加下载相关 API

## URL 转换规则

支持 TeamCity URL 转换：
1. `buildConfiguration` 类型 URL → `downloadAll/{project}/artifacts.zip`
2. `kpos.war` 类型 URL → `downloadAll/{project}/artifacts.zip`
