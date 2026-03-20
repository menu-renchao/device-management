# POS Web Open Mode Design

**Problem**

Current POS page access only supports LAN direct open via `http://<ip>:22080`. This works for users on the same local network as the POS, but fails for users visiting the device management service through the public entry `153.3.250.178:3000`. The previous proxy design is discarded.

The new design must satisfy these requirements:

- POS pages are plain HTTP pages
- The management server can directly reach POS devices on `ip:22080`
- Inner-network users should prefer LAN direct access
- Outer-network users should be able to reach POS pages through the management server
- The product rule is simple: any logged-in user may access any POS
- The POS list page should expose one `打开` entry only
- The default open mode should be a per-user global setting: `直连` or `代理`

**Decision**

Use an application-layer POS reverse proxy in Go, with Nginx only acting as the public entry and normal API/static reverse proxy.

- Nginx keeps its current role: public ingress, static assets, `/api` forwarding
- Go resolves `merchantId -> current POS IP` from scan results
- Go provides a POS access metadata endpoint and a POS reverse proxy endpoint
- Frontend adds a per-user global default open mode setting
- The scan page keeps a single `打开` button and chooses direct or proxied open based on the user's default mode

**Why This Approach**

1. Dynamic target resolution is business logic, not edge proxy logic
2. Nginx-only dynamic proxying would be awkward because `merchantId -> ip` comes from SQLite-backed application data
3. Plain HTTP POS pages are well-suited to standard reverse proxying in Go
4. This keeps the design simple while preserving LAN performance for inner-network users
5. Product rules stay aligned with the current system: logged-in users can access any POS

**Scope**

Included:

- POS access metadata endpoint
- POS reverse proxy endpoint
- Per-user frontend default open mode
- Single `打开` action in the scan table
- Direct open mode
- Proxy open mode
- Basic access logging for proxied requests
- Redirect and cookie-path rewriting required for path-prefix proxying

Not included:

- Device-level authorization
- Arbitrary IP/port forwarding
- WebSocket/SSE support
- VPN, tunnel agent, or SD-WAN solutions
- Deep HTML/JS rewriting beyond minimal root-path compatibility fixes

**Architecture**

The design has four parts:

1. **Public ingress**
- Nginx remains the public ingress on `153.3.250.178:3000`
- Nginx forwards frontend assets and `/api/*` requests to the Go service

2. **POS target resolution**
- Go resolves a POS target from `merchantId`
- Source of truth is the latest scan result stored in `scan_results`
- The resolved target is always `http://<resolved-ip>:22080`

3. **POS reverse proxy**
- Go accepts proxied browser requests under `/api/device/:merchantId/pos-proxy`
- The proxy forwards methods, query strings, request bodies, and most headers
- The proxy rewrites `Location` and cookie path values so that follow-up requests remain inside the proxy prefix

4. **Frontend open mode**
- The scan page stores a per-user global preference in local storage
- The preference controls whether `打开` uses `directUrl` or `proxyUrl`
- No auto-probing or dual-entry UI is used in the final design

**API Design**

1. `GET /api/device/:merchantId/pos-access`

Purpose:
- Return current access metadata for a POS device

Rules:
- Requires login only
- No device-level authorization

Example response:

```json
{
  "merchantId": "M123456",
  "ip": "192.168.1.50",
  "port": 22080,
  "directUrl": "http://192.168.1.50:22080/",
  "proxyUrl": "/api/device/M123456/pos-proxy/",
  "preferDirect": true,
  "isOnline": true,
  "lastOnlineTime": "2026-03-20T10:20:30+08:00"
}
```

2. `ANY /api/device/:merchantId/pos-proxy`
3. `ANY /api/device/:merchantId/pos-proxy/*path`

Purpose:
- Proxy browser requests to the resolved POS target

Rules:
- Requires login only
- Target is always resolved from `merchantId`
- Target port is fixed to `22080`

**Backend Behavior**

**Target resolution**

- Validate `merchantId` is present
- Resolve device by `merchantId`
- Read the current IP from scan results
- Return a conflict/error if the device is offline or lacks a usable IP
- Build:
  - `directUrl = http://<ip>:22080/`
  - `proxyUrl = /api/device/:merchantId/pos-proxy/`

**Proxy transport**

- Use a shared `http.Transport`
- Reuse upstream connections
- Set conservative timeouts
- Forward method, query, and body without unnecessary buffering where possible

Recommended transport behavior:

- dial timeout around `2s`
- response header timeout around `8s`
- idle connection reuse enabled

**Proxy rewriting**

Required:

1. Rewrite `Location`
- From upstream root or absolute POS URLs
- To the proxy prefix `/api/device/:merchantId/pos-proxy/...`

2. Rewrite cookie path
- If upstream sets `Path=/`
- Rewrite to `Path=/api/device/:merchantId/pos-proxy/`

3. Minimal HTML root-path rewriting
- Only for `text/html`
- Rewrite common root-relative `href`, `src`, and `action` values to stay under the proxy prefix

The first implementation should stay narrow and conservative. Do not introduce a large HTML rewrite engine until real compatibility evidence requires it.

**Frontend Design**

Final UI:

- One `打开` button in the scan table
- One per-user global setting on the page toolbar:
  - `默认打开方式: 直连 / 代理`

Behavior:

1. User clicks `打开`
2. Frontend requests `GET /api/device/:merchantId/pos-access`
3. If unavailable, show an error toast
4. If user default mode is `直连`, open `directUrl`
5. If user default mode is `代理`, open `proxyUrl`

Preference storage:

- Store locally per user, keyed by current user identity
- Example logical key: `scan_page_pos_open_mode_<userId>`

No automatic network probing is used.

**Authorization**

Keep authorization intentionally simple:

- Must be logged in
- Any logged-in user may access any POS

This matches the current product rule and avoids introducing new access semantics.

**Error Handling**

For `pos-access`:

- `401` not logged in
- `404` merchant/device not found
- `409` device offline or missing target IP
- `502` target currently unreachable

For `pos-proxy`:

- Return a simple browser-visible error page
- Message should clearly state that the POS page is currently unavailable through the server

**Performance Expectations**

- Direct mode remains the preferred path for inner-network users
- Proxy mode adds one server hop, but the server-to-POS hop is on the local network and should usually be cheap
- For normal POS pages, the proxy is expected to be usable without severe lag
- Heavy concurrent external usage may pressure server bandwidth and connection pools, but this is acceptable for the first version

**Risks**

1. POS pages may use absolute root paths extensively
- Mitigation: rewrite `Location`, cookie path, and minimal HTML root-relative paths

2. Some pages may still embed paths in inline scripts
- Mitigation: validate against real POS pages and patch only proven cases

3. Scan result IPs may be stale
- Mitigation: resolve on each request rather than caching aggressively in frontend logic

4. Proxy usage may increase server bandwidth usage
- Mitigation: keep LAN users on direct mode by default

**Acceptance Criteria**

- Logged-in users can open a POS page through the server using `merchantId`
- Inner-network users can keep using LAN direct mode
- Each user can choose a personal default open mode: `直连` or `代理`
- The scan table exposes a single `打开` action
- Proxy mode supports normal POS page navigation, form submission, and redirected flows
- Proxy failures surface clear errors and useful server logs

**Next Step**

Write an implementation plan covering:

- backend POS access service
- backend proxy endpoint
- proxy compatibility rewrites
- frontend open-mode preference
- scan page integration
