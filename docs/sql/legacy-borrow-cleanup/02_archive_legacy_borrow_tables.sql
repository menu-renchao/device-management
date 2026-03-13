-- Archive legacy borrow tables instead of dropping them immediately.
-- Run only after 01_precheck_legacy_borrow_tables.sql returns 0 for both queries.

BEGIN IMMEDIATE;

ALTER TABLE device_borrow_requests
RENAME TO device_borrow_requests_legacy_20260312;

ALTER TABLE mobile_borrow_requests
RENAME TO mobile_borrow_requests_legacy_20260312;

COMMIT;
