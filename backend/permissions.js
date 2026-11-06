const PERMISSIONS = {
  'article.read': '阅读文章', 'comment.read': '阅读评论', 'comment.create': '发表评论',
  'article.manage': '管理文章', 'comment.moderate': '管理全部评论',
  'user.ban': '管理用户封禁', 'visitor.ban': '管理访客封禁',
  'feedback.manage': '处理问题反馈',
  'site.manage': '管理扩展板块内容',
};
const defaults = {
  guest: ['article.read', 'comment.read'],
  user: ['article.read', 'comment.read', 'comment.create'],
  admin: Object.keys(PERMISSIONS),
  owner: Object.keys(PERMISSIONS),
};
function effectivePermissions(user) {
  if (!user || !user.verified_at) return defaults.guest;
  if (user.role === 'owner') return defaults.owner;
  let overrides = {};
  try { overrides = JSON.parse(user.permissions || '{}'); } catch { /* ignore invalid historic data */ }
  const result = new Set(defaults[user.role] || defaults.user);
  for (const key of Object.keys(PERMISSIONS)) {
    if (user.role === 'user' && !defaults.user.includes(key)) continue;
    if (overrides[key] === true) result.add(key);
    if (overrides[key] === false) result.delete(key);
  }
  return [...result];
}
function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role,
    contact: user.contact_type ? { type: user.contact_type, value: user.contact_value, verified: !!user.verified_at } : null,
    needsContactVerification: !user.verified_at, permissions: effectivePermissions(user) };
}
module.exports = { PERMISSIONS, effectivePermissions, publicUser };
