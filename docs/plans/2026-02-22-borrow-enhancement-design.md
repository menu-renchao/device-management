# 设备借用管理系统功能补全设计文档

## 概述

补全设备借用管理系统的功能，包括：我的申请、负责人权限、审核入口合并、超时处理、借用历史、拒绝原因。

## 需求清单

| 优先级 | 功能 | 实现方式 |
|--------|------|----------|
| P0 | 我的申请 | 工作台 - 我的申请 Tab |
| P0 | 负责人权限 | 后端权限检查扩展 + 工作台 - 我的设备 Tab |
| P1 | 合并审核入口 | 移除独立页面，整合到工作台 |
| P1 | 超时处理 | 定时任务 + 系统通知 |
| P2 | 借用历史 | 复用现有表，在我的申请中展示 |
| P2 | 拒绝原因 | 数据库新增字段 + API 修改 |

---

## 一、数据库设计

### 1.1 新增字段 - 拒绝原因

在两个借用申请表中增加 `rejection_reason` 字段：

```go
// DeviceBorrowRequest - POS设备借用申请
type DeviceBorrowRequest struct {
    // ... 现有字段 ...
    RejectionReason *string  // 新增：拒绝原因（选填）
}

// MobileBorrowRequest - 移动设备借用申请
type MobileBorrowRequest struct {
    // ... 现有字段 ...
    RejectionReason *string  // 新增：拒绝原因（选填）
}
```

### 1.2 新增表 - 系统通知

用于存储超时提醒等系统内通知：

```go
// SystemNotification - 系统通知表
type SystemNotification struct {
    ID        uint      // 主键
    UserID    uint      // 接收用户ID
    Title     string    // 通知标题
    Content   string    // 通知内容
    Type      string    // 类型：borrow_warning（借用即将到期）/ borrow_expired（借用已过期）
    IsRead    bool      // 是否已读
    RelatedID *uint     // 关联ID（借用申请ID）
    CreatedAt time.Time // 创建时间
}
```

### 1.3 复用现有表
- **借用历史**：复用现有 borrow_requests 表查询

---

## 二、API 设计

### 2.1 我的申请相关 API

```
GET  /api/my/borrow-requests              # 获取当前用户的所有借用申请
     响应：{ pos_requests: [...], mobile_requests: [...] }
```

### 2.2 审核拒绝 API 修改

```
POST /api/device/borrow-requests/:id/reject
     请求体：{ reason?: string }  // 新增选填的拒绝原因

POST /api/mobile/borrow-requests/:id/reject
     请求体：{ reason?: string }  // 新增选填的拒绝原因
```

### 2.3 超时处理相关 API

```
GET  /api/notifications                   # 获取当前用户的系统通知
POST /api/notifications/:id/read          # 标记通知为已读
POST /api/notifications/read-all          # 标记所有通知为已读
GET  /api/notifications/unread-count      # 获取未读通知数量
```

### 2.4 负责人权限扩展

现有 API 无需修改路径，在后端逻辑中扩展权限判断：
- 负责人对自己的设备：可审核借用、可主动释放、可修改信息、可删除

### 2.5 审核入口合并

- 保留管理中心的审核功能
- 删除独立的 `/borrow-approval` 路由和页面
- BorrowApprovalPage 组件可复用，作为工作台的子模块

---

## 三、前端页面设计

### 3.1 新增"工作台"页面（/workspace）

整合用户相关的所有功能，使用 Tabs 分隔：

```
工作台
├── Tab 1: 我的申请      - 查看借用申请状态（pending/approved/rejected）
├── Tab 2: 我的借用      - 当前正在借用的设备
├── Tab 3: 我的设备      - 作为负责人管理的设备（含审核借用功能）
└── Tab 4: 系统通知      - 超时提醒等通知
```

### 3.2 导航栏调整

- 所有登录用户可见"工作台"菜单
- 移除独立的"借用审核"菜单（BorrowApprovalPage）

### 3.3 管理中心调整

- 管理员的管理中心保留原有的全部设备管理功能
- "借用审核"功能整合到管理中心，或直接使用工作台

---

## 四、后端逻辑设计

### 4.1 权限控制扩展

```go
// 设备操作权限检查函数
func CanManageDevice(user *User, device *Device) bool {
    // 管理员可以管理所有设备
    if user.IsAdmin {
        return true
    }
    // 负责人可以管理自己的设备
    if device.OwnerID != nil && *device.OwnerID == user.ID {
        return true
    }
    return false
}
```

应用到以下操作：
- 审核借用申请
- 主动释放设备占用
- 修改设备信息
- 删除设备

### 4.2 定时任务 - 超时处理

```
调度频率：每小时执行一次

逻辑：
1. 查询所有正在占用的设备
2. 对于即将到期的（如提前 24 小时）：
   - 创建系统通知提醒借用者
3. 对于已过期的：
   - 释放设备占用（清除 occupier_id）
   - 创建系统通知告知借用者和负责人
   - 标记借用申请为 completed 状态
```

### 4.3 通知服务

```go
type NotificationService struct {
    repo *NotificationRepository
}

func (s *NotificationService) SendBorrowWarning(userID uint, deviceName string, endTime time.Time)
func (s *NotificationService) SendBorrowExpired(userID uint, deviceName string)
func (s *NotificationService) GetUnreadCount(userID uint) int
func (s *NotificationService) MarkAsRead(notificationID uint)
```

---

## 五、文件结构

### 5.1 后端新增文件

```
backend-go/
├── internal/
│   ├── models/
│   │   └── system_notification.go      # 新增：通知模型
│   ├── handlers/
│   │   ├── workspace.go                # 新增：工作台 API
│   │   └── notification.go             # 新增：通知 API
│   ├── repository/
│   │   └── notification_repo.go        # 新增：通知数据访问
│   └── services/
│       ├── notification_service.go     # 新增：通知服务
│       └── scheduler_service.go        # 新增：定时任务服务
```

### 5.2 后端修改文件

```
backend-go/
├── internal/
│   ├── models/
│   │   ├── device_borrow_request.go    # 修改：新增 rejection_reason 字段
│   │   └── mobile_borrow_request.go    # 修改：新增 rejection_reason 字段
│   ├── handlers/
│   │   ├── device.go                   # 修改：reject 接口支持原因
│   │   └── mobile.go                   # 修改：reject 接口支持原因
│   └── repository/
│       └── device_repo.go              # 修改：权限检查逻辑
```

### 5.3 前端新增文件

```
frontend/src/
├── pages/
│   └── WorkspacePage.jsx               # 新增：工作台页面
├── components/
│   ├── workspace/
│   │   ├── MyRequestsTab.jsx           # 新增：我的申请 Tab
│   │   ├── MyBorrowsTab.jsx            # 新增：我的借用 Tab
│   │   ├── MyDevicesTab.jsx            # 新增：我的设备 Tab
│   │   └── NotificationsTab.jsx        # 新增：系统通知 Tab
│   └── NotificationBell.jsx            # 新增：通知铃铛组件（导航栏用）
```

### 5.4 前端修改文件

```
frontend/src/
├── App.jsx                             # 修改：新增工作台路由，移除 borrow-approval
├── services/api.js                     # 修改：新增相关 API 调用
└── components/Layout.jsx               # 修改：导航栏菜单调整
```

---

## 六、实现顺序

1. **数据库** - 新增通知表、申请表新增拒绝原因字段
2. **后端模型和仓储** - 通知模型、权限扩展
3. **后端服务** - 通知服务、定时任务
4. **后端 API** - 工作台接口、通知接口、修改审核接口
5. **前端组件** - 工作台页面及各 Tab 组件
6. **前端集成** - 路由、导航栏、通知铃铛
7. **测试验证** - 功能测试
