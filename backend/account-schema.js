const columns = [
  ['contact_type', 'TEXT'], ['contact_value', 'TEXT'], ['verified_at', 'TEXT'],
  ['banned', 'INTEGER NOT NULL DEFAULT 0'], ['ban_reason', "TEXT NOT NULL DEFAULT ''"],
  ['permissions', "TEXT NOT NULL DEFAULT '{}'"],
];
const tables = [
  `CREATE TABLE IF NOT EXISTS verification_challenges (
    request_hash TEXT PRIMARY KEY, contact_type TEXT NOT NULL, contact_value TEXT NOT NULL,
    purpose TEXT NOT NULL, user_id INTEGER, code_hash TEXT NOT NULL, expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, consumed_at BIGINT, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS verification_delivery (key TEXT PRIMARY KEY, next_send_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS verification_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS visitors (
    key TEXT PRIMARY KEY, first_seen BIGINT NOT NULL, last_seen BIGINT NOT NULL,
    banned INTEGER NOT NULL DEFAULT 0, ban_reason TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS moderation_events (
    event_key TEXT PRIMARY KEY, actor_id INTEGER NOT NULL, action TEXT NOT NULL,
    target TEXT NOT NULL, details TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS users_contact_unique ON users(contact_type,contact_value)',
  "CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner ON users(role) WHERE role='owner'",
];
const postgresAccountMigrations = [
  ...columns.map(([name, type]) => `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${name} ${type}`),
  'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check',
  "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('user','admin','owner'))",
  ...tables,
];
function migrateSqliteAccounts(db) {
  const present = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
  for (const [name, type] of columns) if (!present.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  const definition = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get().sql;
  if (!definition.includes("'owner'")) {
    db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE users_v2 (
        id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin','owner')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        contact_type TEXT,contact_value TEXT,verified_at TEXT,banned INTEGER NOT NULL DEFAULT 0,
        ban_reason TEXT NOT NULL DEFAULT '', permissions TEXT NOT NULL DEFAULT '{}');
        INSERT INTO users_v2 SELECT id,username,password_hash,role,created_at,contact_type,contact_value,verified_at,banned,ban_reason,permissions FROM users;
        DROP TABLE users; ALTER TABLE users_v2 RENAME TO users;`);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('账号迁移外键检查未通过');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { db.exec('PRAGMA foreign_keys=ON'); }
  }
  for (const sql of tables) db.exec(sql);
}
module.exports = { migrateSqliteAccounts, postgresAccountMigrations };
