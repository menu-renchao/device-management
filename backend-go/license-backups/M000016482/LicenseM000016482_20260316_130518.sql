-- ============================================================
-- License 备份文件
-- 商户ID: M000016482
-- 生成时间: 2026-03-16 13:05:18
-- 工具版本: License备份恢复工具 v1.0
-- ============================================================

-- ==================== COMPANY_PROFILE 更新 ====================

UPDATE company_profile SET 
        name = 'MenuSifu Cloud-G',
        address1 = '349 5th Ave 3rd Floor',
        address2 = null,
        city = 'New York',
        state = 'NY',
        zipcode = '10016',
        telephone1 = '8889998899',
        telephone2 = null,
        license_key = 'zIwrfn8p18IlxRv59KQKbqfw7/ahWSJtFVkI6Fx0IbXwjZP22jPGRWCdqGxPBXxNvdyfA/rvZyyAl2da3Q+UfbrXvdU2g2cjErHi9uDjMiA0PVRaVmHLJrYAyOFhL1b8nLfmbb49mHQW1M7nAbpZee0LB165BgAiHB69OP/Ivt0=',
        merchant_id = 'M000016482',
        merchant_group_id = 'M000016482',
        license_status = 2,
        timezone = 'America/New_York',
        license_expires_on = 'SBdYg8EvOYP2uRK0ynmg/JV2ev0PBrF+y0B+3YUYr3k=',
        mode = null,
        serial_no = 'b7a10aff';


-- ==================== SYSTEM_CONFIGURATION 清理 ====================
DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'LICENSE_HARDWARE_SIGNATURE_REQUIRED';
DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MAX_POS_ALLOWED';
DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MENUSIFU_API_SERVICE_API_KEY';
DELETE FROM `kpos`.`system_configuration` WHERE `name` = 'MENUSIFU_SERVICE_KEY';

-- ==================== SYSTEM_CONFIGURATION 插入 ====================

INSERT INTO system_configuration (
        `name`, `val`, `boolean_val`, `int_val`, `double_val`, `date_val`,
        `description`, `created_on`, `last_updated`, `created_by`, `last_updated_by`,
        `version`, `display_name`, `category`, `second_level_category`,
        `frontend_readable`, `frontend_editable`, `admin_readable`, `admin_editable`,
        `config_type`, `global_setting`, `user_setting`, `app_setting`, `sync_to_cloud`,
        `merchant_id`, `sequence_num`
    ) VALUES (
        'MAX_POS_ALLOWED', '83T2AYYSwUe0gBUpqAd1ed5cdhuCJD0tl7BQGdlQU6k=', null, null, null, '2020-07-23 13:58:50',
        '', '2018-07-06 13:23:45', '2023-04-18 08:01:00', null, null,
        11, 'POS License', 'LICENSE', null,
        0, 0, 0, 0,
        'INPUT', 1, 0, 0, 0,
        null, 9999
    );

INSERT INTO system_configuration (
        `name`, `val`, `boolean_val`, `int_val`, `double_val`, `date_val`,
        `description`, `created_on`, `last_updated`, `created_by`, `last_updated_by`,
        `version`, `display_name`, `category`, `second_level_category`,
        `frontend_readable`, `frontend_editable`, `admin_readable`, `admin_editable`,
        `config_type`, `global_setting`, `user_setting`, `app_setting`, `sync_to_cloud`,
        `merchant_id`, `sequence_num`
    ) VALUES (
        'MENUSIFU_API_SERVICE_API_KEY', 's8JsK1db9Q4P1zv1SpXylaaTzLuhKwdTaOJ4tABC', null, null, null, '2020-07-23 13:58:50',
        'Menusifu API Service Key', '2020-07-23 13:58:50', '2020-07-23 13:58:50', null, null,
        0, 'Menusifu API Service Key', 'Cloud', null,
        0, 0, 0, 0,
        'INPUT', 1, 0, 0, 0,
        null, 9999
    );

INSERT INTO system_configuration (
        `name`, `val`, `boolean_val`, `int_val`, `double_val`, `date_val`,
        `description`, `created_on`, `last_updated`, `created_by`, `last_updated_by`,
        `version`, `display_name`, `category`, `second_level_category`,
        `frontend_readable`, `frontend_editable`, `admin_readable`, `admin_editable`,
        `config_type`, `global_setting`, `user_setting`, `app_setting`, `sync_to_cloud`,
        `merchant_id`, `sequence_num`
    ) VALUES (
        'MENUSIFU_SERVICE_KEY', 'Gj+kwL4L3EfqpXJ4CfOypOrmPZ+o8yeZnYeyTvZlFvM=', null, null, null, '2020-07-23 13:58:50',
        'Menusifu service key', '2018-07-06 13:23:47', '2023-04-18 06:25:09', null, null,
        23, 'Menusifu service key', 'Cloud', null,
        0, 0, 0, 0,
        'INPUT', 1, 0, 0, 0,
        null, 9999
    );

-- ==================== 额外配置更新 ====================

UPDATE system_configuration SET val = NULL WHERE name = 'AWS_SQS_QUEUE_INFO';

UPDATE kpos.system_configuration SET val = 'https://api.menusifu.cn/performance-env'
WHERE name IN ('HEARBEAT_SERVICE_URL', 'MENU_SERVICE_URL', 'MERCHANT_SERVICE_URL', 'ORDER_SERVICE_URL');

UPDATE system_configuration SET val = 'hWppFMrbyV5+J/BsjHcP5UyoiyVYNw83x2mq8UhxnJAUFfKPSuHU8bumw8ma5LI/'
WHERE name = 'MENUSIFU_PUBLIC_API_SERVICE_API_KEY';

DELETE FROM kpos.sync_scheduled_task_his;

UPDATE kpos.system_configuration SET boolean_val = 1
WHERE name = 'ENABLE_MENUSIFU_PUBLIC_API_SERVICE';

UPDATE kpos.system_configuration SET val = NULL
WHERE `name` = 'AWS_SQS_QUEUE_INFO' AND merchant_id IS NULL;
