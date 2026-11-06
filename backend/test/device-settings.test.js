const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../app');
const { hashPassword, tokenHash } = require('../security');
const { PGlite } = require('@electric-sql/pglite');
const { createPostgresDatabase } = require('../postgres');

for (const engine of ['sqlite', 'postgres']) {

async function fixture(options = {}) {
  const pg = engine === 'postgres' ? new PGlite() : null;
  const database = pg ? createPostgresDatabase({ async query(sql, values) { const r = await pg.query(sql, values); return { ...r, rowCount: r.affectedRows }; }, async end() { await pg.close(); } }) : undefined;
  const app = createApp({ dbPath: ':memory:', ...(database ? { database } : {}), ...options });
  const db = app.locals.db;
  await db.ready;
  for (const [name, role] of [['mowu', 'owner'], ['normal', 'user'], ['other', 'user']]) await db.prepare('INSERT INTO users(username,password_hash,role,verified_at) VALUES (?,?,?,?)').run(name, await hashPassword('Fixture123'), role, '2026-01-01');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { db, async close() { await new Promise(resolve => server.close(resolve)); await db.close(); }, async call(path, { token, device, body, method = body ? 'POST' : 'GET' } = {}) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(device ? { 'X-Owner-Device': device } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  } };
}
test(engine + '：报备由后端校验站主和唯一设备，普通账号、其他设备不能查看或替换', async () => {
  const f = await fixture({ localDeviceEnrollment: true });
  try {
    const owner = (await f.call('/auth/login', { body: { username: 'mowu', password: 'Fixture123' } })).body.token;
    const device = 'ab'.repeat(32);
    assert.equal((await f.call('/management/login-reports', { token: owner })).status, 403);
    assert.equal((await f.call('/management/trusted-device', { token: owner, device, body: { currentPassword: 'Wrong123' } })).status, 401);
    assert.equal((await f.call('/management/trusted-device', { token: owner, device, body: { currentPassword: 'Fixture123' } })).status, 200);
    const before = (await f.call('/management/login-reports', { token: owner, device })).body.length;
    await f.call('/auth/login', { device, body: { username: 'mowu', password: 'Fixture123' } });
    assert.equal((await f.call('/management/login-reports', { token: owner, device })).body.length, before);
    const foreign = (await f.call('/auth/login', { body: { username: 'mowu', password: 'Fixture123' } })).body.token;
    const reports = await f.call('/management/login-reports', { token: owner, device });
    assert.equal(reports.body.length, before + 1); assert.deepEqual(Object.keys(reports.body[0]).sort(), ['device', 'id', 'time']);
    assert.equal((await f.call('/management/login-reports', { token: foreign, device: 'cd'.repeat(32) })).status, 403);
    assert.equal((await f.call('/management/trusted-device', { token: foreign, device: 'cd'.repeat(32), body: { currentPassword: 'Fixture123' } })).status, 409);
    const normal = (await f.call('/auth/login', { body: { username: 'normal', password: 'Fixture123' } })).body.token;
    assert.equal((await f.call('/management/login-reports', { token: normal, device })).status, 403);
    assert.equal((await f.call('/management/login-reports', { device })).status, 401);
    assert.notEqual(f.db.prepare('SELECT device_hash FROM owner_trusted_device').get().device_hash, device);
    assert.equal((await f.call('/management/events', { token: foreign })).body.length, 0);
  } finally { await f.close(); }
});
test(engine + '：标准部署默认关闭本地绑定，已有站主密码也不能绑定', async () => {
  const f = await fixture();
  try {
    const token = (await f.call('/auth/login', { body: { username: 'mowu', password: 'Fixture123' } })).body.token;
    assert.equal((await f.call('/management/device-status', { token })).body.enrollmentAvailable, false);
    assert.equal((await f.call('/management/trusted-device', { token, device: 'ab'.repeat(32), body: { currentPassword: 'Fixture123' } })).status, 403);
  } finally { await f.close(); }
});
test(engine + '：用户设置校验当前密码、唯一用户名和密码长度，不能提权，保存撤销全部旧会话', async () => {
  const f = await fixture();
  try {
    const token = (await f.call('/auth/login', { body: { username: 'normal', password: 'Fixture123' } })).body.token;
    const token2 = (await f.call('/auth/login', { body: { username: 'normal', password: 'Fixture123' } })).body.token;
    const update = body => f.call('/auth/settings', { token, method: 'PATCH', body });
    assert.equal((await update({ username: 'normal2', currentPassword: 'bad' })).status, 401);
    assert.equal((await update({ username: 'other', currentPassword: 'Fixture123' })).status, 409);
    for (const value of ['12345', '1'.repeat(15)]) assert.equal((await update({ newPassword: value, currentPassword: 'Fixture123' })).status, 400);
    assert.equal((await update({ username: '新用户', currentPassword: 'Fixture123', newPassword: 'NewPass123', role: 'owner' })).status, 200);
    assert.equal((await f.call('/auth/me', { token })).status, 401);
    assert.equal((await f.call('/auth/me', { token: token2 })).status, 401);
    assert.equal((await f.call('/auth/login', { body: { username: 'normal', password: 'Fixture123' } })).status, 401);
    const login = await f.call('/auth/login', { body: { username: '新用户', password: 'NewPass123' } });
    assert.equal(login.status, 200); assert.equal(login.body.user.role, 'user');
  } finally { await f.close(); }
});
test(engine + '：线上首次绑定需要独立授权码，绑定后禁止替换', async () => {
  const f = await fixture({ ownerDeviceSetupHash: tokenHash('setup-fixture-only') });
  try {
    const token = (await f.call('/auth/login', { body: { username: 'mowu', password: 'Fixture123' } })).body.token;
    const body = { currentPassword: 'Fixture123' };
    const device = 'ef'.repeat(32);
    assert.equal((await f.call('/management/trusted-device', { token, device, body })).status, 403);
    assert.equal((await f.call('/management/trusted-device', { token, device, body: { ...body, setupCode: 'wrong' } })).status, 403);
    assert.equal((await f.call('/management/trusted-device', { token, device, body: { ...body, setupCode: 'setup-fixture-only' } })).status, 200);
    assert.equal((await f.call('/management/trusted-device', { token, device: 'ab'.repeat(32), body: { ...body, setupCode: 'setup-fixture-only' } })).status, 409);
  } finally { await f.close(); }
});
test(engine + '：站主改名保留ID和密码，迁移仅执行一次', async () => {
  const f = await fixture();
  try {
    const { migrateOwnerName } = require('../owner-name-migration');
    const owner = await f.db.prepare("SELECT * FROM users WHERE role='owner'").get();
    await f.db.prepare('UPDATE users SET username=? WHERE id=?').run('旧站主', owner.id);
    await assert.rejects(migrateOwnerName(f.db, 'normal'));
    await migrateOwnerName(f.db, 'mowu');
    const renamed = await f.db.prepare('SELECT * FROM users WHERE id=?').get(owner.id);
    assert.equal(renamed.username, 'mowu'); assert.equal(renamed.password_hash, owner.password_hash);
    await f.db.prepare('UPDATE users SET username=? WHERE id=?').run('以后自己改名', owner.id);
    await migrateOwnerName(f.db, 'mowu');
    assert.equal((await f.db.prepare('SELECT username FROM users WHERE id=?').get(owner.id)).username, '以后自己改名');
  } finally { await f.close(); }
});

}
