-- Run this after the application has been upgraded to a build
-- that no longer depends on legacy borrow tables for AutoMigrate.
-- Both queries must return 0 before you archive or drop legacy tables.

SELECT COUNT(*) AS missing_pos
FROM device_borrow_requests d
LEFT JOIN borrow_requests b
  ON b.legacy_source = 'device_borrow_requests'
 AND b.legacy_id = d.id
WHERE b.id IS NULL;

SELECT COUNT(*) AS missing_mobile
FROM mobile_borrow_requests m
LEFT JOIN borrow_requests b
  ON b.legacy_source = 'mobile_borrow_requests'
 AND b.legacy_id = m.id
WHERE b.id IS NULL;
