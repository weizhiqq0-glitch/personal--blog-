const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PGlite } = require('@electric-sql/pglite');
const { openDatabase } = require('../database');
const { createPostgresDatabase } = require('../postgres');
const { createMailBudget, cycle } = require('../mail-budget');
const { createApp } = require('../app');
const { tokenHash } = require('../security');

test('邮件周期沿平台重置日推进，跨短月后恢复原重置日', () => {
  const settings = { resetAt: Date.parse('2027-01-31T08:00:00Z'), remaining: 17, generation: 'x' };
  assert.equal(cycle(settings, Date.parse('2027-01-30')).allowance, 17);
  assert.equal(new Date(cycle(settings, Date.parse('2027-02-01')).resetAt).toISOString(), '2027-02-28T08:00:00.000Z');
  assert.equal(new Date(cycle(settings, Date.parse('2027-03-01')).resetAt).toISOString(), '2027-03-31T08:00:00.000Z');
  assert.equal(cycle(settings, Date.parse('2027-03-01')).allowance, 200);
});

for (const engine of ['sqlite', 'postgres']) {
  async function database() {
    if (engine === 'sqlite') return openDatabase(':memory:');
    const pg = new PGlite();
    const db = createPostgresDatabase({ async query(sql, values) { const r = await pg.query(sql, values); return { ...r, rowCount: r.affectedRows }; }, async end() { await pg.close(); } });
    await db.ready;
    return db;
  }
  test(engine + '：邮件预算持久化、多维防刷和并发保留站主额度', async () => {
    const db = await database();
    const high = { email: 100, browser: 100, account: 100, ipHour: 100, ipDay: 100, siteDay: 100 };
    try {
      const budget = createMailBudget(db, high);
      assert.equal((await budget.status()).calibrated, false);
      assert.equal((await budget.status()).remaining, 0);
      await assert.rejects(budget.reserve({ contact: 'test@example.com', browser: 'test', ip: 'test' }), { status: 429 });
      await budget.calibrate(23, new Date(Date.now() + 86400000).toISOString());
      const requests = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => budget.reserve({ contact: i + '@example.com', browser: 'browser' + i, ip: 'ip' + i })));
      assert.equal(requests.filter(r => r.status === 'fulfilled').length, 3);
      assert.equal((await budget.status()).remaining, 20);
      const restarted = createMailBudget(db, high);
      assert.equal((await restarted.status()).remaining, 20);
      const ownerKey = await restarted.reserve({ contact: 'owner@example.com', browser: 'owner', ip: 'owner', owner: true });
      await restarted.accepted(ownerKey);
      assert.equal((await restarted.status()).remaining, 19);
      assert.equal((await restarted.status()).accepted, 1);
      await assert.rejects(restarted.reserve({ contact: 'another@example.com', browser: 'new', ip: 'new' }), { status: 429 });

      // A failed delivery consumes the reservation conservatively; restart cannot restore it.
      assert.equal((await restarted.status()).attempts, 4);
      await db.prepare('DELETE FROM verification_limits').run();
      await restarted.calibrate(200, new Date(Date.now() + 86400000).toISOString());
      const limited = createMailBudget(db, { ...high, ipHour: 2 });
      await limited.reserve({ contact: 'one@example.com', browser: 'one', ip: 'same' });
      await limited.reserve({ contact: 'two@example.com', browser: 'two', ip: 'same' });
      await assert.rejects(limited.reserve({ contact: 'three@example.com', browser: 'three', ip: 'same' }), { status: 429 });
      assert.equal((await limited.status()).attempts, 2);
      await db.prepare('UPDATE verification_limits SET expires_at=0').run();
      await limited.reserve({ contact: 'four@example.com', browser: 'four', ip: 'same' });

      for (const dimension of ['email', 'browser', 'account', 'ipDay', 'siteDay']) {
        await db.prepare('DELETE FROM verification_limits').run();
        const guard = createMailBudget(db, { ...high, [dimension]: 1 });
        const first = { contact: 'a@example.com', browser: 'a', ip: 'a', account: 1 };
        const next = { contact: 'b@example.com', browser: 'b', ip: 'b', account: 2 };
        if (dimension === 'email') next.contact = first.contact;
        if (dimension === 'browser') next.browser = first.browser;
        if (dimension === 'account') next.account = first.account;
        if (dimension === 'ipDay') next.ip = first.ip;
        await guard.reserve(first);
        await assert.rejects(guard.reserve(next), { status: 429 });
      }
      await assert.rejects(budget.calibrate(-1, new Date(Date.now() + 100000).toISOString()), { status: 400 });
      await assert.rejects(budget.calibrate(10, 'invalid'), { status: 400 });
    } finally { await db.close(); }
  });

  test(engine + '：接口检查不产生访客，邮箱/设备/预算仅向站主披露，身份不可伪造', async () => {
    const db = await database();
    const app = createApp({ database: db, passwords: { async hashPassword() { return 'hash'; }, async verifyPassword(password, stored) { return password === 'Correct123' && stored === 'hash'; } } });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    async function call(path, { role, method = 'GET', body, visitor = 'a'.repeat(64), origin = 'http://localhost:5173' } = {}) {
      const result = await fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Visitor-Token': visitor, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', ...(role ? { Authorization: 'Bearer ' + role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: result.status, data: result.status === 204 ? null : await result.json() };
    }
    try {
      for (const role of ['owner', 'admin', 'user']) {
        const result = await db.prepare('INSERT INTO users(username,password_hash,role,contact_type,contact_value,verified_at) VALUES (?,?,?,?,?,?)').run(role, 'hash', role, 'email', role + '@example.com', '2026-01-01');
        await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(role), Number(result.lastInsertRowid), Date.now() + 60000);
      }
      for (let i = 0; i < 4; i++) await call('/articles', { visitor: String(i).repeat(64) });
      await call('/health'); await call('/auth/options');
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM visitors').get()).n, 0);
      assert.equal((await call('/visits', { method: 'POST', body: { engaged: true }, origin: 'https://evil.example' })).status, 400);
      assert.equal((await call('/visits', { method: 'POST', body: { engaged: true } })).status, 204);
      assert.equal((await call('/management/visitors', { role: 'owner' })).data.length, 1);
      assert.equal((await call('/management/email-budget')).status, 401);
      assert.equal((await call('/management/email-budget', { role: 'admin' })).status, 403);
      assert.equal((await call('/management/email-budget', { role: 'user' })).status, 403);
      assert.equal((await call('/management/email-budget', { role: 'owner' })).status, 200);
      assert.equal((await call('/management/email-budget', { role: 'admin', method: 'PATCH', body: { remaining: 200, resetAt: new Date(Date.now() + 1000000).toISOString() } })).status, 403);
      const login = await call('/auth/login', { method: 'POST', body: { username: 'user', password: 'Correct123', role: 'owner' } });
      assert.equal(login.data.user.role, 'user');
      assert.equal((await call('/auth/login', { method: 'POST', body: { username: 'user', password: 'Wrong123' } })).status, 401);
      const ownersView = (await call('/management/users', { role: 'owner' })).data.users;
      const adminsView = (await call('/management/users', { role: 'admin' })).data.users;
      const row = ownersView.find(user => user.username === 'user');
      assert.equal(row.contact, 'user@example.com');
      assert.equal(row.lastLogin.device, 'Windows · Chrome');
      assert.ok(Date.now() - row.lastLogin.time < 60000);
      assert.equal('location' in row.lastLogin, false);
      assert.equal(adminsView.find(user => user.username === 'user').contact, 'u***@example.com');
      assert.equal('lastLogin' in adminsView[0], false);
      assert.equal(JSON.stringify(ownersView).includes('password_hash'), false);
      assert.equal((await call('/management/users', { role: 'user' })).status, 403);
      const article = await call('/articles', { role: 'owner', method: 'POST', body: { title: 'test', content: 'test' } });
      const forged = await call('/articles/' + article.data.id + '/comments', { role: 'user', method: 'POST', body: { content: 'test', user_id: 1, username: 'owner', role: 'owner' } });
      assert.equal(forged.status, 201);
      const comments = (await call('/articles/' + article.data.id + '/comments')).data;
      assert.equal(comments[0].username, 'user');
      assert.equal(comments[0].role, 'user');
    } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
  });
}
