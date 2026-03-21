# Frontend Prod Preview Design

**Goal:** 将前端从 `vite dev` 启动切换为“先构建、再预览”的生产式运行，同时继续使用 `3000` 端口，并保持 `/api`、`/uploads`、`/ws` 代理能力。

**Approach:** 继续使用 Vite 提供静态文件服务，但不再运行开发服务器，而是改为 `vite preview`。在 Vite 配置中补齐 `preview` 侧的端口、主机、允许主机和代理设置，使“预览模式”具备和当前开发模式等价的访问路径。

**Trade-offs:**
- 优点：改动小，不需要额外安装 Nginx，能立即从开发模式切换到更接近生产的运行方式。
- 缺点：这仍然不是完整的 Nginx 正式托管方案，但比 `npm run dev` 更适合部署机运行。

**Files:**
- Modify: `D:/project x/device-management/frontend/package.json`
- Modify: `D:/project x/device-management/frontend/vite.config.js`
- Modify: `D:/project x/device-management/start-frontend.bat`

**Verification:**
- `npm run build`
- `npm run preview:prod`
- 访问 `http://localhost:3000/`
