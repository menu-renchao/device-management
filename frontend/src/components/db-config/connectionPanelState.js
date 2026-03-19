export function getDBPasswordPlaceholder(hasSavedPassword = false, password = '') {
  if ((password || '').trim() !== '') {
    return '请输入数据库密码';
  }
  return hasSavedPassword ? '已保存密码' : '请输入数据库密码';
}
