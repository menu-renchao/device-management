# POS 设备扫描逻辑

## 概述

本文档描述 POS 设备扫描系统的完整工作流程，包括网络扫描、设备发现、数据存储和在线状态管理。

## 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │   Backend Go    │     │    Database     │
│   (ScanPage)    │────▶│  (ScanHandler)  │────▶│    (SQLite)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  ScanService    │
                        │  (网络扫描)      │
                        └─────────────────┘
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `frontend/src/pages/ScanPage.jsx` | 扫描页面 UI 和状态管理 |
| `backend-go/internal/handlers/scan.go` | 扫描 API 处理器 |
| `backend-go/internal/services/scan_service.go` | 网络扫描核心逻辑 |
| `backend-go/internal/repository/device_repo.go` | 数据库操作 |
| `backend-go/internal/models/scan_result.go` | 扫描结果数据模型 |

## 扫描流程

### 整体流程图

```
用户点击扫描
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  阶段一：端口扫描 (0-45%)                                     │
│  - 根据本地 IP 计算 /23 网段范围                              │
│  - 使用 200 个并发 worker 扫描 22080 端口                     │
│  - 每个 IP 超时 2 秒                                         │
│  - 收集开放端口的 IP 列表                                     │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  阶段二：获取设备信息 (45-95%)                                │
│  - 使用 100 个并发 worker 获取设备详情                        │
│  - 调用 fetchCompanyProfile API 获取商家信息                  │
│  - 调用 getOSType API 获取设备类型                           │
│  - 每获取到一个设备立即保存到数据库                            │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  阶段三：扫描完成处理 (95-100%)                               │
│  - 检查是否正常完成（未被用户取消）                            │
│  - 如果正常完成：将未扫到的设备标记为离线                       │
│  - 更新 scan_sessions 表的 last_scan_at 时间                 │
└─────────────────────────────────────────────────────────────┘
```

### 详细步骤

#### 1. 前端发起扫描

**文件**: `frontend/src/pages/ScanPage.jsx`

```javascript
// 用户选择网段 IP 后点击扫描按钮
const startScan = async () => {
  setIsScanning(true);
  const response = await scanAPI.startScan(selectedIP);
}
```

#### 2. 后端启动扫描

**文件**: `backend-go/internal/handlers/scan.go`

```go
func (h *ScanHandler) StartScan(c *gin.Context) {
    // 1. 解析请求，获取本地 IP
    var req StartScanRequest
    c.ShouldBindJSON(&req)

    // 2. 启动扫描服务
    h.scanService.StartScan(req.LocalIP, func(result map[string]interface{}) {
        h.saveScanResult(result)  // 每个设备立即保存
    })

    // 3. 启动后台 goroutine 等待扫描完成
    go func() {
        for {
            status := h.scanService.GetStatus()
            if !status.IsScanning {
                // 扫描完成后的处理
                if !status.WasCancelled && len(status.MerchantIDs) > 0 {
                    h.deviceRepo.SetOfflineNotInMerchantIDs(status.MerchantIDs)
                }
                // 更新扫描时间
                session.LastScanAt = time.Now()
                h.deviceRepo.UpdateScanSession(session)
                return
            }
            time.Sleep(500 * time.Millisecond)
        }
    }()
}
```

#### 3. 网络扫描执行

**文件**: `backend-go/internal/services/scan_service.go`

```go
func (s *ScanService) performScan(ctx context.Context, localIP string, onResult func(result map[string]interface{})) {
    // 1. 计算网段范围 (/23)
    _, ipNet, _ := net.ParseCIDR(localIP + "/23")
    hosts := generateHosts(ipNet)

    // 2. 并发端口扫描 (200 workers)
    for ip := range ipChan {
        if s.scanPort(ip, 22080, 2) {  // 2秒超时
            resultChan <- ip
        }
    }

    // 3. 并发获取设备信息 (100 workers)
    for ip := range fetchChan {
        result := s.fetchAndProcess(ip, 22080)
        onResult(result)  // 回调保存结果
    }
}
```

#### 4. 获取设备信息

**API 端点**:
- `http://{ip}:22080/kpos/webapp/store/fetchCompanyProfile` - 获取商家信息
- `http://{ip}:22080/kpos/webapp/os/getOSType` - 获取设备类型

**提取的字段**:
| 字段 | 来源 | 说明 |
|------|------|------|
| merchantId | company.merchantId | 商家唯一标识 |
| name | company.name | 设备/商家名称 |
| version | company.appInfo.version | 应用版本 |
| type | getOSType API | 系统类型 (Linux/Windows) |

## 数据库存储逻辑

### 保存策略

**文件**: `backend-go/internal/handlers/scan.go`

```go
func (h *ScanHandler) saveScanResult(result map[string]interface{}) {
    merchantID := result["merchantId"]

    if merchantID == "" {
        // 无 merchantId：按 IP 查找更新或新建
        existing := GetScanResultByIPAndEmptyMerchant(ip)
        if existing != nil {
            UpdateScanResult(existing)
        } else {
            CreateScanResult(scanResult)
        }
        return
    }

    // 有 merchantId：按 merchantId 查找更新或新建
    existing := GetScanResultByMerchantID(merchantID)
    if existing != nil {
        UpdateScanResult(existing)
    } else {
        CreateScanResult(scanResult)
    }
}
```

### 匹配规则

| 场景 | 匹配条件 | 操作 |
|------|---------|------|
| 有 merchantId，已存在 | merchant_id 相同 | 更新记录 |
| 有 merchantId，不存在 | - | 新建记录 |
| 无 merchantId，已存在 | IP 相同且 merchant_id 为空 | 更新记录 |
| 无 merchantId，不存在 | - | 新建记录 |

## 设备删除逻辑

**文件**: `backend-go/internal/handlers/device.go`

支持删除有 merchant_id 和无 merchant_id 的设备：

```go
func (h *DeviceHandler) DeleteDevice(c *gin.Context) {
    idParam := c.Param("merchant_id")

    // 1. 优先按 merchantID 查找
    device, err := h.deviceRepo.GetScanResultByMerchantID(idParam)
    if err != nil {
        // 2. 如果找不到，按 IP 查找（用于无 merchant_id 的设备）
        device, err = h.deviceRepo.GetScanResultByIPAndEmptyMerchant(idParam)
        if err != nil {
            response.NotFound(c, "设备不存在")
            return
        }

        // 无 merchant_id 设备：直接删除，无关联记录
        h.deviceRepo.DeleteScanResultByIP(idParam)
        return
    }

    // 有 merchant_id 设备：事务删除设备及所有关联记录
    tx := h.deviceRepo.BeginTx()
    tx.DeleteOccupancy(merchantID)           // 占用记录
    tx.DeleteClaimsByMerchantID(merchantID)  // 认领记录
    tx.DeleteProperty(merchantID)            // 分类属性
    tx.DeleteBorrowRequestsByMerchantID(merchantID) // 借用申请
    tx.DeleteScanResult(merchantID)          // 设备本身
    tx.Commit()
}
```

### 删除规则

| 设备类型 | 删除方式 | 关联数据处理 |
|---------|---------|-------------|
| 有 merchant_id | 按 merchant_id 删除 | 同时删除占用、认领、分类、借用申请等关联记录 |
| 无 merchant_id | 按 IP 删除 | 直接删除，无关联记录 |

## 在线状态管理

### 状态更新逻辑

```
扫描开始
    │
    ├── 扫描到设备 → is_online = true, last_online_time = now()
    │
    ▼
扫描完成
    │
    ├── 正常完成 (WasCancelled = false)
    │   └── 调用 SetOfflineNotInMerchantIDs(merchantIDs)
    │       将不在本次扫描结果中的设备标记为 is_online = false
    │
    └── 用户取消 (WasCancelled = true)
        └── 不标记离线，保持原有状态
```

### SetOfflineNotInMerchantIDs 方法

**文件**: `backend-go/internal/repository/device_repo.go`

```go
func (r *DeviceRepository) SetOfflineNotInMerchantIDs(merchantIDs []string) error {
    return r.db.Model(&models.ScanResult{}).
        Where("merchant_id != '' AND merchant_id NOT IN ?", merchantIDs).
        Update("is_online", false).Error
}
```

**注意**: 无 merchant_id 的设备不会被标记为离线，因为无法正常使用。

## 数据模型

### ScanResult 表

**文件**: `backend-go/internal/models/scan_result.go`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint | 主键 |
| ip | string | 设备 IP 地址 |
| merchant_id | *string | 商家 ID（唯一标识） |
| name | *string | 设备名称 |
| version | *string | 版本号 |
| type | *string | 系统类型 |
| full_data | *string | 完整 JSON 数据 |
| is_online | bool | 是否在线 |
| last_online_time | time | 最后在线时间 |
| scanned_at | time | 扫描时间 |
| owner_id | *uint | 认领者 ID |

### ScanStatus 结构

**文件**: `backend-go/internal/services/scan_service.go`

| 字段 | 类型 | 说明 |
|------|------|------|
| IsScanning | bool | 是否正在扫描 |
| Progress | int | 扫描进度 (0-100) |
| CurrentIP | string | 当前扫描的 IP |
| Results | []map | 已扫描的设备列表 |
| Error | string | 错误信息 |
| WasCancelled | bool | 是否被用户取消 |
| MerchantIDs | []string | 本次扫描到的设备 ID |

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/scan/local-ips | GET | 获取本地 IP 列表 |
| /api/scan/start | POST | 开始扫描 |
| /api/scan/status | GET | 获取扫描状态 |
| /api/scan/stop | POST | 停止扫描 |
| /api/scan/device/:ip | GET | 获取设备详情 |

## 前端轮询机制

**文件**: `frontend/src/pages/ScanPage.jsx`

```javascript
// 扫描开始后，每 1 秒轮询扫描状态
useEffect(() => {
  if (isScanning) {
    intervalId = setInterval(async () => {
      const status = await scanAPI.getScanStatus();
      setScanProgress(status.progress);
      if (!status.is_scanning) {
        setIsScanning(false);
        loadDevices();  // 刷新设备列表
      }
    }, 1000);
  }
}, [isScanning]);
```

## 并发配置

| 参数 | 值 | 说明 |
|------|-----|------|
| 端口扫描并发数 | 200 | 同时扫描的 IP 数量 |
| 信息获取并发数 | 100 | 同时获取设备信息的数量 |
| 端口扫描超时 | 2s | 每个端口连接超时时间 |
| 信息获取超时 | 5s | API 请求超时时间 |
| 信息获取重试 | 2次 | 失败重试次数 |

## 注意事项

1. **设备唯一性**: 以 `merchant_id` 为主要标识，无 `merchant_id` 时以 `IP` 标识
2. **实时保存**: 每扫描到一个设备立即保存，而非等待全部完成
3. **离线标记**: 只有正常完成的扫描才会标记离线，取消或出错不会
4. **无 merchant_id 设备**: 不会被标记为离线，因为无法正常使用
