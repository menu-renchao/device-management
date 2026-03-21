# Frontend Prod Preview Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 把前端启动方式从 `vite dev` 切换到 `vite preview`，固定使用 3000 端口，并保留现有代理行为。

**Architecture:** 保持 Vite 作为前端运行入口，但把部署机上的启动命令从开发服务器切换成构建后预览。`vite.config.js` 中为 `preview` 显式配置 host、port、allowedHosts 和 proxy，避免生产预览时路径行为与开发模式不一致。

**Tech Stack:** Vite 4, React 18, Windows batch script

---

### Task 1: Add production preview script

**Files:**
- Modify: `D:/project x/device-management/frontend/package.json`

**Step 1: Add preview script**

新增脚本：

```json
"preview:prod": "vite preview --host 0.0.0.0 --port 3000 --strictPort"
```

**Step 2: Verify command resolves**

Run: `npx vite --version`
Expected: 输出本地 vite 版本

### Task 2: Mirror runtime config for preview

**Files:**
- Modify: `D:/project x/device-management/frontend/vite.config.js`

**Step 1: Extract shared server config**

把 `host`、`port`、`allowedHosts`、`proxy` 收口成共享配置。

**Step 2: Apply to both dev and preview**

让：

```js
server: sharedServerConfig,
preview: sharedServerConfig,
```

同时生效。

**Step 3: Verify build**

Run: `npm run build`
Expected: build 成功

### Task 3: Replace Windows startup flow

**Files:**
- Modify: `D:/project x/device-management/start-frontend.bat`

**Step 1: Update script flow**

改成：
1. 检查 Node
2. 进入 `frontend`
3. 如无 `node_modules` 则执行 `npm install`
4. 执行 `npm run build`
5. 执行 `npm run preview:prod`

**Step 2: Keep port messaging fixed**

脚本输出继续明确提示访问地址为 `http://localhost:3000`

### Task 4: Verify end-to-end startup

**Files:**
- Modify: none

**Step 1: Start preview briefly**

Run: `npm run preview:prod`
Expected: 监听 `3000`

**Step 2: Verify page responds**

访问：`http://localhost:3000/`
Expected: 返回前端首页 HTML
