-- 文件配置数据导入脚本
-- 运行方式: sqlite3 data.db < insert_file_configs.sql

-- 先清空现有数据（可选）
-- DELETE FROM file_configs;

-- 1. 旧UI cloudUrlConfig.json
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '旧UI cloudUrlConfig.json',
  'kpos/front/js/cloudUrlConfig.json',
  '[{"key":"cloudify","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloudify","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloudify","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloudify"},{"key":"loyalty_program","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=loyalty_program","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=loyalty_program","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=loyalty_program"},{"key":"cloud_report_service","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true"},{"key":"epager","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=epager","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=epager","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=epager"},{"key":"expiration_management","qa_value":"https://wms.balamxqa.com/expiration-management","prod_value":"https://wms.balamxqa.com/expiration-management","dev_value":"https://wms.balamx.com/expiration-management"}]',
  1,
  datetime('now'),
  datetime('now')
);

-- 2. 新UI cloudUrlConfig.json
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '新UI cloudUrlConfig.json',
  'kpos/front2/json/cloudUrlConfig.json',
  '[{"key":"cloudify","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloudify","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloudify","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloudify"},{"key":"loyalty_program","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=loyalty_program","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=loyalty_program","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=loyalty_program"},{"key":"cloud_report_service","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true"},{"key":"epager","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=epager","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=epager","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=epager"},{"key":"expiration_management","qa_value":"https://wms.balamxqa.com/expiration-management","prod_value":"https://wms.balamxqa.com/expiration-management","dev_value":"https://wms.balamx.com/expiration-management"}]',
  1,
  datetime('now'),
  datetime('now')
);

-- 3. 快餐版 cloudUrlConfig.json
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '快餐版 cloudUrlConfig.json',
  'kpos/front3/js/cloudUrlConfig.json',
  '[{"key":"cloudify","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloudify","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloudify","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloudify"},{"key":"loyalty_program","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=loyalty_program","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=loyalty_program","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=loyalty_program"},{"key":"cloud_report_service","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=cloud_report_service&autoCreateBusiness=true"},{"key":"epager","qa_value":"https://cloud.menusifucloudqa.com/api/iam/pos/service/entry?serviceName=epager","prod_value":"https://cloud.menusifucloud.com/api/iam/pos/service/entry?serviceName=epager","dev_value":"https://cloud.menusifudev.com/api/iam/pos/service/entry?serviceName=epager"},{"key":"expiration_management","qa_value":"https://wms.balamxqa.com/expiration-management","prod_value":"https://wms.balamxqa.com/expiration-management","dev_value":"https://wms.balamx.com/expiration-management"}]',
  1,
  datetime('now'),
  datetime('now')
);

-- 4. 云报表
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '云报表',
  'cloudDatahub/WEB-INF/classes/application.properties',
  '[{"key":"application.environmentType","qa_value":"integration","prod_value":"production","dev_value":"development"}]',
  1,
  datetime('now'),
  datetime('now')
);

-- 5. 云等位
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '云等位',
  'kpos/waitlist/cloudUrl.json',
  '[{"key":"cloudB","qa_value":"https://cloud.menusifucloudqa.com/waitlist/{mid}/","prod_value":"https://cloud.menusifucloud.com/waitlist/{mid}/","dev_value":"https://cloud.menusifudev.com/waitlist/{mid}/"},{"key":"cloudC","qa_value":"https://epager.menusifucloudqa.com/{mid}/front/start","prod_value":"https://epager.menusifucloud.com/{mid}/front/start","dev_value":"https://epager.menusifudev.com/{mid}/front/start"}]',
  1,
  datetime('now'),
  datetime('now')
);

-- 6. 云等位 newwait
INSERT INTO file_configs (name, file_path, key_values, enabled, created_at, updated_at) VALUES (
  '云等位 newwait',
  'kpos/newwaitlist.json',
  '[{"key":"url","qa_value":"https://cloud.menusifucloudqa.com/waitlist/{mid}/manage/waitlist","prod_value":"https://cloud.menusifucloud.com/waitlist/{mid}/manage/waitlist","dev_value":"https://cloud.menusifudev.com/waitlist/{mid}/manage/waitlist"}]',
  1,
  datetime('now'),
  datetime('now')
);
