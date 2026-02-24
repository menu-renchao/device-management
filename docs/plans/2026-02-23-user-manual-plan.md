# 用户使用手册实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 POS 设备管理系统创建一个完整的用户使用手册页面，帮助用户了解和使用系统各项功能。

**Architecture:** 创建 HelpPage.jsx 页面组件，采用左侧分类导航 + 右侧内容区域的布局。帮助内容硬编码在组件中，无需后端支持。

**Tech Stack:** React, React Router, Apple Design System CSS

---

## Task 1: 创建 HelpPage 组件

**Files:**
- Create: `frontend/src/pages/HelpPage.jsx`

**Step 1: 创建 HelpPage.jsx 基础结构**

创建文件 `frontend/src/pages/HelpPage.jsx`，包含完整的帮助手册页面组件：

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// 帮助内容数据
const helpContent = {
  quickstart: {
    title: '快速入门',
    sections: [
      {
        id: 'system-intro',
        title: '系统简介',
        content: `
## 系统概述

Menusifu 设备管理平台是一个集成的设备管理系统，用于管理 POS 设备、移动设备和 Linux 服务器配置。

## 主要功能

- **POS 设备管理**：扫描、监控和管理局域网内的 POS 设备
- **移动设备管理**：管理公司移动设备的借用和归还
- **Linux 配置**：远程配置和管理 Linux 服务器
- **借用审核**：处理设备借用申请和审批
- **用户管理**：管理员可管理用户账号和权限

## 用户角色

| 角色 | 权限说明 |
|------|----------|
| 普通用户 | 查看设备、申请借用、申请认领 |
| 负责人 | 管理负责的设备、审核借用申请 |
| 管理员 | 全部权限，包括用户管理、设备删除等 |
        `
      }
    ]
  },
  pos: {
    title: 'POS 设备',
    sections: [
      {
        id: 'device-scan',
        title: '设备扫描',
        content: `
## 功能说明

设备扫描功能用于发现局域网内的 POS 设备，获取设备的在线状态、配置信息等。

## 操作步骤

1. **选择网段**：在页面顶部选择要扫描的 IP 网段
2. **开始扫描**：点击"开始扫描"按钮启动扫描
3. **查看进度**：扫描过程中会显示进度条和已发现的设备数量
4. **停止扫描**：如需提前结束，可点击"停止扫描"按钮

## 扫描结果

扫描完成后，设备列表会显示以下信息：

- **IP 地址**：设备的网络地址，绿色圆点表示在线
- **商户 ID**：设备的商户标识
- **商户名称**：商户的显示名称
- **设备版本**：当前运行的软件版本
- **归属状态**：设备是否已被认领
- **占用状态**：设备是否被借用

## 搜索功能

支持按以下条件筛选设备：
- IP 地址
- 商户 ID
- 商户名称
- 设备版本
        `
      },
      {
        id: 'device-detail',
        title: '设备详情',
        content: `
## 查看设备详情

点击设备行的"详情"按钮，可查看设备的详细信息：

- **基本信息**：IP、商户 ID、商户名称、版本
- **配置信息**：设备的具体配置参数
- **设备状态**：在线/离线状态
- **归属信息**：设备负责人

## 进入配置页面

对于有权限的设备（管理员、负责人或借用人），点击"配置"按钮可进入 Linux 配置页面，进行远程管理操作。
        `
      },
      {
        id: 'borrow-claim',
        title: '借用与认领',
        content: `
## 设备借用

### 申请借用

1. 找到需要借用的设备
2. 点击占用状态栏的"借用"按钮
3. 填写借用信息：
   - **借用原因**：说明借用目的
   - **预计归还时间**：选择预计归还日期
4. 提交申请后等待审核

### 借用审核流程

1. 设备负责人或管理员收到审核通知
2. 审核人在"工作台-待我审核"或"管理中心"查看申请
3. 审核人选择"通过"或"拒绝"
4. 申请人收到审核结果通知

### 归还设备

1. 进入"工作台-我的借用"
2. 找到要归还的设备
3. 点击"归还"按钮

## 设备认领

### 申请认领

1. 找到未认领的设备（归属状态为空）
2. 点击"认领"按钮
3. 填写认领原因
4. 提交后等待管理员审核

### 认领审核

管理员审核通过后，您将成为该设备的负责人，拥有设备的管理权限。
        `
      }
    ]
  },
  mobile: {
    title: '移动设备',
    sections: [
      {
        id: 'device-list',
        title: '设备列表',
        content: `
## 功能说明

移动设备管理页面用于管理公司的移动设备（如手机、平板等）。

## 视图模式

支持两种视图模式：
- **卡片视图**：以卡片形式展示设备，直观显示设备图片
- **列表视图**：以表格形式展示设备，信息更紧凑

点击右上角的切换按钮可在两种视图间切换。

## 设备信息

每个设备显示以下信息：
- **设备名称**：设备的标识名称
- **设备类型**：手机/平板等
- **负责人**：设备的管理负责人
- **借用状态**：是否被借用
- **借用者**：当前借用的人员
        `
      },
      {
        id: 'mobile-borrow',
        title: '借用管理',
        content: `
## 申请借用移动设备

1. 找到需要借用的设备
2. 点击设备卡片上的"借用"按钮
3. 填写借用信息：
   - **借用原因**：说明借用目的
   - **预计归还时间**：选择预计归还日期
4. 提交申请

## 借用流程

1. 提交借用申请
2. 设备负责人审核
3. 审核通过后领取设备
4. 使用完毕后归还设备

## 查看借用状态

在"工作台-我的借用"中可查看当前借用的设备状态。
        `
      }
    ]
  },
  linux: {
    title: 'Linux 配置',
    sections: [
      {
        id: 'pos-control',
        title: 'POS 控制',
        content: `
## 功能说明

POS 控制页面用于远程管理 Linux 设备上的 POS 服务。

## 服务控制

- **启动服务**：启动 POS 应用服务
- **停止服务**：停止 POS 应用服务
- **重启服务**：重启 POS 应用服务

## 配置管理

可查看和修改 POS 应用的配置文件，包括：
- 数据库连接配置
- 应用参数设置
- 日志级别配置

## 注意事项

修改配置后需要重启服务才能生效。
        `
      },
      {
        id: 'upgrade',
        title: '升级管理',
        content: `
## 功能说明

升级管理页面用于管理设备上的软件版本升级。

## 版本信息

显示设备当前运行的版本信息，包括：
- 当前版本号
- 版本更新时间
- 版本说明

## 升级操作

1. 选择要升级的目标版本
2. 确认升级信息
3. 开始升级
4. 等待升级完成

## 升级注意事项

- 升级过程中请勿断开网络连接
- 建议在业务低峰期进行升级
- 升级前建议先备份配置
        `
      },
      {
        id: 'backup-log',
        title: '备份与日志',
        content: `
## 备份管理

### 创建备份

1. 点击"创建备份"按钮
2. 输入备份备注信息
3. 确认创建备份

### 恢复备份

1. 选择要恢复的备份点
2. 点击"恢复"按钮
3. 确认恢复操作

### 下载备份

可下载备份文件到本地保存。

## 日志查看

### 查看实时日志

1. 选择日志类型（应用日志/系统日志）
2. 设置日志级别
3. 点击"查看日志"

### 日志搜索

支持按关键词搜索日志内容，快速定位问题。
        `
      }
    ]
  },
  workspace: {
    title: '工作台',
    sections: [
      {
        id: 'borrow-approval',
        title: '借用审核',
        content: `
## 功能说明

如果您是设备负责人或管理员，可以在"待我审核"中处理设备借用申请。

## 审核流程

1. 查看借用申请详情
2. 了解申请人、借用原因、预计归还时间
3. 选择"通过"或"拒绝"
4. 如有需要，可添加审核意见

## 审核建议

- 确认借用原因是否合理
- 检查预计归还时间是否合适
- 考虑设备当前的使用情况
        `
      },
      {
        id: 'my-requests',
        title: '我的申请',
        content: `
## 功能说明

"我的申请"页面显示您提交的所有申请记录。

## 申请类型

- **借用申请**：设备借用申请记录
- **认领申请**：设备认领申请记录

## 申请状态

- **待审核**：申请已提交，等待审核
- **已通过**：申请已通过审核
- **已拒绝**：申请被拒绝
- **已取消**：申请已取消

## 操作

- 可取消待审核的申请
- 可查看申请详情和审核意见
        `
      },
      {
        id: 'notifications',
        title: '系统通知',
        content: `
## 功能说明

系统通知页面显示与您相关的所有系统消息。

## 通知类型

- **审核结果通知**：您提交的申请审核结果
- **借用提醒**：借用即将到期提醒
- **系统公告**：系统维护、更新等公告

## 通知操作

- 点击通知可查看详情
- 可标记通知为已读
- 可删除已读通知

## 通知提醒

页面顶部的通知铃铛会显示未读通知数量，点击可快速查看最新通知。
        `
      }
    ]
  },
  admin: {
    title: '管理员功能',
    sections: [
      {
        id: 'user-management',
        title: '用户管理',
        content: `
## 功能说明

用户管理功能仅管理员可访问，用于管理系统用户账号。

## 用户列表

显示所有系统用户，包括：
- 用户名
- 显示名称
- 角色
- 创建时间
- 状态

## 用户操作

### 创建用户

1. 点击"创建用户"按钮
2. 填写用户信息：
   - 用户名（登录账号）
   - 显示名称
   - 密码
   - 角色
3. 保存创建

### 编辑用户

可修改用户的显示名称、角色等信息。

### 删除用户

删除用户后，该用户将无法登录系统。

## 角色说明

| 角色 | 权限 |
|------|------|
| 普通用户 | 查看设备、申请借用 |
| 管理员 | 全部权限 |
        `
      },
      {
        id: 'approval-management',
        title: '审核管理',
        content: `
## 功能说明

管理员可在管理中心处理所有类型的审核申请。

## 审核类型

### 认领审核

审核用户提交的设备认领申请：
1. 查看认领申请详情
2. 确认认领人是否合适
3. 通过或拒绝申请

### 借用审核

审核设备借用申请：
- **POS 设备借用**：审核 POS 设备的借用申请
- **移动设备借用**：审核移动设备的借用申请

## 批量操作

管理员可批量处理多个申请，提高审核效率。
        `
      }
    ]
  }
};

// 帮助页面组件
const HelpPage = () => {
  const [activeSection, setActiveSection] = useState('system-intro');
  const contentRef = useRef(null);

  // 获取所有菜单项
  const menuItems = Object.entries(helpContent).map(([key, value]) => ({
    key,
    title: value.title,
    sections: value.sections.map(s => ({ id: s.id, title: s.title }))
  }));

  // 滚动到指定章节
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element && contentRef.current) {
      const headerOffset = 20;
      const elementPosition = element.offsetTop;
      contentRef.current.scrollTo({
        top: elementPosition - headerOffset,
        behavior: 'smooth'
      });
    }
  };

  // 将 markdown 风格的内容转换为 HTML
  const renderContent = (content) => {
    const lines = content.trim().split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;
    let inTable = false;
    let tableRows = [];

    const flushList = () => {
      if (currentList.length > 0) {
        const ListTag = listType === 'ul' ? 'ul' : 'ol';
        elements.push(
          <ListTag key={elements.length} style={styles.list}>
            {currentList.map((item, idx) => (
              <li key={idx} style={styles.listItem}>{item}</li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        elements.push(
          <table key={elements.length} style={styles.table}>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={idx} style={idx === 0 ? styles.tableHeaderRow : styles.tableRow}>
                  {row.map((cell, cellIdx) => (
                    idx === 0 ? (
                      <th key={cellIdx} style={styles.tableHeader}>{cell}</th>
                    ) : (
                      <td key={cellIdx} style={styles.tableCell}>{cell}</td>
                    )
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, index) => {
      // 处理表格
      if (line.includes('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length > 0) {
          // 跳过分隔行
          if (!cells.every(c => /^[-:]+$/.test(c))) {
            inTable = true;
            tableRows.push(cells);
          }
          return;
        }
      } else if (inTable) {
        flushTable();
      }

      // 处理列表
      const ulMatch = line.match(/^[-•]\s+(.+)/);
      const olMatch = line.match(/^\d+\.\s+(.+)/);

      if (ulMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        currentList.push(ulMatch[1]);
        return;
      }

      if (olMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentList.push(olMatch[1]);
        return;
      }

      flushList();

      // 处理标题
      if (line.startsWith('## ')) {
        elements.push(<h2 key={index} style={styles.h2}>{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={index} style={styles.h3}>{line.slice(4)}</h3>);
      } else if (line.startsWith('**') && line.endsWith('**')) {
        elements.push(<p key={index} style={styles.paragraph}><strong>{line.slice(2, -2)}</strong></p>);
      } else if (line.trim() === '') {
        // 空行
      } else {
        elements.push(<p key={index} style={styles.paragraph}>{line}</p>);
      }
    });

    flushList();
    flushTable();

    return elements;
  };

  return (
    <div style={styles.container}>
      {/* 页面头部 */}
      <div style={styles.header}>
        <h1 style={styles.title}>帮助中心</h1>
        <Link to="/" style={styles.backLink}>
          <svg style={styles.backIcon} viewBox="0 0 24 24" fill="none">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/>
          </svg>
          返回首页
        </Link>
      </div>

      <div style={styles.content}>
        {/* 左侧导航菜单 */}
        <div style={styles.sidebar}>
          {menuItems.map(category => (
            <div key={category.key} style={styles.menuCategory}>
              <div style={styles.menuCategoryTitle}>{category.title}</div>
              {category.sections.map(section => (
                <button
                  key={section.id}
                  style={{
                    ...styles.menuItem,
                    ...(activeSection === section.id ? styles.menuItemActive : {})
                  }}
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.title}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* 右侧内容区域 */}
        <div style={styles.main} ref={contentRef}>
          {Object.entries(helpContent).map(([key, category]) => (
            <div key={key} style={styles.section}>
              {category.sections.map(section => (
                <div key={section.id} id={section.id} style={styles.article}>
                  <h2 style={styles.articleTitle}>{section.title}</h2>
                  <div style={styles.articleContent}>
                    {renderContent(section.content)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 样式定义
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 52px)',
    backgroundColor: '#F5F5F7',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E5EA',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: 0,
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#007AFF',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  backIcon: {
    width: '18px',
    height: '18px',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '220px',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E5EA',
    overflowY: 'auto',
    padding: '16px 0',
    flexShrink: 0,
  },
  menuCategory: {
    marginBottom: '8px',
  },
  menuCategoryTitle: {
    padding: '8px 20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#86868B',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    fontSize: '14px',
    color: '#1D1D1F',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  menuItemActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    color: '#007AFF',
    fontWeight: '500',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
  },
  section: {
    marginBottom: '32px',
  },
  article: {
    marginBottom: '40px',
    scrollMarginTop: '20px',
  },
  articleTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5EA',
  },
  articleContent: {
    color: '#1D1D1F',
    lineHeight: '1.7',
  },
  h2: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: '24px',
    marginBottom: '12px',
  },
  h3: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: '20px',
    marginBottom: '10px',
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: '1.7',
    marginBottom: '12px',
    color: '#1D1D1F',
  },
  list: {
    margin: '12px 0',
    paddingLeft: '24px',
  },
  listItem: {
    fontSize: '14px',
    lineHeight: '1.7',
    marginBottom: '6px',
    color: '#1D1D1F',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '16px 0',
    fontSize: '14px',
  },
  tableHeaderRow: {
    backgroundColor: '#F2F2F7',
  },
  tableRow: {
    borderBottom: '1px solid #E5E5EA',
  },
  tableHeader: {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#86868B',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  tableCell: {
    padding: '10px 12px',
    color: '#1D1D1F',
  },
};

export default HelpPage;
```

**Step 2: 验证文件创建成功**

确认文件 `frontend/src/pages/HelpPage.jsx` 已正确创建。

---

## Task 2: 添加路由配置

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: 导入 HelpPage 组件**

在 `App.jsx` 顶部的 import 区域添加：

```jsx
import HelpPage from './pages/HelpPage';
```

位置：在第 12 行 `import WorkspacePage from './pages/WorkspacePage';` 之后

**Step 2: 添加帮助中心路由**

在路由配置区域，工作台路由之后添加帮助中心路由：

```jsx
{/* 帮助中心路由（所有登录用户可访问） */}
<Route path="/help" element={
  <PrivateRoute>
    <MainLayout>
      <HelpPage />
    </MainLayout>
  </PrivateRoute>
} />
```

位置：在第 140 行 `</PrivateRoute>` 之后，`{/* 借用审核路由 */}` 注释之前

**Step 3: 验证路由添加正确**

确认 `/help` 路由已正确添加到路由配置中。

---

## Task 3: 添加导航菜单入口

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: 在导航栏添加帮助中心链接**

在 Navbar 组件的 links 区域，管理中心链接之后添加帮助中心链接：

```jsx
<Link to="/help" style={navStyles.link}>
  <svg style={navStyles.linkIcon} viewBox="0 0 24 24" fill="none">
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" fill="currentColor"/>
  </svg>
  帮助中心
</Link>
```

位置：在第 61 行 `{isAdmin() && (...)}` 代码块之后，`</div>` 之前

**Step 2: 验证导航添加正确**

确认导航栏已正确显示"帮助中心"链接。

---

## Task 4: 测试验证

**Step 1: 启动开发服务器**

```bash
cd frontend && npm run dev
```

**Step 2: 验证功能**

1. 登录系统
2. 点击导航栏的"帮助中心"链接
3. 验证帮助页面正确显示
4. 测试左侧菜单导航功能
5. 测试各个章节内容是否正确展示

**Step 3: 提交代码**

```bash
git add frontend/src/pages/HelpPage.jsx frontend/src/App.jsx
git commit -m "feat: add user manual help center page

- Add HelpPage component with navigation sidebar
- Include comprehensive documentation for all features
- Add /help route and navigation menu entry

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 实现检查清单

- [ ] HelpPage.jsx 组件创建完成
- [ ] 路由 `/help` 配置完成
- [ ] 导航栏"帮助中心"入口添加完成
- [ ] 左侧分类导航正常工作
- [ ] 内容区域滚动和锚点定位正常
- [ ] Apple Design System 样式一致
- [ ] 所有 6 大类 15 小节内容完整
- [ ] 代码已提交
