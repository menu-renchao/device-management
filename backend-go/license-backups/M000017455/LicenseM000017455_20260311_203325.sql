-- ============================================================
-- License 备份文件
-- 商户ID: M000017455
-- 生成时间: 2026-03-11 20:33:25
-- 工具版本: License备份恢复工具 v1.0
-- ============================================================

-- ==================== COMPANY_PROFILE 更新 ====================

UPDATE company_profile SET 
        name = 'songxia2 Restaurant',
        address1 = '2560 El Camino Real',
        address2 = null,
        city = 'Redwood City',
        state = 'CA',
        zipcode = '94061',
        telephone1 = '6505951914',
        telephone2 = null,
        license_key = 'QIXzVJvAtKvghZ8nzecFi5KOwcZrm+HcHqn97RLl6yw9FVZUtmOkXlDBZjhNM7bpWmPSnkvvaH0e+D+LMnRy7NG/7ylCliz28RvPr9zlfTjvvaLBgK+oJVMF4md0gtEk/7wd8+1ySlkPRWj8n+Fw/12ZvqTDpV86IzsOI5P7QgE=',
        merchant_id = 'M000017455',
        merchant_group_id = 'M000015464',
        license_status = 2,
        timezone = 'Asia/Shanghai',
        license_expires_on = 'SBdYg8EvOYP2uRK0ynmg/JV2ev0PBrF+y0B+3YUYr3k=',
        mode = null,
        serial_no = '133e2ea6';


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
        'MAX_POS_ALLOWED', '83T2AYYSwUe0gBUpqAd1eQJE02cm8P9hpLyPXvLtZQM=', null, null, null, '2020-07-23 13:58:50',
        '', '2022-05-05 14:24:36', '2023-08-24 02:20:44', null, null,
        12, 'POS License', 'LICENSE', null,
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
        'MENUSIFU_SERVICE_KEY', '+K/AfQlh2sFrAnL/SNR/mfIOGgv5QyCUmIyoI3o44eo=', null, null, null, '2020-07-23 13:58:50',
        'Menusifu service key', '2022-05-05 14:24:37', '2023-08-24 02:15:55', null, null,
        14, 'Menusifu service key', 'Cloud', null,
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
