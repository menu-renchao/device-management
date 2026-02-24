import React, { useState, useRef } from 'react';
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

    // 渲染列表项内容（处理 **标题**：描述 格式）
    const renderListItemText = (text) => {
      // 处理 **标题**：描述 格式
      const labelMatch = text.match(/^\*\*([^*]+)\*\*：(.+)/);
      if (labelMatch) {
        return (
          <>
            <span style={styles.label}>{labelMatch[1]}</span>
            <span style={{ marginLeft: '8px' }}>{labelMatch[2]}</span>
          </>
        );
      }
      // 处理普通 **加粗** 格式
      const parts = text.split(/\*\*([^*]+)\*\*/g);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i}>{part}</strong>;
        }
        return part;
      });
    };

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'ul') {
          elements.push(
            <div key={elements.length} style={styles.list}>
              {currentList.map((item, idx) => (
                <div key={idx} style={styles.listItem}>
                  <span style={styles.listBullet}>•</span>
                  <span style={styles.listItemText}>{renderListItemText(item)}</span>
                </div>
              ))}
            </div>
          );
        } else {
          elements.push(
            <ol key={elements.length} style={styles.orderedList}>
              {currentList.map((item, idx) => (
                <li key={idx} style={styles.orderedListItem}>{renderListItemText(item)}</li>
              ))}
            </ol>
          );
        }
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
      } else if (line.trim() === '') {
        // 空行
      } else {
        // 普通段落，使用与列表相同的渲染逻辑
        elements.push(<p key={index} style={styles.paragraph}>{renderListItemText(line)}</p>);
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
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1D1D1F',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#007AFF',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
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
    width: '240px',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid rgba(0, 0, 0, 0.06)',
    overflowY: 'auto',
    padding: '20px 0',
    flexShrink: 0,
  },
  menuCategory: {
    marginBottom: '12px',
  },
  menuCategoryTitle: {
    padding: '10px 24px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#86868B',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 24px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    fontSize: '14px',
    color: '#1D1D1F',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderLeft: '3px solid transparent',
  },
  menuItemActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    color: '#007AFF',
    fontWeight: '500',
    borderLeft: '3px solid #007AFF',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 40px',
  },
  section: {
    marginBottom: '24px',
  },
  article: {
    marginBottom: '32px',
    scrollMarginTop: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '28px 32px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  articleTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #007AFF',
    letterSpacing: '-0.02em',
    display: 'inline-block',
  },
  articleContent: {
    color: '#1D1D1F',
    lineHeight: '1.8',
  },
  h2: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: '28px',
    marginBottom: '16px',
    paddingLeft: '12px',
    borderLeft: '4px solid #007AFF',
  },
  h3: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: '20px',
    marginBottom: '12px',
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: '1.8',
    marginBottom: '12px',
    color: '#3C3C43',
  },
  label: {
    display: 'inline-block',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    color: '#007AFF',
    fontWeight: '500',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  list: {
    margin: '16px 0',
    paddingLeft: '0',
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    fontSize: '14px',
    lineHeight: '1.8',
    marginBottom: '10px',
    color: '#3C3C43',
  },
  listBullet: {
    color: '#007AFF',
    marginRight: '12px',
    fontSize: '18px',
    lineHeight: '1.6',
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
  },
  orderedList: {
    margin: '16px 0',
    paddingLeft: '24px',
    listStyle: 'none',
    counterReset: 'list-counter',
  },
  orderedListItem: {
    fontSize: '14px',
    lineHeight: '1.8',
    marginBottom: '10px',
    color: '#3C3C43',
    paddingLeft: '8px',
    position: 'relative',
    counterIncrement: 'list-counter',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    margin: '20px 0',
    fontSize: '14px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #E5E5EA',
  },
  tableHeaderRow: {
    backgroundColor: '#F2F2F7',
  },
  tableRow: {
    backgroundColor: '#FFFFFF',
    transition: 'background-color 0.15s ease',
  },
  tableHeader: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#86868B',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #E5E5EA',
  },
  tableCell: {
    padding: '14px 16px',
    color: '#1D1D1F',
    borderBottom: '1px solid #F2F2F7',
  },
};

export default HelpPage;
