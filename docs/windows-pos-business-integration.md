# Windows POS 模块业务文档

## 1. 文档目的

本文档基于 `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\windows_pos` 目录下源码，以及其直接依赖模块的实际实现，梳理 Windows POS 桌面工具的业务目标、核心流程、数据对象、约束规则，并给出迁移到当前 `device_management` Web 项目的集成建议。

这份文档的目标不是解释 PyQt 代码细节，而是回答下面几个问题：

1. 这个 Windows POS 模块到底在帮一线人员做什么。
2. 每个功能按钮对应的真实业务动作是什么。
3. 哪些规则必须在 Web 版中保持一致。
4. 迁移到现有 Web 项目时，哪些能力可以复用，哪些必须新增。

## 2. 源码范围

本次分析的主要依据如下：

- `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\windows_pos\windows_window.py`
- `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\windows_pos\windows_service.py`
- `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\backend.py`
- `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\work_threads.py`
- `D:\menusifu\PythonProject\rc\pos_tool_new\pos_tool_new\download_war\download_war_service.py`

为了评估迁移可行性，也参考了当前 Web 项目的已有能力：

- `D:\menusifu\device_management\frontend\src\services\api.js`
- `D:\menusifu\device_management\frontend\src\components\linux\DownloadConfigModal.jsx`
- `D:\menusifu\device_management\backend-go\internal\handlers\war_download.go`
- `D:\menusifu\device_management\backend-go\internal\services\war_download_service.go`

## 3. 模块定位

Windows POS 模块本质上不是“收银业务功能”，而是一个面向实施、运维、测试人员的 **Windows 本机运维工具**。它服务的对象是已经安装在 Windows 机器上的 POS 发布目录，核心目标是让操作者在不手工进入多个目录、不手工改配置、不手工解压 WAR 的情况下，完成下面几类动作：

1. 扫描本机多个 POS 版本目录，找出哪些版本的配置与目标环境不一致。
2. 批量把指定目录下的 POS 配置切换到 QA、PROD、DEV 环境。
3. 下载或选择一个新的 `kpos.war` 包。
4. 将某个指定版本目录中的 `kpos.war` 和解压目录替换成新版本。
5. 结束并重新启动本机 POS 进程。

因此，它的业务场景是：

- 桌面 POS 本地环境切换。
- Windows 本机升级包替换。
- 本机 POS 重启。
- 运维执行过程中的风险收敛和日志反馈。

## 4. 用户角色与典型场景

### 4.1 角色

- 实施工程师：为门店机器切换 QA/PROD/DEV 配置，验证版本。
- 测试工程师：频繁替换 WAR，切换测试环境。
- 运维人员：在本机快速恢复、升级、重启 POS。

### 4.2 典型场景

#### 场景 A：切换本机 POS 到 QA 环境

1. 选择基础目录，默认是 `C:\Wisdomount\Menusifu\application`。
2. 选择环境 `QA`。
3. 先点击“扫描目录”查看哪些版本需要修改。
4. 点击“修改文件”批量替换配置。
5. 如果需要，再重启对应版本的 POS。

#### 场景 B：替换某个版本的 `kpos.war`

1. 本地选择一个 `kpos.war`，或者从网络下载一个。
2. 读取基础目录下的所有版本子目录。
3. 选择要替换的版本。
4. 工具先停止 POS，再删除旧 WAR 和旧解压目录，再复制新 WAR，最后重新解压。
5. 操作者按需再执行“修改文件”或“重启 POS”。

#### 场景 C：从构建平台下载 WAR

1. 输入构建平台 URL。
2. 程序把构建 URL 转成 `downloadAll/.../artifacts.zip` 下载链接。
3. 使用本地保存的 `COOKIE` 和 `TCSESSIONID` 发起两段式下载。
4. 下载完成后解压 ZIP，自动寻找 `kpos.war`，填回 UI 输入框。

## 5. 核心业务对象

### 5.1 基础目录 `base_path`

这是整个模块最核心的输入。业务上它代表一台 Windows 机器上 Menusifu POS 的安装根目录。

默认值为：

`C:\Wisdomount\Menusifu\application`

代码中将该目录下的每一个子目录都视为一个“可操作版本目录”。

### 5.2 版本目录 `selected_version`

`base_path` 下的一级子目录即一个版本实例。业务上它代表一份可独立启动、可独立替换 WAR、可独立改配置的 POS 部署副本。

版本目录下的关键结构是：

```text
{version}/
  tomcat/webapps/kpos/
  tomcat/webapps/kpos.war
  tomcat/webapps/cloudDatahub/WEB-INF/classes/application.properties
  Menusifu Server Manager/Menusifu POS.exe
```

### 5.3 环境 `env`

支持三个环境值：

- `QA`
- `PROD`
- `DEV`

环境不仅影响域名替换，还影响 `application.environmentType` 的目标值。

### 5.4 WAR 包

Windows 模块只认 `kpos.war`。无论来源是：

- 用户手动选择的本地 WAR 文件。
- 从构建平台下载后解压得到的 WAR。

最终都会落到同一个业务动作：替换目标版本目录中的 `tomcat\webapps\kpos.war` 并重新解压成 `tomcat\webapps\kpos`。

## 6. 功能分解

## 6.1 环境选择

界面默认选中 `QA`。环境选择影响两个业务面：

1. 配置文件里的 Menusifu Cloud 域名后缀。
2. `cloudDatahub` 的 `application.environmentType` 值。

## 6.2 基础目录选择

用户可浏览选择基础目录。所有扫描、修改、替换、启动、重启动作都基于这个目录展开。

业务含义是：“告诉系统本机所有 POS 版本都放在哪个根目录下”。

## 6.3 WAR 包来源选择

支持两种来源：

1. 手工选择本地 WAR。
2. 输入 URL，从网络下载。

网络下载完成后会自动解压 ZIP，并在临时目录中递归寻找名为 `kpos.war` 的文件；找到后自动回填到输入框中。

## 6.4 四个主按钮

桌面端暴露的主操作是：

1. 扫描目录
2. 修改文件
3. 替换本地 WAR 包
4. 重启 POS

这四个按钮对应四类相互独立但常串联使用的运维动作。

## 7. 详细业务流程

### 7.1 扫描目录

业务目标：在不落地修改的前提下，先找出当前机器上哪些版本目录“不符合目标环境”。

执行逻辑：

1. 校验 `base_path` 是否存在。
2. 枚举 `base_path` 下所有子目录。
3. 对每个版本目录，检查四个目标 JSON 配置文件。
4. 对每个文件读取内容，并尝试执行环境域名替换。
5. 如果替换前后内容不同，说明该文件需要修改，加入待修改列表。
6. 再检查 `cloudDatahub` 的 `application.properties`。
7. 如果 `application.environmentType` 不等于目标环境映射值，也加入待修改列表。
8. 最终仅输出“哪些文件需要改”，不实际写盘。

这一步的业务价值很高，因为它把“修改前确认”做成了显式动作，降低了误改风险。

### 7.2 修改文件

业务目标：把基础目录下所有版本实例的配置统一切换到指定环境。

执行逻辑：

1. 校验 `base_path`。
2. 遍历所有版本目录。
3. 逐个处理预定义的四个 JSON 文件。
4. 调用统一的域名替换规则替换 URL。
5. 如果内容变更，则以临时文件写入，再原子替换原文件。
6. 再处理 `application.properties`：
   - 如果已有 `application.environmentType` 且值不对，则替换。
   - 如果不存在该配置，则追加一行。
   - 如果已经正确，则跳过。
7. 修改结束后统计：
   - 实际修改文件数
   - 原本就已符合目标环境的文件数
8. 最后额外执行一次 `expiration-management` 地址修正。

这说明“修改文件”不仅仅是简单字符串替换，而是一个带统计、带补丁规则、带写入安全性的批处理流程。

### 7.3 下载 WAR

业务目标：从构建平台拿到可用于替换的 `kpos.war`。

执行逻辑：

1. 用户输入下载 URL。
2. 如果 URL 是 TeamCity 风格的 `buildConfiguration` 或 `repository/download/.../kpos.war`，先转换成 `downloadAll/.../artifacts.zip` 形式。
3. 从本地配置中读取 `COOKIE` 和 `TCSESSIONID`。
4. 第一段请求带浏览器风格 Header，拿 302 重定向地址。
5. 第二段请求使用 `TCSESSIONID` 访问重定向地址，真正下载文件流。
6. 下载过程中按 0.5 秒节奏汇报：
   - 百分比
   - 速度
   - 已下载字节数
   - 总字节数
7. 下载完成后：
   - 如果得到 ZIP，先解压。
   - 在临时目录中递归查找 `kpos.war`。
   - 找到后自动回填到表单。

业务上的关键点：

- 它不是通用文件下载器，而是带 TeamCity URL 适配的专用下载器。
- 它依赖本地保存的 Cookie 类凭证。
- 它把“下载”和“替换”拆成了两个步骤，符合人工确认习惯。

### 7.4 替换本地 WAR 包

业务目标：用新的 `kpos.war` 覆盖指定版本目录中的旧部署内容。

执行逻辑：

1. 校验 WAR 文件路径存在。
2. 校验基础目录存在。
3. 列出版本目录。
4. 让用户选择一个目标版本。
5. 线程启动后先停止 POS 进程。
6. 删除旧的 `tomcat\webapps\kpos.war`。
7. 删除旧的 `tomcat\webapps\kpos` 解压目录。
8. 把新 WAR 复制到 `tomcat\webapps\kpos.war`。
9. 把 WAR 解压到 `tomcat\webapps\kpos`。
10. 提示用户：
    - 如果还需要切环境，就先执行“修改文件”。
    - 否则可以直接重启 POS。

业务上，这一步代表标准的“Windows 本地替换部署包”。

### 7.5 重启 POS

业务目标：让指定版本目录对应的 POS 客户端重新启动。

执行逻辑：

1. 先枚举版本目录。
2. 如果只有一个版本，默认就是它。
3. 如果有多个版本，要求用户选择。
4. 线程中先执行 `taskkill /IM "Menusifu POS.exe" /T /F`。
5. 再通过 `os.startfile` 启动：

`{selected_version}\Menusifu Server Manager\Menusifu POS.exe`

这说明桌面模块假设：

- 可执行文件路径是固定约定。
- 进程名固定为 `Menusifu POS.exe`。
- 所有版本实例共用同一个进程名，因此停止动作是全局性的，启动动作才是定向的。

## 8. 关键业务规则

### 8.1 环境映射规则

| 环境 | 域名后缀 | application.environmentType |
| --- | --- | --- |
| QA | `menusifucloudqa.com` | `integration` |
| PROD | `menusifucloud.com` | `production` |
| DEV | `menusifudev.com` | `development` |

### 8.2 域名替换规则

统一正则会把以下形态的域名替换成目标环境：

- `https://xxx.menusifucloud.com`
- `https://xxx.menusifucloudqa.com`
- `https://xxx.menusifudev.com`
- `https://xxx.menusifuqa.com`

替换目标是“把域名后缀整体切换到目标环境”，不是只改某个单独 key。

这意味着桌面版的策略是 **内容级域名替换**，而不是基于 JSON 字段名逐项赋值。

### 8.3 目标配置文件范围

固定处理以下 5 类文件：

| 文件 | 业务含义 |
| --- | --- |
| `tomcat\webapps\kpos\front\js\cloudUrlConfig.json` | 旧 UI 云端地址配置 |
| `tomcat\webapps\kpos\front2\json\cloudUrlConfig.json` | 新 UI 云端地址配置 |
| `tomcat\webapps\kpos\front3\js\cloudUrlConfig.json` | 快餐版/其他前端形态配置 |
| `tomcat\webapps\kpos\waitlist\cloudUrl.json` | 等位模块云端地址配置 |
| `tomcat\webapps\cloudDatahub\WEB-INF\classes\application.properties` | cloudDatahub 运行环境配置 |

### 8.4 `expiration-management` 特殊规则

普通域名替换后，系统还会额外修正 `front2\json\cloudUrlConfig.json` 中的 `expiration-management` 地址：

| 环境 | 目标地址 |
| --- | --- |
| QA | `https://wms.balamxqa.com/expiration-management` |
| DEV | `https://wms.balamxqa.com/expiration-management` |
| PROD | `https://wms.balamx.com/expiration-management` |

这里有一个非常重要的业务结论：

- `DEV` 走的是和 `QA` 一样的 `wms.balamxqa.com`
- 这不是通用域名规则，而是一个硬编码例外

迁移到 Web 版时必须保留该例外规则，否则会产生行为回归。

### 8.5 版本选择规则

- 若基础目录下只有一个版本子目录，自动选中。
- 若存在多个版本子目录，则必须由用户显式选择。
- 版本列表按目录名倒序排序。

### 8.6 线程互斥规则

桌面端同一时间只允许一个后台线程运行。换句话说：

- 正在下载 WAR 时，不能再启动替换线程。
- 正在替换 WAR 时，不能再重启 POS。

这是一个明确的并发控制要求，Web 版也建议保留。

## 9. 日志、进度与异常处理

### 9.1 用户反馈机制

桌面版有三类反馈：

1. 日志输出：用于过程记录和错误说明。
2. MessageBox：用于立即阻断式提示。
3. 进度条：主要用于下载 WAR。

### 9.2 异步处理

重启 POS、替换 WAR、下载 WAR 都通过线程执行，目的是避免 UI 卡死。

Windows 相关线程职责：

- `RestartPosThreadWindows`：包装重启动作。
- `ReplaceWarThreadWindows`：包装停止进程 + 替换 WAR 动作。
- `DownloadWarWorker`：包装远程下载动作。

### 9.3 错误模型

桌面版的错误主要是运行期错误，不是复杂的业务校验错误，典型包括：

- 基础目录不存在
- WAR 文件不存在
- 文件读写失败
- ZIP 解压失败
- 进程结束失败
- 启动路径不存在
- 下载 URL 无法解析
- Cookie 无效导致下载失败

这意味着 Web 版接口设计时，要把错误分成两层：

1. 前置校验错误
2. 执行期错误

## 10. 从业务视角看，这个模块的真实边界是什么

Windows POS 模块不负责：

- POS 业务数据本身。
- 远程 SSH 登录。
- 数据库配置。
- License 处理。

它只负责三件事：

1. **本机配置切换**
2. **本机部署包替换**
3. **本机进程控制**

所以它是一个典型的“本地运维子系统”。

## 11. 迁移到 Web 项目的关键结论

## 11.1 可以直接复用的能力

当前 `device_management` 项目已经有以下可复用能力：

1. 已有 WAR 包管理页面和 API 封装。
2. 已有下载 Cookie 配置界面。
3. 后端已经支持将 `download_cookie` 持久化。
4. 后端已有 WAR 下载服务，并且也实现了 URL 转换和两段式下载。

这意味着以下部分不必从零重做：

- WAR 下载任务模型
- 下载进度轮询机制
- Cookie 配置存储
- WAR 包元数据管理

## 11.2 不能直接靠浏览器完成的能力

Windows 桌面版最核心的动作是：

- 读写本机文件系统中的安装目录
- 删除和解压本机 WAR
- 结束和启动本机 Windows 进程

这些能力 **浏览器前端无法直接完成**。如果直接做成纯 Web 页面，会遇到根本限制：

1. 浏览器不能随意访问 `C:\Wisdomount\Menusifu\application`。
2. 浏览器不能执行 `taskkill`。
3. 浏览器不能用固定路径启动 `Menusifu POS.exe`。

因此，Windows POS 模块迁移到 Web 时，必须引入一个执行层。

## 11.3 推荐架构

推荐采用“两层执行架构”：

### 方案 A：Web 后端 + Windows Agent

1. Web 前端继续使用现在的 React 项目。
2. Web 后端继续使用现在的 Go 服务。
3. 在需要操作 Windows POS 的机器上安装一个 Windows Agent。
4. Agent 负责：
   - 枚举本机版本目录
   - 读取和修改配置文件
   - 替换本地 WAR
   - 停止和启动 POS
5. Web 后端只负责编排任务、鉴权、审计和进度聚合。

这是最符合当前项目方向的方案。

### 方案 B：Web 前端 + 本地桌面壳

如果该功能只给操作者本人在自己的 Windows 电脑上使用，也可以做成：

- React Web 前端
- 外层套 Tauri/Electron 本地壳

这样本地壳获得文件和进程权限，前端负责交互。

但这更像“桌面应用重构”，不太符合你当前已有的 Go Web 管理平台路线。

## 12. 推荐的 Web 版功能拆分

### 12.1 页面层

建议新增一个 Windows POS 页面，结构可拆成 4 个卡片区：

1. 机器与基础目录
2. 环境扫描与批量修改
3. WAR 包选择与下载
4. 版本替换与进程控制

### 12.2 后端领域能力

建议抽象出以下服务：

1. `WindowsPosInventoryService`
   - 枚举基础目录
   - 返回版本列表
   - 返回每个版本可操作状态

2. `WindowsConfigService`
   - 扫描配置差异
   - 执行环境切换
   - 返回修改统计

3. `WindowsWarDeployService`
   - 校验 WAR
   - 删除旧包
   - 解压新包
   - 返回部署日志

4. `WindowsProcessService`
   - 停止 POS
   - 启动 POS
   - 重启 POS

5. `WindowsAgentTaskService`
   - 异步任务
   - 任务状态
   - 进度事件
   - 并发互斥

### 12.3 推荐 API

建议的 Web API 如下：

- `POST /api/windows/scan`
- `POST /api/windows/config/preview`
- `POST /api/windows/config/apply`
- `GET /api/windows/versions`
- `POST /api/windows/war/deploy`
- `POST /api/windows/pos/stop`
- `POST /api/windows/pos/start`
- `POST /api/windows/pos/restart`
- `GET /api/windows/tasks/:taskId`
- `GET /api/windows/tasks/:taskId/stream`

如果采用 Agent 架构，则这些 API 不直接碰本地文件，而是下发任务给 Agent。

## 13. 与当前 Web 项目的结合点

### 13.1 可直接复用现有 WAR 下载能力

你当前项目里已经有：

- 前端 `linuxAPI.startWarDownload`
- 前端 `linuxAPI.getDownloadConfig` / `updateDownloadConfig`
- 后端 `download_cookie` 持久化
- 后端 `WarDownloadService` 的 URL 转换与下载流程

因此，Windows 模块的“下载 WAR”建议不要单独再做一套，而是直接复用当前 WAR 下载中心。

更合理的设计是：

1. WAR 下载和包管理继续放在平台统一的 WAR 管理模块。
2. Windows POS 页面只负责“选择一个已有 WAR 包”或“上传一个本地 WAR 包”。
3. 真正执行替换时，把 выбран的包路径交给 Windows Agent。

### 13.2 可复用现有文件配置思路

当前项目已经存在 Linux 文件配置管理模型。Windows 版可以沿用同样的设计思想，但不要完全照搬 Linux 的远程文件语义。

Linux 当前是远程主机文件。
Windows POS 这里是本机固定目录文件。

因此建议：

- 保留“配置模板”概念。
- 但 Windows 模块必须保留它现有的硬编码例外规则，尤其是 `expiration-management`。

### 13.3 设备维度绑定建议

如果 Web 平台最终希望将 Windows POS 运维能力挂到设备详情页，需要在设备数据上补充或维护：

- 设备类型：`windows`
- 基础目录：例如 `C:\Wisdomount\Menusifu\application`
- Agent 在线状态
- Agent 机器标识
- 最后一次探测到的版本列表

## 14. 迁移时必须保留的行为细节

以下行为建议按“不可回归”处理：

1. 支持 QA、PROD、DEV 三种环境。
2. `application.environmentType` 的映射值必须保持一致。
3. 四个固定配置文件路径必须保持一致。
4. `front2/json/cloudUrlConfig.json` 中的 `expiration-management` 必须保留特殊映射。
5. 版本目录按一级子目录识别。
6. 多版本场景必须要求用户选择目标版本。
7. 替换 WAR 前必须先停止 POS。
8. 替换时必须同时删除旧 `kpos.war` 和旧 `kpos` 解压目录。
9. 下载 WAR 后应自动识别 ZIP 中的 `kpos.war`。
10. 同时只能执行一个后台任务。

## 15. 风险与注意事项

### 15.1 进程停止是全局性的

当前桌面版通过固定进程名 `Menusifu POS.exe` 结束进程，这可能影响同机多个版本实例。Web 版如果继续沿用这个行为，应在 UI 上明确提醒。

### 15.2 目录结构依赖很强

整个模块高度依赖固定目录结构。如果某些机器安装目录不一致、Tomcat 目录被改名、可执行文件路径变化，功能会直接失败。

### 15.3 下载认证依赖 Cookie

当前下载逻辑明显依赖构建平台 Cookie。Cookie 失效会导致下载失败，因此 Web 平台需要：

- 提供 Cookie 更新入口
- 提供失效提示
- 最好支持审计和过期提醒

### 15.4 当前替换逻辑没有回滚

替换 WAR 的流程是“删除旧包，再复制新包，再解压”，中间如果失败，没有自动回滚。因此 Web 版最好补充：

- 替换前备份
- 失败回滚
- 至少保留旧 WAR 副本

## 16. 推荐实施顺序

### 第一阶段：最小可用版

1. 复用现有 WAR 下载中心。
2. 新增 Windows POS 页面。
3. 实现 Agent 版“版本列表、配置扫描、配置修改、重启 POS”。

### 第二阶段：完整部署版

1. 加入“替换 WAR”。
2. 加入任务日志流。
3. 加入失败回滚或备份策略。

### 第三阶段：平台化

1. 把 Windows 配置模板抽象成后台可配置模板。
2. 将 Windows 机器与设备详情页关联。
3. 加入权限、审计、操作记录。

## 17. 总结

Windows POS 模块的业务本质是：**围绕 Windows 本机 POS 安装目录做环境切换、部署包替换和进程控制。**

对于你现在的 Web 项目来说，真正困难的不是页面，而是执行层。WAR 下载、Cookie 配置、任务化下载，这些你现在的平台已经有不错的基础；真正需要新增的是一个能代表 Web 平台去操作 Windows 本机文件和进程的 Agent 或本地执行服务。

如果从集成视角做一句话总结：

**现有 Web 项目可以复用“WAR 下载中心”和“任务化交互”，Windows POS 迁移的关键增量是“本地执行代理”和“配置规则保持一致”。**
