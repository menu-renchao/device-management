# Legacy Borrow Table Cleanup

These scripts are for the platform application's own SQLite database, not for the merchant business database.

Use them only after deploying a build that:

- no longer includes `DeviceBorrowRequest` in `AutoMigrate`
- no longer includes `MobileBorrowRequest` in `AutoMigrate`
- tolerates missing `device_borrow_requests` and `mobile_borrow_requests` during legacy migration

Recommended order:

1. Run `01_precheck_legacy_borrow_tables.sql`
2. Confirm both query results are `0`
3. Run `02_archive_legacy_borrow_tables.sql`
4. Observe for a safe window
5. Run `03_drop_archived_legacy_borrow_tables.sql`
