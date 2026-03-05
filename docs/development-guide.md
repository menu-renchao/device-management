# 开发规范与指南

> 文档版本：v1.0 | 更新日期：2026-03-05

---

## 1. 开发环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Go | 1.21+ | 后端语言 |
| Node.js | 18+ | 前端构建 |
| npm | 8+ | 包管理 |
| Git | — | 版本控制 |

---

## 2. 快速启动

```bash
# 克隆项目后

# 1. 启动后端
cd backend-go
go mod download
go run cmd/server/main.go
# 服务运行于 http://localhost:5000

# 2. 启动前端（另开终端）
cd frontend
npm install
npm run dev
# 服务运行于 http://localhost:3000

# 3. 访问
# 浏览器打开 http://localhost:3000
# 默认管理员：admin / admin123
```

也可使用项目根目录的 `.bat` 脚本：
- `start-backend.bat` — 启动后端
- `start-frontend.bat` — 启动前端
- `start-go.bat` — 编译并启动后端

---

## 3. 后端开发规范

### 3.1 添加新 API 端点（标准流程）

```
1. internal/models/    → 定义数据结构（GORM 模型）
2. internal/repository/ → 实现数据访问层
3. internal/services/  → 实现业务逻辑
4. internal/handlers/  → 实现 HTTP 处理器
5. cmd/server/main.go  → 注册路由、依赖注入
```

### 3.2 Handler 编写规范

```go
func (h *XxxHandler) ActionName(c *gin.Context) {
    // 1. 绑定并校验请求参数
    var req XxxRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, "参数错误: "+err.Error())
        return
    }

    // 2. 调用 Service
    result, err := h.xxxService.DoSomething(req)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }

    // 3. 返回响应
    response.Success(c, result)
}
```

**禁止**在 Handler 中直接操作数据库（应通过 Service/Repository）。

### 3.3 统一响应格式

使用 `pkg/response` 包：

```go
response.Success(c, data)           // 200，正常返回
response.BadRequest(c, "消息")       // 400，参数错误
response.Unauthorized(c, "消息")    // 401，未认证
response.Forbidden(c, "消息")       // 403，无权限
response.NotFound(c, "消息")        // 404，资源不存在
response.InternalError(c, "消息")   // 500，服务器错误
```

### 3.4 新增数据模型

```go
type NewModel struct {
    ID        uint           `gorm:"primaryKey" json:"id"`
    // ... 字段定义
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // 按需添加软删除
}

func (NewModel) TableName() string {
    return "table_name"
}
```

在 `main.go` 的 `AutoMigrate` 列表中添加 `&models.NewModel{}`。

### 3.5 日志使用规范

```go
// 正确：使用结构化日志，不用 fmt.Println
logger.Info("操作描述", "key1", value1, "key2", value2)
logger.Error("错误描述", "error", err)
logger.Debug("调试信息", "data", data)

// 错误：禁止在业务代码中使用
fmt.Println(...)
log.Println(...)
```

---

## 4. 前端开发规范

### 4.1 禁止使用浏览器原生对话框

**严禁**：`window.confirm()`、`window.alert()`、`window.prompt()`

**原因**：阻塞主线程、无法定制样式、与整体 UI 风格不符。

**替代方案**：

```jsx
import { useToast } from '../contexts/ToastContext';

const MyComponent = () => {
  const toast = useToast();

  const handleDelete = async () => {
    // 危险操作确认（确认按钮红色）
    const ok = await toast.confirm('确定要删除此记录吗？此操作不可恢复。', {
      title: '删除确认',
      confirmText: '删除',
    });
    if (!ok) return;
    // 执行删除...
    toast.success('删除成功');
  };

  const handleUpgrade = async () => {
    // 普通操作确认（确认按钮蓝色）
    const ok = await toast.confirm('确定要执行升级吗？', {
      title: '升级确认',
      variant: 'primary',
      confirmText: '确认升级',
    });
    if (!ok) return;
    // 执行升级...
  };
};
```

`toast.confirm` 参数说明：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | `'确认操作'` | 对话框标题 |
| `confirmText` | string | `'确定'` | 确认按钮文字 |
| `cancelText` | string | `'取消'` | 取消按钮文字 |
| `variant` | `'danger' \| 'primary'` | `'danger'` | 按钮样式 |

### 4.2 添加新页面（标准流程）

```
1. src/pages/NewPage.jsx         → 创建页面组件
2. src/services/api.js           → 添加 API 调用方法
3. src/App.jsx                   → 添加路由配置
4. src/App.jsx (Navbar)          → 视情况添加导航链接
```

### 4.3 API 调用规范

```jsx
// 推荐：使用 services/api.js 中的封装方法
import { xxxAPI } from '../services/api';

const loadData = async () => {
  try {
    const data = await xxxAPI.getData();
    setData(data);
  } catch (err) {
    toast.error(err.response?.data?.message || '加载失败');
  }
};

// 禁止：在组件中直接使用 axios
import axios from 'axios'; // 禁止
```

### 4.4 组件命名规范

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| 页面组件 | PascalCase + Page | `ScanPage.jsx` |
| 通用组件 | PascalCase | `DetailModal.jsx` |
| Context | PascalCase + Context | `AuthContext.jsx` |
| Hook | use + PascalCase | `useAuth` |

### 4.5 样式规范

本项目所有样式使用 inline style 对象定义：

```jsx
const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#F5F5F7',
    borderRadius: '8px',
  },
  title: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1D1D1F',
  }
};

// 使用
<div style={styles.container}>
  <h2 style={styles.title}>标题</h2>
</div>
```

**禁止**引入外部 CSS 文件或使用 CSS modules（保持项目风格一致）。

### 4.6 颜色规范

```
主要文字：#1D1D1F
次要文字：#86868B
主品牌蓝：#007AFF
危险红：  #FF3B30
成功绿：  #34C759
警告橙：  #FF9F0A
背景灰：  #F5F5F7
卡片白：  #FFFFFF
```

---

## 5. Git 提交规范

```
类型(scope): 简短描述

类型：
  feat     - 新功能
  fix      - Bug 修复
  refactor - 重构（非新功能，非 Bug 修复）
  docs     - 文档更新
  style    - 代码格式调整
  chore    - 构建配置等杂项

示例：
  feat(linux): 添加升级包扫描功能
  fix(scan): 修复无 merchantId 设备重复创建问题
  docs: 更新数据库设计文档
```

---

## 6. 常见开发场景

### 场景 1：新增设备相关操作（如批量标签）

**后端**：
1. `models/` 新增 `DeviceLabel` 模型
2. `repository/device_repo.go` 添加相关 CRUD 方法
3. `services/` 添加业务逻辑
4. `handlers/device.go` 添加接口
5. `main.go` 注册路由

**前端**：
1. `api.js` 的 `deviceAPI` 对象中添加调用方法
2. 在 `ScanTable.jsx` 或 `DetailModal.jsx` 中添加 UI

### 场景 2：新增 Linux 控制功能

**后端**：
1. `services/linux_service.go` 添加 SSH 命令执行方法
2. `handlers/linux.go` 添加 HTTP 接口
3. `main.go` 注册路由

**前端**：
1. `api.js` 的 `linuxAPI` 对象中添加调用方法
2. `pages/LinuxConfigPage.jsx` 相关 Tab 中添加 UI

### 场景 3：添加需要长时间运行的后台任务

参考 `UpgradeTaskManager`（`services/upgrade_task_service.go`）模式：
1. 创建任务并返回 `taskId`
2. 后台 goroutine 执行，通过 channel 传递进度
3. 前端使用 SSE 或轮询获取进度

---

## 7. 生产部署检查清单

- [ ] 修改 `.env` 中的 `JWT_SECRET_KEY`（强随机字符串）
- [ ] 修改默认管理员密码（`admin / admin123`）
- [ ] 将 `GIN_MODE` 设置为 `release`
- [ ] 配置正确的 `CORS_ORIGINS`（不使用 `*`）
- [ ] 设置合适的 `LOG_LEVEL`（建议 `warn` 或 `error`）
- [ ] 配置数据库文件备份策略
- [ ] 前端执行 `npm run build` 生成优化产物
- [ ] 确认防火墙规则（仅开放必要端口）

---

## 8. 已知技术债务

| 问题 | 位置 | 优先级 | 说明 |
|------|------|--------|------|
| 扫描状态为单例 | `ScanService` | 中 | 多用户同时扫描会冲突 |
| Token 无刷新机制 | `AuthContext` | 中 | access_token 过期后直接跳登录，无 refresh 逻辑 |
| SSH 密码明文传输 | `LinuxHandler` | 高 | 连接参数通过 HTTP body 传输，建议添加加密或只通过 HTTPS |
| 扫描并发数硬编码 | `ScanService` | 低 | 200/100 并发数应可配置 |
| 缺少单元测试 | 全项目 | 中 | 核心业务逻辑（ScanService、LinuxService）缺少测试覆盖 |
| SQLite 并发限制 | 数据库 | 低 | 当前规模（内网工具）足够，规模扩大后需迁移至 PostgreSQL |
