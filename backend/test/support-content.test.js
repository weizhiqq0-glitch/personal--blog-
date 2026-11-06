const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PGlite } = require('@electric-sql/pglite');
const { createPostgresDatabase } = require('../postgres');
const { createApp } = require('../app');

for (const engine of ['sqlite', 'postgres']) test(engine + '：后台反馈隔离、内容管理权限和前台发布闭环', async () => {
  const pg = engine === 'postgres' ? new PGlite() : null;
  const database = pg ? createPostgresDatabase({ async query(sql, values) { const r = await pg.query(sql, values); return { ...r, rowCount: r.affectedRows }; }, async end() { await pg.close(); } }) : undefined;
  const app = createApp({ dbPath: ':memory:', ...(database ? { database } : {}), authLimit: (req, res, next) => next(), passwords: { async hashPassword() { return 'fixture'; }, async verifyPassword(p, h) { return p === 'Fixture123' && h === 'fixture'; } } });
  const db = app.locals.db; await db.ready;
  for (const [name, role] of [['owner', 'owner'], ['admin', 'admin'], ['normal', 'user'], ['other', 'user']]) await db.prepare('INSERT INTO users(username,password_hash,role,verified_at) VALUES (?,?,?,?)').run(name, 'fixture', role, '2026-01-01');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function call(route, method = 'GET', token, body) {
    const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  async function login(username) { return (await call('/auth/login', 'POST', null, { username, password: 'Fixture123' })).data.token; }
  try {
    const owner = await login('owner'), admin = await login('admin'), normal = await login('normal'), other = await login('other');
    assert.equal((await call('/feedback')).status, 401);
    const created = await call('/feedback', 'POST', normal, { subject: '页面问题', content: '测试问题描述', user_id: 4, status: 'resolved' });
    assert.equal(created.status, 201); const key = created.data.key;
    assert.equal((await call('/feedback', 'GET', other)).data.length, 0);
    assert.equal((await call('/feedback', 'GET', normal)).data[0].status, 'open');
    assert.equal((await call('/management/feedback', 'GET', normal)).status, 403);
    assert.equal((await call('/management/feedback/' + key, 'PATCH', normal, { status: 'resolved', reply: '伪造' })).status, 403);
    assert.equal((await call('/management/feedback/' + key, 'PATCH', admin, { status: 'processing', reply: '已收到' })).status, 200);
    assert.equal((await call('/feedback', 'GET', normal)).data[0].reply, '已收到');
    for (let i = 0; i < 4; i++) assert.equal((await call('/feedback', 'POST', normal, { subject: '新问题', content: '描述' })).status, 201);
    assert.equal((await call('/feedback', 'POST', normal, { subject: '超出限制', content: '描述' })).status, 429);
    assert.equal((await call('/management/comments', 'GET', normal)).status, 403);
    assert.equal((await call('/management/comments', 'GET', admin)).status, 200);
    const content = { title: '测试项目', content: '描述', url: 'https://example.com/', image: '' };
    assert.equal((await call('/content/projects', 'POST', normal, content)).status, 403);
    assert.equal((await call('/content/projects', 'POST', null, content)).status, 401);
    for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com']) assert.equal((await call('/content/projects', 'POST', owner, { ...content, url })).status, 400);
    assert.equal((await call('/content/photos', 'POST', owner, content)).status, 400);
    assert.equal((await call('/content/music', 'POST', owner, { ...content, url: '' })).status, 400);
    const project = await call('/content/projects', 'POST', owner, content); assert.equal(project.status, 201);
    const items = (await call('/content/projects')).data; assert.equal(items.length, 1); assert.equal(items[0].title, '测试项目');
    assert.equal((await call('/content/photos/' + project.data.key, 'PATCH', owner, { ...content, image: 'https://example.com/a.png' })).status, 404);
    assert.equal((await call('/content/projects/' + project.data.key, 'PATCH', owner, { ...content, title: '已更新' })).status, 200);
    assert.equal((await call('/content/projects')).data[0].title, '已更新');
    await db.prepare('UPDATE users SET permissions=? WHERE username=?').run(JSON.stringify({ 'site.manage': false, 'feedback.manage': false }), 'admin');
    assert.equal((await call('/content/projects', 'POST', admin, content)).status, 403);
    assert.equal((await call('/management/feedback', 'GET', admin)).status, 403);
    assert.equal((await call('/content/projects/' + project.data.key, 'DELETE', owner)).status, 200);
    assert.equal((await call('/content/projects')).data.length, 0);
  } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
});
