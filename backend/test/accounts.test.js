const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PGlite } = require('@electric-sql/pglite');
const { openDatabase } = require('../database');
const { createPostgresDatabase } = require('../postgres');
const { createApp } = require('../app');
const security = require('../security');
const { provisionOwner } = require('../owner');

test('迁移已有 SQLite 时保留账号、文章、评论、会话与外键', async () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'blog-account-migrate-'));
  const file = path.join(folder, 'old.sqlite');
  let db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),created_at TEXT NOT NULL DEFAULT '2026-01-01');
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE articles(id INTEGER PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '[]',author_id INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT '2026-01-01',updated_at TEXT NOT NULL DEFAULT '2026-01-01');
    CREATE TABLE comments(id INTEGER PRIMARY KEY,article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id),content TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT '2026-01-01');
    INSERT INTO users VALUES(7,'old','kept-hash','admin','2026-01-01');
    INSERT INTO sessions VALUES('kept-token',7,9999999999999);
    INSERT INTO articles(id,title,content,author_id) VALUES(8,'kept-title','kept-content',7);
    INSERT INTO comments(id,article_id,user_id,content) VALUES(9,8,7,'kept-comment');`);
  db.close();
  try {
    db = openDatabase(file);
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=7').get().password_hash, 'kept-hash');
    assert.equal(db.prepare('SELECT content FROM articles WHERE id=8').get().content, 'kept-content');
    assert.equal(db.prepare('SELECT content FROM comments WHERE id=9').get().content, 'kept-comment');
    assert.equal(db.prepare('SELECT user_id FROM sessions').get().user_id, 7);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.prepare("UPDATE users SET role='owner' WHERE id=7").run();
    assert.throws(() => db.prepare("INSERT INTO users(username,password_hash,role) VALUES ('second','hash','owner')").run());
    db.close(); db = openDatabase(file);
    assert.equal(db.prepare('SELECT role FROM users WHERE id=7').get().role, 'owner');
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

for (const engine of ['sqlite', 'postgres']) {
test(engine + '：验证码、站主边界、授权与封禁', async t => {
  const pg = engine === 'postgres' ? new PGlite() : null;
  const db = pg ? createPostgresDatabase({ async query(sql, values) { const r = await pg.query(sql, values); return { ...r, rowCount: r.affectedRows }; }, async end() { await pg.close(); } }) : openDatabase(':memory:');
  await db.ready;
  await require('../mail-budget').createMailBudget(db).calibrate(200, new Date(Date.now() + 86400000).toISOString());
  const sent = new Map();
  const emailSender = { available: true, async send({ to, code }) { sent.set(to, code); } };
  const app = createApp({ database: db, emailSender, mailPolicy: { ipHour: 100, ipDay: 100, siteDay: 100, browser: 100, account: 100 }, authLimit(req, res, next) { next(); } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function call(url, method = 'GET', body, token, visitor) {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(visitor ? { 'X-Visitor-Token': visitor } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  }
  async function proof(contact, purpose = 'register', token) {
    const result = await call('/auth/verification-code', 'POST', { contact, purpose }, token);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(Object.hasOwn(result.data, 'code'), false);
    return { contact, code: sent.get(contact), verificationId: result.data.verificationId };
  }
  async function register(username, password = 'User123') {
    const contact = username.toLowerCase() + '@example.com';
    const result = await call('/auth/register', 'POST', { username, password, ...await proof(contact), role: 'owner' });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data;
  }
  let owner, alice, manager, peer;
  try {
    await t.test('站主唯一，预创建后必须验证预留邮箱，不能通过网页提权', async () => {
      assert.deepEqual(await provisionOwner(db, { username: 'siteowner', password: 'Owner123', email: 'owner@example.com', passwords: security }), { pending: true });
      await assert.rejects(provisionOwner(db, { username: 'secondowner', password: 'Owner123', email: 'second@example.com', passwords: security }));
      owner = (await call('/auth/login', 'POST', { username: 'siteowner', password: 'Owner123' })).data;
      assert.equal(owner.user.needsContactVerification, true);
      assert.equal((await call('/management/users', 'GET', undefined, owner.token)).status, 403);
      assert.equal((await call('/auth/verification-code', 'POST', { contact: 'wrong@example.com', purpose: 'bind' }, owner.token)).status, 400);
      const ownerProof = await proof('owner@example.com', 'bind', owner.token);
      assert.equal((await call('/auth/register', 'POST', { username: 'forgedowner', password: 'Owner123', ...ownerProof })).status, 400);
      const result = await call('/auth/contact', 'POST', ownerProof, owner.token);
      assert.equal(result.status, 200); assert.equal(result.data.role, 'owner'); assert.equal(result.data.needsContactVerification, false);
      assert.equal((await call('/management/users', 'GET', undefined, owner.token)).status, 200);
      assert.equal(JSON.stringify((await call('/auth/me', 'GET', undefined, owner.token)).data).includes('password_hash'), false);
    });
    await t.test('6位和14位密码可用，5位和15位被拒绝，邮箱验证码不可省略', async () => {
      assert.equal((await call('/auth/register', 'POST', { username: 'plain', password: 'User123' })).status, 400);
      const credentials = await proof('boundary@example.com');
      for (const password of ['12345', '123456789012345']) assert.equal((await call('/auth/register', 'POST', { username: 'boundary', password, ...credentials })).status, 400);
      alice = (await call('/auth/register', 'POST', { username: 'alice', password: '123456', role: 'owner', ...credentials })).data;
      assert.equal(alice.user.role, 'user'); assert.equal(alice.user.contact.verified, true);
      assert.equal((await register('longpass', '12345678901234')).user.role, 'user');
      assert.equal((await call('/auth/register', 'POST', { username: 'replay', password: 'User123', ...credentials })).status, 400);
      assert.equal((await call('/auth/verification-code', 'POST', { contactType: 'phone', contact: '+8613800000000', purpose: 'register' })).status, 400);
    });
    await t.test('验证码不能跨邮箱、用途或重复使用，错误5次锁定，有效期和重发间隔生效', async () => {
      const credentials = await proof('limits@example.com');
      const record = await db.prepare('SELECT * FROM verification_challenges WHERE request_hash=?').get(security.tokenHash(credentials.verificationId));
      assert.notEqual(record.code_hash, credentials.code); assert.notEqual(record.request_hash, credentials.verificationId);
      assert.equal((await call('/auth/verification-code', 'POST', { contact: credentials.contact, purpose: 'register' })).status, 429);
      for (let i = 0; i < 5; i++) assert.equal((await call('/auth/register', 'POST', { username: 'limits', password: 'User123', ...credentials, code: credentials.code === '000000' ? '111111' : '000000' })).status, 400);
      assert.equal((await call('/auth/register', 'POST', { username: 'limits', password: 'User123', ...credentials })).status, 400);
      const expired = await proof('expired@example.com');
      await db.prepare('UPDATE verification_challenges SET expires_at=0 WHERE request_hash=?').run(security.tokenHash(expired.verificationId));
      assert.equal((await call('/auth/register', 'POST', { username: 'expired', password: 'User123', ...expired })).status, 400);
      const wrongContact = await proof('first@example.com');
      assert.equal((await call('/auth/register', 'POST', { username: 'wrong', password: 'User123', ...wrongContact, contact: 'second@example.com' })).status, 400);
      const results = await Promise.all([1, 2].map(i => call('/auth/register', 'POST', { username: 'race' + i, password: 'User123', ...wrongContact })));
      assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
    });
    await t.test('站主授权、限制即时生效；管理员不能修改角色、提权或封禁管理员和站主', async () => {
      manager = await register('manager'); peer = await register('peer');
      for (const account of [manager, peer]) assert.equal((await call('/management/users/' + account.user.id, 'PATCH', { role: 'admin' }, owner.token)).status, 200);
      assert.equal((await call('/management/users/' + alice.user.id, 'PATCH', { role: 'admin' }, manager.token)).status, 403);
      assert.equal((await call('/management/users/' + alice.user.id, 'PATCH', { role: 'owner' }, owner.token)).status, 400);
      for (const account of [owner, peer, manager]) assert.equal((await call('/management/users/' + account.user.id + '/ban', 'POST', { banned: true }, manager.token)).status, 403);
      const article = { title: '权限测试', content: '保存正文', tags: [] };
      assert.equal((await call('/articles', 'POST', article, alice.token)).status, 403);
      assert.equal((await call('/management/users/' + alice.user.id, 'PATCH', { permissions: { 'article.manage': true } }, owner.token)).status, 200);
      assert.equal((await call('/articles', 'POST', article, alice.token)).status, 403);
      assert.equal((await call('/management/users/' + manager.user.id, 'PATCH', { permissions: { 'article.manage': false } }, owner.token)).status, 200);
      assert.equal((await call('/articles', 'POST', article, manager.token)).status, 403);
      assert.equal((await call('/management/users/' + owner.user.id, 'PATCH', { role: 'user' }, owner.token)).status, 403);
    });
    await t.test('用户封禁撤销会话；站主可以封禁管理员；访客封禁可解除', async () => {
      assert.equal((await call('/management/users/' + alice.user.id + '/ban', 'POST', { banned: true }, manager.token)).status, 200);
      assert.equal((await call('/auth/me', 'GET', undefined, alice.token)).status, 401);
      assert.equal((await call('/auth/login', 'POST', { username: 'alice', password: '123456' })).status, 403);
      assert.equal((await call('/management/users/' + manager.user.id + '/ban', 'POST', { banned: true }, owner.token)).status, 200);
      assert.equal((await call('/auth/login', 'POST', { username: 'manager', password: 'User123' })).status, 403);
      await call('/management/users/' + manager.user.id + '/ban', 'POST', { banned: false }, owner.token);
      manager = (await call('/auth/login', 'POST', { username: 'manager', password: 'User123' })).data;
      const visitor = 'a'.repeat(64); const key = security.tokenHash(visitor);
      assert.equal((await call('/articles', 'GET', undefined, undefined, visitor)).status, 200);
      assert.equal((await call('/visits', 'POST', { engaged: true }, undefined, visitor)).status, 204);
      assert.equal((await call('/management/visitors/' + key + '/ban', 'POST', { banned: true }, manager.token)).status, 200);
      assert.equal((await call('/articles', 'GET', undefined, undefined, visitor)).status, 403);
      assert.equal((await call('/management/visitors/' + key + '/ban', 'POST', { banned: false }, owner.token)).status, 200);
      assert.equal((await call('/articles', 'GET', undefined, undefined, visitor)).status, 200);
    });
    await t.test('邮箱找回密码撤销旧会话，旧账号补绑前不能发表评论', async () => {
      await db.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'user')").run('legacy', await security.hashPassword('Legacy123'));
      const legacy = (await call('/auth/login', 'POST', { username: 'legacy', password: 'Legacy123' })).data;
      assert.equal(legacy.user.needsContactVerification, true);
      assert.equal((await call('/articles/1/comments', 'POST', { content: 'nope' }, legacy.token)).status, 403);
      const contact = 'manager@example.com';
      await db.prepare('DELETE FROM verification_delivery').run();
      const credentials = await proof(contact, 'reset-password');
      assert.equal((await call('/auth/password/reset', 'POST', { ...credentials, password: 'New123' })).status, 200);
      assert.equal((await call('/auth/me', 'GET', undefined, manager.token)).status, 401);
      assert.equal((await call('/auth/login', 'POST', { username: 'manager', password: 'User123' })).status, 401);
      assert.equal((await call('/auth/login', 'POST', { username: 'manager', password: 'New123' })).status, 200);
      assert.equal((await call('/auth/password/reset', 'POST', { ...credentials, password: 'Other123' })).status, 400);
    });
  } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
});
}

test('未配置发信服务时拒绝发送和未验证注册，不泄露或伪造验证码', async () => {
  const app = createApp({ dbPath: ':memory:', emailConfig: {} });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/auth';
  try {
    const options = await (await fetch(base + '/options')).json();
    assert.equal(options.emailVerification, false);
    const result = await fetch(base + '/verification-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: 'not-sent@example.com', purpose: 'register' }) });
    assert.equal(result.status, 503);
    assert.equal(Object.hasOwn(await result.json(), 'code'), false);
    assert.equal(app.locals.db.prepare('SELECT COUNT(*) AS n FROM verification_challenges').get().n, 0);
  } finally { await new Promise(resolve => server.close(resolve)); app.locals.db.close(); }
});
