const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../app');
const { tokenHash } = require('../security');

test('站主入口须同时验证口令和站主密码，普通用户不能借入口提权', async () => {
  const app = createApp({ dbPath: ':memory:', ownerEntryHash: tokenHash('isolated-entry-fixture'),
    passwords: { async hashPassword() { return 'fixture'; }, async verifyPassword(password, stored) { return password === 'Fixture123' && stored === 'fixture'; } } });
  const db = app.locals.db;
  await db.prepare("INSERT INTO users(username,password_hash,role,verified_at) VALUES ('siteowner','fixture','owner','2026-01-01')").run();
  await db.prepare("INSERT INTO users(username,password_hash,role,verified_at) VALUES ('normal','fixture','user','2026-01-01')").run();
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  async function call(route, body) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.equal((await call('owner-entry', { entryCode: 'wrong' })).status, 401);
    const entry = await call('owner-entry', { entryCode: 'isolated-entry-fixture' });
    assert.equal(entry.status, 200); assert.equal(entry.body.token, undefined);
    assert.equal((await call('login', { username: 'siteowner', password: 'Fixture123' })).status, 403);
    assert.equal((await call('login', { username: 'normal', password: 'Fixture123' })).status, 200);
    assert.equal((await call('owner-login', { username: 'siteowner', password: 'Fixture123' })).status, 401);
    assert.equal((await call('owner-login', { entryCode: 'isolated-entry-fixture', username: 'normal', password: 'Fixture123' })).status, 401);
    assert.equal((await call('owner-login', { entryCode: 'isolated-entry-fixture', username: 'siteowner', password: 'Wrong123' })).status, 401);
    const owner = await call('owner-login', { entryCode: 'isolated-entry-fixture', username: 'siteowner', password: 'Fixture123' });
    assert.equal(owner.status, 200); assert.equal(owner.body.user.role, 'owner'); assert.ok(owner.body.token);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
