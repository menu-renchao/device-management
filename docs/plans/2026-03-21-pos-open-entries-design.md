# POS Open Entries Design

**Problem**

The scan page currently exposes one `打开` action that opens the POS root entry only. A separate browser extension already proves users need nine fixed POS web entries:

- POS
- EMENU
- KIOSK
- KDS
- RDS
- CDS
- WAITLIST
- PAGING
- KDS CONFIG

The product requirement is not to add backend configuration. The device management UI should expose these fixed entries directly on the scan page while preserving the current global open mode (`直连` / `代理`).

The design must satisfy these rules:

- `POS` is the highest-frequency action and should stay one click
- the other eight entries must be available without leaving the row context
- no extra modal should be required for the common case
- the existing direct/proxy access flow must remain unchanged
- entry selection should work for both direct and proxy open modes
- the extension logic should be absorbed into the POS management page rather than kept as a separate operational tool

**Decision**

Use a split-button open control in the scan table:

- primary action: `打开POS`
- secondary chevron action: open a compact menu with all nine fixed entries
- keep the current toolbar-level `直连 / 代理` global mode
- resolve the final URL as `baseUrl + entryPath`
- remember the user's most recent non-default entry for convenience in the menu, but do not replace the primary button label or behavior

**Why This Approach**

1. It preserves the shortest possible path for the most common action
2. It keeps all alternate entries discoverable in the same row
3. It avoids turning a simple open action into a modal workflow
4. It reuses the current `pos-access` backend contract and only extends frontend URL composition
5. It keeps product behavior deterministic: the primary action always means POS

**Scope**

Included:

- fixed frontend entry definitions for the nine supported POS web entries
- split-button interaction in the scan table
- URL composition for both direct and proxy open modes
- recent-entry memory for menu convenience
- targeted frontend tests for entry resolution and storage behavior

Not included:

- backend-configurable entry templates
- per-device custom entry sets
- changes to Go `pos-access` APIs
- permissions changes

**Frontend Interaction**

Each openable device row gets a split button:

- left button: `打开POS`
- right button: chevron only

Behavior:

1. Click `打开POS`
- fetch access info through existing `GET /api/device/:merchantId/pos-access`
- resolve base URL using current open mode
- append the `POS` entry path
- open immediately in the placeholder popup

2. Click chevron
- show a compact anchored menu in the row action area
- menu order:
  - POS
  - EMENU
  - KIOSK
  - KDS
  - RDS
  - CDS
  - WAITLIST
  - PAGING
  - KDS CONFIG
- mark `POS` as the default entry
- if the user recently opened a non-POS entry, show a subtle `最近使用` indicator on that item

3. Click any menu item
- use the same backend metadata request
- resolve the final URL for the selected entry
- close the menu after launching

**State Model**

Keep existing per-user storage for open mode and add one new per-user key for recent entry:

- `scan_page_pos_open_mode_<userId>`
- `scan_page_pos_open_entry_<userId>`

Rules:

- invalid stored entry falls back to `pos`
- recent entry is informational for the menu only
- primary button behavior is always `pos`

**URL Composition**

The backend continues to return base URLs:

- `directUrl`: `http://<ip>:22080/`
- `proxyUrl`: `/api/device/:merchantId/pos-proxy/` or configured proxy host

The frontend appends a fixed entry path table:

- `pos` -> `kpos/front2/myhome.html`
- `emenu` -> `kpos/emenu/#/`
- `kiosk` -> `kpos/kiosklite#/`
- `kds` -> `kpos/kitchen/#/tab/kitchen`
- `rds` -> `kpos/kitchen/#/tab/runner/`
- `cds` -> `kpos/dual/new/`
- `waitlist` -> `kpos/waitlist/#/`
- `paging` -> `kpos/call`
- `kdsconfig` -> `kpos/kitchen/#/tab/config`

Composition rules:

- normalize the base URL so exactly one slash joins base and entry path
- append JWT `token` only for proxy mode, preserving current behavior
- do not mutate the backend response shape

**Error Handling**

- if `merchantId` is missing, show the existing warning toast
- if popup creation fails, keep the existing blocked-popup warning
- if `pos-access` fails, close the placeholder popup and show the returned error
- if entry resolution fails due to missing base URL, close the popup and show a clear toast

**Testing**

Add frontend tests for:

- entry normalization and fallback
- recent-entry storage key and persistence
- final URL composition for direct mode and proxy mode
- correct proxy token appending after entry path composition
