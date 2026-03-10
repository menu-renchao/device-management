# Linux POS Status Detection Design

**Problem**

`GET /api/linux/status` currently treats any process containing `pos` or `menusifu` as evidence that POS is running. On affected Linux hosts, unrelated processes such as Webmin or Menusifu Device Manager also match that pattern, which causes false positives.

**Decision**

Treat POS as running only when the process list contains `/opt/menusifu/menusifu_pos_extention`.

**Scope**

- Update the Linux status detection logic in the backend Go service.
- Keep the response shape unchanged.
- Preserve `systemctl_status` as auxiliary information only.

**Validation**

- Add a regression test covering output with and without `/opt/menusifu/menusifu_pos_extention`.
- Verify the backend Go tests pass.
