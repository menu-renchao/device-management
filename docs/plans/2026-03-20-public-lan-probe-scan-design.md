# Public LAN Probe Scan Design

**Problem**

The current scan flow assumes the backend service can directly probe the target LAN. The existing manual scan endpoint accepts a `local_ip`, derives a `/23` subnet, and scans `22080` from the backend process. This works only when the service runs inside the same network as the POS devices.

Now that the service is exposed on the public internet, the backend can no longer reach customer devices behind NAT. The system must support discovering devices inside a user's own LAN without requiring VPN, port forwarding, or direct inbound access from the public server into the private network.

**Decision**

Adopt a `cloud control plane + LAN probe agent` architecture.

- The public backend stops being the network executor for customer LAN scans.
- A lightweight probe process is installed on a Windows machine inside the customer's LAN.
- The probe authenticates to the public backend, polls for scan jobs, executes LAN scanning locally, and uploads progress and results.
- The backend remains the source of truth for device inventory, task logs, and UI state.
- Existing scan result persistence logic is reused on the backend; raw probe uploads are translated into the current device records.

**Why This Approach**

1. NAT traversal becomes simple because the probe initiates outbound connections to the cloud.
2. No browser capability can reliably replace a background network scanner for TCP probing and scheduled discovery.
3. The current scan implementation can be reused with limited refactoring by moving scan execution into a reusable library and embedding it in the probe.
4. This preserves the current product model: administrators operate from the central UI while the system still sees private LAN devices.

**Scope**

Included:

- Probe registration and authentication
- Probe heartbeat and online/offline tracking
- Manual scan job creation targeting a selected probe
- Probe-side execution of CIDR-based LAN scans
- Batched progress and result uploads
- Backend persistence into existing device inventory tables
- Probe and job visibility in the management UI
- Safety restrictions on CIDR size, target IP ranges, and target ports

Not included:

- VPN or SD-WAN connectivity
- Browser-only scanning
- Multi-probe distributed coordination for the same job
- Automatic probe upgrades
- WebSocket push in the first version
- Arbitrary port scanning beyond approved POS targets

**Architecture**

The design has three layers:

1. **Cloud control plane**
- Runs in the public backend
- Owns probe registry, job creation, job state transitions, result ingestion, and audit logs
- Exposes APIs for admins and separate APIs for authenticated probes

2. **LAN probe agent**
- Runs inside the customer's LAN on Windows
- Stores its own cloud endpoint, token, and identity metadata
- Polls the cloud for jobs
- Executes scanning locally against configured RFC1918 CIDR blocks
- Uploads job status, progress, and result batches

3. **Inventory persistence**
- Stays in the existing backend data model
- Reuses current scan-result upsert logic so discovered devices still appear in the current POS/device list
- Keeps job-specific raw uploads separately for troubleshooting and auditability

**Current-Code Impact**

The current scan entry points are:

- [scan.go](D:/menusifu/device_management/backend-go/internal/handlers/scan.go)
- [scan_service.go](D:/menusifu/device_management/backend-go/internal/services/scan_service.go)

The current service owns both orchestration and execution. That is too coupled for the new architecture. The scan code should be separated into:

- a reusable scan execution package with host generation, port probing, metadata fetch, OS detection, and result shaping
- a cloud job orchestration layer that no longer assumes local network access
- a probe runner that calls the reusable scan package locally

The backend should keep the current result upsert behavior from [scan.go](D:/menusifu/device_management/backend-go/internal/handlers/scan.go), but the source of those results will be probe uploads rather than in-process scanning.

**Data Model**

Add `probe_agents`:

- `id`
- `workspace_id` or equivalent tenant ownership field
- `name`
- `machine_code`
- `token_hash`
- `status`
- `hostname`
- `local_ip`
- `version`
- `last_seen_at`
- `last_heartbeat_at`
- `created_at`
- `updated_at`

Add `probe_scan_jobs`:

- `id`
- `probe_agent_id`
- `trigger_type`
- `status`
- `cidr_blocks_json`
- `port`
- `connect_timeout_seconds`
- `request_timeout_seconds`
- `max_probe_workers`
- `max_fetch_workers`
- `requested_by`
- `started_at`
- `finished_at`
- `devices_found`
- `merchant_ids_found`
- `error_message`
- `created_at`
- `updated_at`

Add `probe_scan_job_results`:

- `id`
- `job_id`
- `ip`
- `merchant_id`
- `name`
- `version`
- `type`
- `status`
- `error`
- `full_data_json`
- `reported_at`

**API Design**

Admin-facing endpoints:

- `GET /api/probes`
- `GET /api/probes/:id`
- `POST /api/probes/:id/scan-jobs`
- `GET /api/probes/:id/scan-jobs`
- `POST /api/probes/:id/scan-jobs/:jobId/cancel`

Probe-facing endpoints:

- `POST /api/probe-agent/register`
- `POST /api/probe-agent/heartbeat`
- `GET /api/probe-agent/jobs/next`
- `POST /api/probe-agent/jobs/:jobId/start`
- `POST /api/probe-agent/jobs/:jobId/progress`
- `POST /api/probe-agent/jobs/:jobId/results/batch`
- `POST /api/probe-agent/jobs/:jobId/finish`

**Probe Runtime Design**

The first version should use HTTP polling instead of WebSocket. It is simpler to deploy, easier to debug, and sufficient for job dispatch latency on the order of seconds.

Probe runtime modules:

1. bootstrap
- load config
- register if needed
- initialize structured logs

2. heartbeat loop
- send status every 15 to 30 seconds

3. job poller
- request next available job every 5 to 10 seconds

4. scan runner
- execute the assigned CIDR scan
- emit progress locally and to the cloud

5. result uploader
- send result batches and final state

The probe must allow only one running job at a time.

**Security Rules**

The cloud must not become a generic remote scanner. Enforce these restrictions in both UI and backend validation:

- require HTTPS for all probe-to-cloud traffic
- use one-time install or registration token, then mint a long-lived probe token
- store only token hashes on the server
- bind every probe to a tenant/workspace
- allow only private IPv4 CIDR blocks
- reject loopback, link-local, multicast, and public ranges
- cap total hosts per job, for example `4096`
- restrict port selection to `22080` in the first version
- record all task creation, execution, and upload events in logs

**Error Handling**

1. Probe offline
- admin job creation should fail fast or stay pending with clear status

2. Probe loses connectivity mid-job
- already uploaded batches remain valid
- final status becomes `failed` or `cancelled` after timeout

3. Individual device fetch failure
- record device-level error
- continue the rest of the job

4. Job-level fatal validation failure
- reject before dispatch

5. Duplicate uploads or retry after timeout
- result ingestion must be idempotent at least by `job_id + merchant_id/ip`

**Acceptance Criteria**

- An administrator can choose a probe from the UI and trigger a scan without relying on backend local NICs
- A probe inside a customer LAN can discover POS devices on RFC1918 networks and upload them to the cloud
- Uploaded results appear in the existing device list using the current inventory model
- Probe status is visible as online/offline with recent heartbeat metadata
- CIDR and port restrictions prevent public-internet scanning misuse
- If the probe is offline or a job fails, the UI shows actionable status instead of silently doing nothing

**Implementation Direction**

Recommended delivery order:

1. add probe data model and repositories
2. add probe registration and heartbeat APIs
3. add admin job creation and probe polling APIs
4. extract reusable scan execution logic from the current scan service
5. build the Windows probe runner using that execution logic
6. add result ingestion and current-device upsert reuse
7. add UI for probe selection, job triggering, and job history
8. validate end-to-end against a real private LAN
