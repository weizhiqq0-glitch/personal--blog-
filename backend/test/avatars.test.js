const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PGlite } = require('@electric-sql/pglite');
const { createPostgresDatabase } = require('../postgres');
const { createApp } = require('../app');
const { validateAvatar } = require('../avatars');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=';
const image = 'data:image/png;base64,' + png;

test('头像格式拒绝脚本、远程地址、损坏和过大的图片', () => {
  assert.ok(validateAvatar(image));
  for (const invalid of ['https://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,PHNjcmlwdD4=', image + 'AAAA', image.slice(0, -16), 'data:image/png;base64,' + 'A'.repeat(140000)]) assert.equal(validateAvatar(invalid), null);
  const huge = Buffer.from(png, 'base64'); huge.writeUInt32BE(10000, 16);
  assert.equal(validateAvatar('data:image/png;base64,' + huge.toString('base64')), null);
});
for (const engine of ['sqlite', 'postgres']) test(engine + '：头像只修改本人、公开图片不泄露资料、支持替换和删除', async () => {
  const pg = engine === 'postgres' ? new PGlite() : null;
  const database = pg ? createPostgresDatabase({ async query(sql, values) { const r = await pg.query(sql, values); return { ...r, rowCount: r.affectedRows }; }, async end() { await pg.close(); } }) : undefined;
  const app = createApp({ dbPath: ':memory:', ...(database ? { database } : {}), passwords: { async hashPassword() { return 'fixture'; }, async verifyPassword(p, h) { return p === 'Fixture123' && h === 'fixture'; } } });
  const db = app.locals.db; await db.ready;
  for (const [name, role, verified] of [['owner', 'owner', '2026-01-01'], ['normal', 'user', '2026-01-01'], ['unverified', 'user', null]]) await db.prepare('INSERT INTO users(username,password_hash,role,verified_at,contact_value) VALUES (?,?,?,?,?)').run(name, 'fixture', role, verified, name + '@private.test');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const call = (route, method = 'GET', token, body) => fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  async function login(username) { return (await (await call('/auth/login', 'POST', null, { username, password: 'Fixture123' })).json()).token; }
  try {
    const token = await login('normal'), unverified = await login('unverified');
    assert.equal((await call('/avatars/me', 'PUT', null, { image })).status, 401);
    assert.equal((await call('/avatars/me', 'PUT', unverified, { image })).status, 403);
    assert.equal((await call('/avatars/me', 'PUT', token, { image, userId: 1 })).status, 200);
    assert.equal((await call('/avatars/1')).status, 404);
    const response = await call('/avatars/2');
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(png, 'base64'));
    assert.equal((await call('/avatars/me', 'PUT', token, { image })).status, 200);
    assert.equal((await call('/avatars/1', 'DELETE', token)).status, 404);
    assert.equal((await call('/avatars/me', 'DELETE', token)).status, 200);
    assert.equal((await call('/avatars/2')).status, 404);
    const profile = await (await call('/site-profile')).json();
    assert.deepEqual(Object.keys(profile).sort(), ['id', 'username']);
    await db.prepare("INSERT INTO users(username,password_hash,role,verified_at,contact_value) VALUES (?,?,?,?,?)").run('admin', 'fixture', 'admin', '2026-01-01', 'admin@private.test');
    const directory = await (await call('/members')).json();
    assert.deepEqual(directory.members.map(member => member.role), ['owner', 'admin', 'user']);
    for (const member of directory.members) assert.deepEqual(Object.keys(member).sort(), ['id', 'role', 'username']);
    assert.equal(directory.hasMore, false);
    assert.equal((await call('/members?page=-1')).status, 400);
    await db.prepare('UPDATE users SET banned=1 WHERE id=2').run();
    assert.equal((await (await call('/members')).json()).members.some(member => member.id === 2), false);
    assert.equal((await call('/avatars/me', 'PUT', token, { image })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
});
