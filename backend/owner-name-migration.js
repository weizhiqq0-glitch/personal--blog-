async function migrateOwnerName(db, username) {
  if (!username) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS site_migrations(migration_key TEXT PRIMARY KEY,details TEXT NOT NULL,created_at BIGINT NOT NULL)').run();
  const key = 'owner-name-mowu-v1';
  if (await db.prepare('SELECT migration_key FROM site_migrations WHERE migration_key=?').get(key)) return;
  const owner = await db.prepare("SELECT id,username FROM users WHERE role='owner'").get();
  if (!owner) return;
  const duplicate = await db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (duplicate && duplicate.id !== owner.id) throw Error('目标站主用户名已被占用，未覆盖任何账号');
  await db.prepare('UPDATE users SET username=? WHERE id=?').run(username, owner.id);
  await db.prepare('INSERT INTO site_migrations(migration_key,details,created_at) VALUES (?,?,?) ON CONFLICT(migration_key) DO NOTHING').run(key, JSON.stringify({ ownerId: owner.id, previousUsername: owner.username, username }), Date.now());
}
module.exports = { migrateOwnerName };
