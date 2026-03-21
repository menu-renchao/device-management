# Codex 项目说明

## 语言设置

**所有对话和交流均使用中文（简体）。**

## 项目概述

这是一个 POS 设备扫描管理系统，包含：

- **前端**: React + Vite + Ant Design
- **后端**: Python Flask (原有) / Go Gin (重构中)
- **数据库**: SQLite

## 目录结构


## 开发说明

- 默认管理员账号: `admin` / `admin123`
- 前端开发端口: 3000
- 后端 API 端口: 5000

## 前端编码规范

### 禁止使用浏览器原生对话框

**严禁**在任何组件中使用 `window.confirm()`、`window.alert()`、`window.prompt()`。

原因：原生对话框阻塞主线程、无法定制样式、用户体验差，与项目整体 UI 风格不一致。

**替代方案：**

| 场景 | 做法 |
|------|------|
| 需要用户确认后再执行危险/不可逆操作（删除等） | 使用 `await toast.confirm(message, options)` |
| 需要用户确认后再执行普通操作（执行升级、创建备份等） | 使用 `await toast.confirm(message, { variant: 'primary' })` |
| 纯通知提示（无需确认） | 使用 `toast.success/error/warning/info(message)` |

**`toast.confirm` 用法：**

```jsx
// 危险操作（确认按钮为红色，默认）
const ok = await toast.confirm('确定要删除此记录吗？此操作不可恢复。', {
  title: '删除确认',           // 对话框标题
  confirmText: '删除',        // 确认按钮文字（默认"确定"）
  cancelText: '取消',         // 取消按钮文字（默认"取消"）
});
if (!ok) return;

// 普通操作（确认按钮为蓝色）
const ok = await toast.confirm('确定要执行此操作吗？', {
  title: '确认操作',
  variant: 'primary',
  confirmText: '确认执行',
});
if (!ok) return;
```

**`toast.confirm` 的 options 参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | `'确认操作'` | 对话框标题 |
| `confirmText` | string | `'确定'` | 确认按钮文字 |
| `cancelText` | string | `'取消'` | 取消按钮文字 |
| `variant` | `'danger' \| 'primary'` | `'danger'` | 确认按钮样式；删除等危险操作用 `danger`，一般操作用 `primary'` |

**实现位置：** `frontend/src/contexts/ToastContext.jsx` + `frontend/src/components/ConfirmDialog.jsx`
