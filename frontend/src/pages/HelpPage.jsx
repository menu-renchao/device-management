import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const helpModules = [
  {
    id: 'quickstart',
    title: '快速开始',
    subtitle: '先了解系统、角色边界和最常用的入口。',
    summary:
      '帮助中心采用“模块切换 + 模块内目录”的方式组织内容。你可以先按模块找到问题范围，再在当前模块里查看详细步骤。',
    highlights: ['全模块索引', '新手教程', '角色说明', '常见路径'],
    sections: [
      {
        id: 'platform-overview',
        title: '平台概览',
        intro: '帮助你快速理解这套系统能做什么、由谁来用。',
        entry: '登录后通过顶部导航进入各功能页，帮助中心入口位于导航栏右侧。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'paragraph',
            content:
              'Menusifu 设备管理平台主要服务于 POS 设备、移动设备和 Linux 远程运维场景，同时覆盖借用审批、管理员审核、数据库配置和发布包管理。',
          },
          {
            type: 'list',
            title: '当前系统主要模块',
            items: [
              'POS 设备：扫描局域网设备、筛选设备、查看详情、认领、借用、License 与数据库操作。',
              '移动设备：管理手机和平板等资产，支持图片上传、负责人设置、借用与归还。',
              'Linux 配置：远程连接设备后执行 POS 控制、升级、备份、日志和版本查看。',
              '数据库配置：维护 SQL 模板、测试连接、批量执行 SQL、查看执行结果。',
              '工作台：集中查看待我审核、我的申请、我的借用、我的设备、系统通知。',
              '管理中心与个人中心：管理用户、审核注册和维护个人资料。',
            ],
          },
        ],
      },
      {
        id: 'roles-permissions',
        title: '角色与权限',
        intro: '不同角色看到的按钮和可执行操作会不一样。',
        entry: '角色信息可在个人中心查看，管理员可在管理中心维护用户角色。',
        roles: ['所有登录用户', '管理员'],
        blocks: [
          {
            type: 'table',
            title: '角色说明',
            headers: ['角色', '常见权限'],
            rows: [
              ['普通用户', '查看设备、提交借用申请、查看个人申请和通知。'],
              ['负责人', '在自己负责的设备范围内处理借用、查看设备信息、进入相关配置页。'],
              ['管理员', '拥有全局管理权限，可管理用户、直接借用设备、重置认领、执行高风险操作。'],
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '权限提示',
            content:
              '某些页面会根据设备负责人、当前借用人和管理员身份动态开放按钮。如果你能看到设备但无法进入配置页，通常是权限不足而不是数据异常。',
          },
        ],
      },
      {
        id: 'common-paths',
        title: '常用路径',
        intro: '适合第一次使用系统时快速建立操作路线。',
        entry: '以下路径均从顶部导航栏进入。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'steps',
            title: '新用户最常见的三条路径',
            items: [
              '查看设备状态：进入 POS 设备页，先搜索或筛选，再打开详情。',
              '提交借用：在 POS 设备页或移动设备页点击“借用”，填写用途和归还时间，随后去工作台查看审批进展。',
              '跟踪通知：点击顶部通知铃铛或进入工作台“系统通知”，查看审批结果、到期提醒和公告。',
            ],
          },
          {
            type: 'list',
            title: '管理员常见路径',
            items: [
              '处理注册与用户维护：管理中心。',
              '处理认领和借用审批：工作台与管理中心。',
              '运维设备：POS 设备页进入 Linux 配置或数据库配置。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'pos',
    title: 'POS 设备',
    subtitle: '设备扫描、筛选、认领、借用以及运维入口都从这里开始。',
    summary:
      'POS 设备页是使用频率最高的页面之一。这里不仅能看到扫描结果，还能执行认领、借用、License 备份导入、数据库备份恢复等扩展操作。',
    highlights: ['扫描与刷新', '筛选分页', '认领借用', 'License 与数据库'],
    sections: [
      {
        id: 'pos-overview',
        title: '页面总览',
        intro: '先熟悉工具栏、筛选项和表格动作列。',
        entry: '顶部导航“POS 设备”。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'list',
            title: '页面包含的核心区域',
            items: [
              '扫描工具栏：选择网段、开始扫描、停止扫描。',
              '搜索与筛选：按关键词、设备类型、设备分类筛选，并可仅查看“我的设备”。',
              '设备表格：展示 IP、商户 ID、版本、负责人、借用状态等信息。',
              '操作入口：详情、认领、借用、删除、License 备份导入、数据库备份恢复等。',
            ],
          },
          {
            type: 'note',
            tone: 'info',
            title: '“只显示我的设备”是什么意思',
            content:
              '该开关会筛出你负责的设备或你当前借用中的设备，适合负责人或借用人快速聚焦自己的设备范围。',
          },
        ],
      },
      {
        id: 'pos-scan-filter',
        title: '扫描、搜索与筛选',
        intro: '适合排查设备是否在线、快速定位商户或缩小表格结果范围。',
        entry: 'POS 设备页顶部工具栏。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'steps',
            title: '扫描设备',
            items: [
              '在 IP 下拉框中选择要扫描的网段。',
              '点击“开始扫描”，观察进度条和当前扫描 IP。',
              '如需提前结束，点击“停止扫描”。',
              '扫描完成后，表格会自动刷新为最新设备列表。',
            ],
          },
          {
            type: 'list',
            title: '筛选能力',
            items: [
              '关键词搜索：支持按 IP、商户 ID、名称、版本等查询。',
              '设备类型筛选：按设备类型缩小结果。',
              '设备分类筛选：适合按业务分类或用途查看设备。',
              '分页：可切换每页条数，并浏览多页结果。',
            ],
          },
        ],
      },
      {
        id: 'pos-claim-borrow',
        title: '认领与借用',
        intro: '这里区分“认领设备”和“临时借用设备”两种动作。',
        entry: '设备表格操作列。',
        roles: ['普通用户', '负责人', '管理员'],
        blocks: [
          {
            type: 'steps',
            title: '认领设备',
            items: [
              '找到尚未认领的设备。',
              '点击“认领”并提交说明。',
              '等待管理员审核。',
              '审核通过后，你会成为该设备负责人。',
            ],
          },
          {
            type: 'steps',
            title: '借用设备',
            items: [
              '点击“借用”打开申请窗口。',
              '填写用途和预计归还时间。',
              '提交后去工作台查看审批状态。',
              '借用结束后，通过工作台或对应按钮归还设备。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '无权限提示',
            content:
              '能看到设备不代表一定能进入配置页。只有管理员、设备负责人或当前借用人，才能从详情继续进入 Linux 配置或数据库配置。',
          },
        ],
      },
      {
        id: 'pos-maintenance',
        title: 'License 与数据库操作',
        intro: '这些是后续新增能力，主要面向管理员或具备维护权限的用户。',
        entry: 'POS 设备表格操作列中的扩展动作。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'list',
            title: '可执行的维护动作',
            items: [
              'License 备份：将设备当前 License SQL 导出到本地。',
              'License 导入：选择 `.sql` 文件导入设备，失败时会自动回滚。',
              '数据库备份恢复：打开专门弹窗执行数据库备份、上传恢复或下载。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '导入前先确认文件来源',
            content:
              'License 导入和数据库恢复都属于高风险操作。建议先做好备份，并确认目标设备商户 ID 与文件来源一致。',
          },
        ],
      },
    ],
  },
  {
    id: 'mobile',
    title: '移动设备',
    subtitle: '管理手机、平板等测试设备，覆盖录入、借用、负责人设置和图片维护。',
    summary:
      '移动设备页既服务于资产录入，也服务于日常借用。管理员维护数据，普通用户主要发起借用。',
    highlights: ['卡片/列表视图', '图片上传', '负责人设置', '借用归还'],
    sections: [
      {
        id: 'mobile-overview',
        title: '页面总览',
        intro: '进入页面后先熟悉视图模式和搜索区。',
        entry: '顶部导航“移动设备”。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'list',
            title: '页面核心能力',
            items: [
              '搜索设备名称、SN、类型、系统版本。',
              '在卡片视图和列表视图之间切换。',
              '查看设备当前负责人、借用人和归还时间。',
              '管理员可新增、编辑、删除设备和设置负责人。',
            ],
          },
        ],
      },
      {
        id: 'mobile-records',
        title: '设备录入与图片管理',
        intro: '管理员在这里维护移动设备台账。',
        entry: '右上角“添加设备”或设备卡片上的编辑按钮。',
        roles: ['管理员'],
        blocks: [
          {
            type: 'steps',
            title: '新增或编辑设备',
            items: [
              '点击“添加设备”或“编辑”。',
              '填写名称、类型、SN、系统版本。',
              '按需要上传 A 面和 B 面图片。',
              '保存后刷新列表查看结果。',
            ],
          },
          {
            type: 'note',
            tone: 'info',
            title: '图片说明',
            content:
              'A 面和 B 面图片主要用于快速识别设备外观。点击缩略图可进入大图预览。',
          },
        ],
      },
      {
        id: 'mobile-owner-borrow',
        title: '负责人设置与借用归还',
        intro: '区分“谁负责设备”和“谁暂时使用设备”。',
        entry: '设备卡片或列表的操作按钮。',
        roles: ['普通用户', '负责人', '管理员'],
        blocks: [
          {
            type: 'steps',
            title: '设置负责人',
            items: [
              '管理员点击负责人按钮。',
              '在弹窗中选择用户或取消指定。',
              '保存后设备负责人信息会立即更新。',
            ],
          },
          {
            type: 'steps',
            title: '借用与归还',
            items: [
              '普通用户点击“借用”，填写用途和归还时间并提交申请。',
              '管理员可以直接执行借用，不需要走审批流。',
              '设备借出后会显示当前借用人和归还时间。',
              '管理员、负责人或当前借用人可执行归还操作。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'linux',
    title: 'Linux 配置',
    subtitle: '面向远程运维的功能区，包含连接、控制、升级、备份与日志。',
    summary:
      'Linux 配置页基于商户设备进入，适合做服务控制、版本升级和现场排障。只有具备权限的用户才可以访问。',
    highlights: ['SSH 连接', 'POS 控制', '升级部署', '备份日志'],
    sections: [
      {
        id: 'linux-connect',
        title: '连接设备',
        intro: '先建立 SSH 连接，后续功能标签才会开放。',
        entry: '从 POS 设备详情进入 Linux 配置页。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'steps',
            title: '建立连接',
            items: [
              '确认页面中商户 ID 和主机地址是否正确。',
              '填写端口、用户名、密码等 SSH 参数。',
              '先点击“测试连接”，确认网络与凭证可用。',
              '点击“连接”后，页面会展示连接状态和 POS 状态。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '权限与来源',
            content:
              '建议从设备列表的详情入口进入此页，这样会自动带入设备信息并执行权限校验。',
          },
        ],
      },
      {
        id: 'linux-tabs',
        title: '标签功能说明',
        intro: '连接成功后，顶部标签会切换为可操作状态。',
        entry: 'Linux 配置页面中部标签栏。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'table',
            title: '标签页用途',
            headers: ['标签', '作用'],
            rows: [
              ['POS 控制', '启动、停止、重启 POS 服务，并查看服务状态。'],
              ['升级部署', '执行版本升级或发布相关操作。'],
              ['备份恢复', '创建备份、恢复备份、下载备份文件。'],
              ['日志管理', '查看实时日志并按关键字定位问题。'],
              ['版本信息', '查看当前版本、更新时间等运行信息。'],
            ],
          },
        ],
      },
      {
        id: 'linux-notes',
        title: '操作注意事项',
        intro: '这些动作通常直接影响线上设备状态。',
        entry: '所有 Linux 配置标签页。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'list',
            title: '建议遵循的原则',
            items: [
              '修改配置前先确认业务低峰期。',
              '升级和恢复前先做好备份。',
              '执行重启类操作后关注 POS 状态是否恢复。',
              '查看日志时优先结合时间范围和关键字定位问题。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'database',
    title: '数据库配置',
    subtitle: '在目标设备上测试数据库连接、维护 SQL 模板并执行批量 SQL。',
    summary:
      '数据库配置页是后来新增的重要运维页面，支持模板化 SQL 管理、风险提示、执行结果查看以及一键重启 POS。',
    highlights: ['连接测试', 'SQL 模板', '批量执行', '风险提示'],
    sections: [
      {
        id: 'db-connection',
        title: '连接信息与测试',
        intro: '先确认数据库连接参数，再进行模板执行。',
        entry: '从 POS 设备详情进入“数据库配置”。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'steps',
            title: '连接测试',
            items: [
              '系统会优先带入设备 IP、默认端口和默认库信息。',
              '检查数据库名和密码是否符合当前设备配置。',
              '点击“测试连接”，确认数据库可访问。',
              '测试通过后再进行 SQL 模板执行。',
            ],
          },
          {
            type: 'note',
            tone: 'info',
            title: '重启 POS',
            content:
              '如果某些 SQL 或配置变更需要重启服务生效，可以直接使用页面里的“重启 POS”按钮。',
          },
        ],
      },
      {
        id: 'db-templates',
        title: 'SQL 模板管理',
        intro: '模板用于复用常见 SQL，不需要每次手工粘贴。',
        entry: '数据库配置页模板列表区域。',
        roles: ['管理员', '模板创建者'],
        blocks: [
          {
            type: 'list',
            title: '模板列表支持的动作',
            items: [
              '按名称或备注搜索模板。',
              '勾选多个模板后批量执行。',
              '展开查看 SQL 详情。',
              '新增模板、编辑模板、删除模板。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '编辑权限',
            content:
              '通常只有管理员或模板创建者可以编辑和删除对应模板，其它用户只能查看或执行。',
          },
        ],
      },
      {
        id: 'db-execution',
        title: '执行 SQL 与查看结果',
        intro: '执行前确认模板选择和目标设备，执行后查看成功失败明细。',
        entry: '模板列表上方批量执行按钮，或单行“执行”按钮。',
        roles: ['管理员', '负责人', '当前借用人'],
        blocks: [
          {
            type: 'steps',
            title: '执行流程',
            items: [
              '选择一个或多个模板。',
              '确认提示信息后开始执行。',
              '系统会逐条执行模板，并在结果面板中展示成功数与失败数。',
              '执行结束后，如有需要，再重启 POS。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '风险 SQL 提示',
            content:
              '当系统检测到高风险 SQL 时，会阻止普通执行。管理员可以在确认风险后选择强制执行，但应记录原因并确保已备份。',
          },
        ],
      },
    ],
  },
  {
    id: 'war',
    title: 'WAR 包管理',
    subtitle: '集中管理发布包文件和相关元数据。',
    summary:
      'WAR 包管理页用于上传、下载和维护发布包信息，适合版本管理和部署准备场景。',
    highlights: ['上传下载', '元数据维护', '版本准备'],
    sections: [
      {
        id: 'war-overview',
        title: '页面用途',
        intro: '这里不是设备实时状态页，而是发布资源管理页。',
        entry: '顶部导航“WAR 包管理”。',
        roles: ['所有登录用户', '管理员更常用'],
        blocks: [
          {
            type: 'paragraph',
            content:
              '你可以在这里查看系统已有的 WAR 包资源，并执行上传、下载或维护相关元数据，为后续升级部署做准备。',
          },
        ],
      },
      {
        id: 'war-actions',
        title: '常见操作',
        intro: '常见于发布前准备和版本核对。',
        entry: 'WAR 包管理主页面。',
        roles: ['管理员', '有维护权限的用户'],
        blocks: [
          {
            type: 'list',
            title: '支持的动作',
            items: [
              '上传 WAR 包文件。',
              '下载已有 WAR 包。',
              '维护包的元数据或备注信息。',
              '为 Linux 升级部署提供版本来源。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'workspace',
    title: '工作台',
    subtitle: '把审批、申请、借用、我的设备和通知集中在一个入口中。',
    summary:
      '工作台适合日常协作，是审批流和个人任务的汇总页。审批人、申请人和借用人都需要频繁使用。',
    highlights: ['待我审核', '我的申请', '我的借用', '通知中心'],
    sections: [
      {
        id: 'workspace-tabs',
        title: '标签页说明',
        intro: '工作台顶部会根据当前标签展示不同的内容。',
        entry: '顶部导航“工作台”。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'table',
            title: '标签说明',
            headers: ['标签', '用途'],
            rows: [
              ['待我审核', '负责人或管理员处理借用审批等待办。'],
              ['我的申请', '查看我提交过的借用或认领申请。'],
              ['我的借用', '查看当前借用中的设备并执行归还。'],
              ['我的设备', '查看自己负责或关联的设备。'],
              ['系统通知', '查看审批结果、提醒和系统公告。'],
            ],
          },
        ],
      },
      {
        id: 'workspace-approval',
        title: '审批与申请跟踪',
        intro: '适合负责人和申请人分别处理自己的任务。',
        entry: '工作台中的“待我审核”和“我的申请”。',
        roles: ['普通用户', '负责人', '管理员'],
        blocks: [
          {
            type: 'steps',
            title: '审批人怎么处理申请',
            items: [
              '进入“待我审核”。',
              '查看申请人的用途、归还时间和设备信息。',
              '执行通过或拒绝操作。',
              '申请人会收到系统通知。',
            ],
          },
          {
            type: 'steps',
            title: '申请人怎么跟踪状态',
            items: [
              '进入“我的申请”。',
              '查看状态是待审核、已通过、已拒绝还是已取消。',
              '必要时取消尚未审批的申请。',
            ],
          },
        ],
      },
      {
        id: 'workspace-notifications',
        title: '通知查看',
        intro: '系统通知与顶部铃铛的数据是联动的。',
        entry: '顶部通知铃铛或工作台“系统通知”。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'list',
            title: '常见通知类型',
            items: [
              '审批结果通知。',
              '借用即将到期提醒。',
              '系统公告或维护通知。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'admin',
    title: '管理中心',
    subtitle: '管理员在这里处理用户创建、审核、编辑和删除。',
    summary:
      '管理中心主要是用户管理台。管理员可以筛选注册状态、维护账号信息，并审核新用户。',
    highlights: ['用户筛选', '新增编辑', '审核注册', '删除用户'],
    sections: [
      {
        id: 'admin-overview',
        title: '页面总览',
        intro: '先熟悉筛选器、搜索框和表格操作区。',
        entry: '顶部导航“管理中心”。',
        roles: ['管理员'],
        blocks: [
          {
            type: 'list',
            title: '页面能做什么',
            items: [
              '按状态筛选用户，例如待审核、已通过、已拒绝。',
              '搜索用户名、姓名或邮箱。',
              '新增用户并直接指定角色和状态。',
              '编辑用户信息、修改角色、重置密码、删除账号。',
            ],
          },
        ],
      },
      {
        id: 'admin-user-actions',
        title: '新增、编辑与审核',
        intro: '适合管理员处理账号全生命周期。',
        entry: '页面右上角“添加用户”和每行操作按钮。',
        roles: ['管理员'],
        blocks: [
          {
            type: 'steps',
            title: '新增用户',
            items: [
              '点击“添加用户”。',
              '填写用户名、姓名、邮箱、密码、角色和状态。',
              '保存后刷新列表确认账号已创建。',
            ],
          },
          {
            type: 'steps',
            title: '审核注册用户',
            items: [
              '将状态筛选为“待审核”。',
              '对目标用户点击“通过”或“拒绝”。',
              '结果会立即反映到用户状态。',
            ],
          },
          {
            type: 'steps',
            title: '编辑与删除',
            items: [
              '点击“编辑”可更新姓名、邮箱、角色、状态。',
              '如输入新密码，可同步完成密码重置。',
              '点击“删除”前请确认该账号确实不再使用。',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'profile',
    title: '个人中心',
    subtitle: '维护当前账号的基本资料和密码。',
    summary:
      '个人中心是每位用户都能访问的设置页，主要用于更新姓名、邮箱和登录密码。',
    highlights: ['资料维护', '密码修改'],
    sections: [
      {
        id: 'profile-info',
        title: '基本信息维护',
        intro: '适合在姓名或邮箱发生变化时更新账号资料。',
        entry: '点击导航栏右上角头像进入个人中心。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'steps',
            title: '更新资料',
            items: [
              '进入个人中心后查看当前用户名和角色。',
              '修改姓名和邮箱。',
              '点击“保存”，等待成功提示。',
            ],
          },
        ],
      },
      {
        id: 'profile-password',
        title: '修改密码',
        intro: '建议定期更新密码，尤其是在共享环境中。',
        entry: '个人中心下方“修改密码”卡片。',
        roles: ['所有登录用户'],
        blocks: [
          {
            type: 'steps',
            title: '修改密码',
            items: [
              '输入当前密码。',
              '输入不少于 6 位的新密码。',
              '再次确认新密码。',
              '提交后重新使用新密码登录。',
            ],
          },
          {
            type: 'note',
            tone: 'warning',
            title: '常见失败原因',
            content: '当前密码错误、新密码长度不足，或两次输入不一致都会导致修改失败。',
          },
        ],
      },
    ],
  },
];

const toneStyles = {
  info: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderColor: 'rgba(0, 122, 255, 0.18)',
    titleColor: '#0A84FF',
  },
  warning: {
    backgroundColor: 'rgba(255, 149, 0, 0.10)',
    borderColor: 'rgba(255, 149, 0, 0.18)',
    titleColor: '#CC7A00',
  },
};

const HelpPage = () => {
  const [activeCategory, setActiveCategory] = useState(helpModules[0].id);
  const [activeSection, setActiveSection] = useState(helpModules[0].sections[0].id);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const contentRef = useRef(null);
  const sectionRefs = useRef({});

  const activeModule = useMemo(
    () => helpModules.find((module) => module.id === activeCategory) || helpModules[0],
    [activeCategory]
  );

  const isCompact = viewportWidth < 960;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const firstSectionId = activeModule.sections[0]?.id;
    if (!firstSectionId) return;
    setActiveSection(firstSectionId);
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeModule]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return undefined;

    const handleScroll = () => {
      const sections = activeModule.sections
        .map((section) => {
          const node = sectionRefs.current[section.id];
          if (!node) return null;
          return {
            id: section.id,
            distance: Math.abs(node.offsetTop - container.scrollTop - 24),
          };
        })
        .filter(Boolean);

      if (sections.length === 0) return;
      sections.sort((a, b) => a.distance - b.distance);
      if (sections[0].id !== activeSection) {
        setActiveSection(sections[0].id);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeModule, activeSection]);

  const scrollToSection = (sectionId) => {
    const node = sectionRefs.current[sectionId];
    if (!node) return;

    setActiveSection(sectionId);
    node.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  };

  const renderBlock = (block, index) => {
    if (block.type === 'paragraph') {
      return (
        <p key={index} style={styles.paragraph}>
          {block.content}
        </p>
      );
    }

    if (block.type === 'list') {
      return (
        <div key={index} style={styles.blockWrap}>
          {block.title ? <h4 style={styles.blockTitle}>{block.title}</h4> : null}
          <ul style={styles.list}>
            {block.items.map((item) => (
              <li key={item} style={styles.listItem}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (block.type === 'steps') {
      return (
        <div key={index} style={styles.blockWrap}>
          {block.title ? <h4 style={styles.blockTitle}>{block.title}</h4> : null}
          <ol style={styles.steps}>
            {block.items.map((item) => (
              <li key={item} style={styles.stepItem}>
                {item}
              </li>
            ))}
          </ol>
        </div>
      );
    }

    if (block.type === 'table') {
      return (
        <div key={index} style={styles.blockWrap}>
          {block.title ? <h4 style={styles.blockTitle}>{block.title}</h4> : null}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {block.headers.map((header) => (
                    <th key={header} style={styles.tableHeader}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${rowIndex}-${row[0]}`} style={styles.tableRow}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} style={styles.tableCell}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (block.type === 'note') {
      const tone = toneStyles[block.tone] || toneStyles.info;
      return (
        <div
          key={index}
          style={{
            ...styles.note,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
          }}
        >
          <div style={{ ...styles.noteTitle, color: tone.titleColor }}>{block.title}</div>
          <div style={styles.noteContent}>{block.content}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Help Center</div>
          <h1 style={styles.title}>帮助中心</h1>
          <p style={styles.headerText}>按模块查功能，按目录找步骤，适合新手快速上手，也适合老用户快速检索。</p>
        </div>
        <Link to="/" style={styles.backLink}>
          返回首页
        </Link>
      </div>

      <div style={styles.tabsBar}>
        {helpModules.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => setActiveCategory(module.id)}
            style={{
              ...styles.tabButton,
              ...(activeCategory === module.id ? styles.tabButtonActive : {}),
            }}
          >
            <span style={styles.tabTitle}>{module.title}</span>
            <span style={styles.tabSubtitle}>{module.subtitle}</span>
          </button>
        ))}
      </div>

      <div style={styles.heroCard}>
        <div style={styles.heroMain}>
          <div style={styles.heroLabel}>当前模块</div>
          <h2 style={styles.heroTitle}>{activeModule.title}</h2>
          <p style={styles.heroSummary}>{activeModule.summary}</p>
          <div style={styles.metaGrid}>
            <div style={styles.metaCard}>
              <div style={styles.metaTitle}>适合场景</div>
              <div style={styles.metaText}>{activeModule.subtitle}</div>
            </div>
            <div style={styles.metaCard}>
              <div style={styles.metaTitle}>目录数量</div>
              <div style={styles.metaText}>{activeModule.sections.length} 个主题</div>
            </div>
          </div>
        </div>
        <div style={styles.highlightWrap}>
          {activeModule.highlights.map((item) => (
            <span key={item} style={styles.highlightChip}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...styles.contentLayout, ...(isCompact ? styles.contentLayoutCompact : {}) }}>
        <aside style={{ ...styles.sidebar, ...(isCompact ? styles.sidebarCompact : {}) }}>
          <div style={styles.sidebarTitle}>本模块目录</div>
          <div style={{ ...styles.sectionNav, ...(isCompact ? styles.sectionNavCompact : {}) }}>
            {activeModule.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                style={{
                  ...styles.sectionButton,
                  ...(activeSection === section.id ? styles.sectionButtonActive : {}),
                }}
              >
                {section.title}
              </button>
            ))}
          </div>
        </aside>

        <div style={styles.mainPanel} ref={contentRef}>
          {activeModule.sections.map((section) => (
            <section
              key={section.id}
              ref={(node) => {
                sectionRefs.current[section.id] = node;
              }}
              style={styles.sectionCard}
            >
              <div style={styles.sectionTop}>
                <div style={styles.sectionEyebrow}>教程与索引</div>
                <h3 style={styles.sectionTitle}>{section.title}</h3>
                <p style={styles.sectionIntro}>{section.intro}</p>
              </div>

              <div style={styles.infoGrid}>
                <div style={styles.infoBox}>
                  <div style={styles.infoLabel}>入口位置</div>
                  <div style={styles.infoValue}>{section.entry}</div>
                </div>
                <div style={styles.infoBox}>
                  <div style={styles.infoLabel}>适用角色</div>
                  <div style={styles.infoValue}>{section.roles.join('、')}</div>
                </div>
              </div>

              <div style={styles.sectionBody}>
                {section.blocks.map((block, index) => renderBlock(block, index))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: 'calc(100vh - 52px)',
    backgroundColor: '#F5F5F7',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    alignItems: 'flex-start',
    padding: '0',
    color: '#1D1D1F',
    flexWrap: 'wrap',
  },
  kicker: {
    display: 'none',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    lineHeight: 1.2,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  headerText: {
    margin: 0,
    maxWidth: '760px',
    lineHeight: 1.65,
    color: '#6E6E73',
    fontSize: '14px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '10px',
    textDecoration: 'none',
    color: '#007AFF',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D2D2D7',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  tabsBar: {
    display: 'flex',
    gap: '4px',
    overflowX: 'auto',
    padding: '4px',
    backgroundColor: '#F2F2F7',
    borderRadius: '10px',
    width: 'fit-content',
    maxWidth: '100%',
  },
  tabButton: {
    minWidth: '180px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    padding: '12px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  tabTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1D1D1F',
  },
  tabSubtitle: {
    fontSize: '12px',
    lineHeight: 1.55,
    color: '#86868B',
  },
  heroCard: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    padding: '24px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    flexWrap: 'wrap',
  },
  heroMain: {
    flex: '1 1 520px',
  },
  heroLabel: {
    fontSize: '12px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#86868B',
    fontWeight: '600',
    marginBottom: '8px',
  },
  heroTitle: {
    margin: '0 0 10px 0',
    fontSize: '22px',
    color: '#1D1D1F',
  },
  heroSummary: {
    margin: '0 0 18px 0',
    lineHeight: 1.75,
    fontSize: '14px',
    color: '#424245',
    maxWidth: '760px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  metaCard: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: '#F9F9FB',
    border: '1px solid #E5E5EA',
  },
  metaTitle: {
    fontSize: '12px',
    color: '#86868B',
    marginBottom: '6px',
    fontWeight: '600',
  },
  metaText: {
    fontSize: '14px',
    color: '#1D1D1F',
    lineHeight: 1.6,
  },
  highlightWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '10px',
    flexWrap: 'wrap',
    flex: '0 1 320px',
    paddingTop: '8px',
  },
  highlightChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#F2F2F7',
    color: '#007AFF',
    fontSize: '13px',
    fontWeight: '600',
  },
  contentLayout: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: '20px',
    minHeight: '0',
    flex: 1,
  },
  contentLayoutCompact: {
    gridTemplateColumns: '1fr',
  },
  sidebar: {
    position: 'sticky',
    top: '72px',
    alignSelf: 'start',
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
  },
  sidebarCompact: {
    position: 'static',
  },
  sidebarTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#424245',
    marginBottom: '14px',
  },
  sectionNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionNavCompact: {
    flexDirection: 'row',
    overflowX: 'auto',
    paddingBottom: '2px',
  },
  sectionButton: {
    border: '1px solid #E5E5EA',
    backgroundColor: '#FFFFFF',
    color: '#424245',
    borderRadius: '10px',
    padding: '12px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1.45,
    minWidth: '140px',
  },
  sectionButtonActive: {
    backgroundColor: '#F0F7FF',
    border: '1px solid #BBD9FF',
    color: '#007AFF',
    fontWeight: '600',
  },
  mainPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minHeight: '0',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5EA',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
    scrollMarginTop: '20px',
  },
  sectionTop: {
    marginBottom: '18px',
  },
  sectionEyebrow: {
    fontSize: '12px',
    color: '#86868B',
    fontWeight: '600',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '22px',
    color: '#1D1D1F',
  },
  sectionIntro: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#6E6E73',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '18px',
  },
  infoBox: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: '#F9F9FB',
    border: '1px solid #E5E5EA',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#86868B',
    marginBottom: '6px',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: '14px',
    color: '#1D1D1F',
    lineHeight: 1.6,
  },
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  blockWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  blockTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#1D1D1F',
  },
  paragraph: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.8,
    color: '#424245',
  },
  list: {
    margin: 0,
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listItem: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#424245',
  },
  steps: {
    margin: 0,
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stepItem: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#424245',
    paddingLeft: '4px',
  },
  note: {
    border: '1px solid',
    borderRadius: '10px',
    padding: '16px 18px',
  },
  noteTitle: {
    fontSize: '14px',
    fontWeight: '700',
    marginBottom: '6px',
  },
  noteContent: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#424245',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #E5E5EA',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '520px',
  },
  tableHeader: {
    backgroundColor: '#F9F9FB',
    color: '#6E6E73',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'left',
    padding: '12px 14px',
    borderBottom: '1px solid #E5E5EA',
  },
  tableRow: {
    borderBottom: '1px solid #E5E5EA',
  },
  tableCell: {
    padding: '12px 14px',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#424245',
    verticalAlign: 'top',
  },
};

export default HelpPage;
