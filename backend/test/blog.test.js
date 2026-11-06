const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../app');
const { hashPassword } = require('../database');
const { PGlite } = require('@electric-sql/pglite');
const { createPostgresDatabase } = require('../postgres');

for (const engine of ['sqlite', 'postgres']) {
test(engine + '：账号、文章、评论、后端权限和数据库持久化', async t => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'blog-test-'));
  const dbPath = path.join(folder, 'test.sqlite');
  async function makeApp() {
    if (engine === 'sqlite') return createApp({ dbPath });
    // Execute real PostgreSQL SQL in an isolated WASM engine, not query mocks.
    const pg = new PGlite(path.join(folder, 'pg'));
    const db = createPostgresDatabase({
      async query(sql, values) { const result = await pg.query(sql, values); return { ...result, rowCount: result.affectedRows }; },
      async end() { await pg.close(); },
    });
    await db.ready;
    return createApp({ database: db });
  }
  let app = await makeApp();
  let server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let base = 'http://127.0.0.1:' + server.address().port + '/api';
  const call = async (url, method = 'GET', body, token) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  };
  let alice, bob, admin, articleId, commentId;
  try {
    await t.test('注册、重复账号、密码哈希与角色不能伪造', async () => {
      assert.equal((await call('/auth/register', 'POST', { username: 'tiny', password: 'x' })).status, 400);
      const result = await call('/auth/register', 'POST', { username: 'alice', password: 'Alice-Password-123', role: 'admin' });
      assert.equal(result.status, 201); assert.equal(result.data.user.role, 'user'); alice = result.data.token;
      assert.equal((await call('/auth/register', 'POST', { username: 'ALICE', password: 'Other-Password-123' })).status, 409);
      const saved = await app.locals.db.prepare('SELECT password_hash FROM users WHERE username=?').get('alice');
      assert.notEqual(saved.password_hash, 'Alice-Password-123');
      bob = (await call('/auth/register', 'POST', { username: 'bob', password: 'Bob-Password-123' })).data.token;
      await app.locals.db.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'admin')").run('owner', await hashPassword('Admin-Password-123'));
    });
    await t.test('登录与过期会话校验', async () => {
      assert.equal((await call('/auth/login', 'POST', { username: 'alice', password: 'Wrong-Password-123' })).status, 401);
      assert.equal((await call('/auth/login', 'POST', { username: 'ALICE', password: 'Alice-Password-123' })).status, 200);
      assert.equal((await call('/auth/login', 'POST', { username: "' OR 1=1 --", password: 'Wrong-Password-123' })).status, 401);
      admin = (await call('/auth/login', 'POST', { username: 'owner', password: 'Admin-Password-123' })).data.token;
      assert.equal((await call('/auth/me', 'GET', undefined, admin)).data.role, 'admin');
      assert.equal((await call('/auth/me', 'GET', undefined, 'forged')).status, 401);
    });
    await t.test('访客与用户不能发布、编辑、删除文章', async () => {
      const body = { title: '第一篇文章', content: '真实正文\n<script>example</script>', tags: ['学习'] };
      assert.equal((await call('/articles', 'POST', body)).status, 401);
      assert.equal((await call('/articles', 'POST', body, alice)).status, 403);
      assert.equal((await call('/articles', 'POST', { ...body, title: ' ' }, admin)).status, 400);
      const result = await call('/articles', 'POST', body, admin);
      assert.equal(result.status, 201); articleId = result.data.id;
      assert.equal((await call('/articles/' + articleId, 'PUT', body, alice)).status, 403);
      assert.equal((await call('/articles/' + articleId, 'DELETE', undefined, alice)).status, 403);
      assert.equal((await call('/articles/' + articleId)).data.content, body.content);
      assert.deepEqual((await call('/articles/' + articleId)).data.tags, ['学习']);
      assert.match((await call('/articles/' + articleId)).data.created_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal((await call('/articles/not-a-number')).status, 404);
      assert.equal((await call('/articles/' + articleId, 'PUT', { ...body, title: '已修改' }, admin)).data.title, '已修改');
    });
    await t.test('评论鉴权、内容校验、本人删除和管理员删除', async () => {
      const url = '/articles/' + articleId + '/comments';
      assert.equal((await call(url, 'POST', { content: 'hi' })).status, 401);
      assert.equal((await call(url, 'POST', { content: ' ' }, alice)).status, 400);
      commentId = (await call(url, 'POST', { content: '第一条评论' }, alice)).data.id;
      assert.equal((await call('/comments/' + commentId, 'DELETE', undefined, bob)).status, 403);
      assert.equal((await call('/comments/' + commentId, 'DELETE', undefined, alice)).status, 204);
      commentId = (await call(url, 'POST', { content: '第二条评论' }, bob)).data.id;
      assert.equal((await call('/comments/' + commentId, 'DELETE', undefined, admin)).status, 204);
      await call(url, 'POST', { content: '重启后保留' }, alice);
      assert.equal((await call('/stats')).data.comments, 1);
    });
    await t.test('重启后账号、会话、文章、评论仍保留', async () => {
      await new Promise(resolve => server.close(resolve)); await app.locals.db.close();
      app = await makeApp(); server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      base = 'http://127.0.0.1:' + server.address().port + '/api';
      assert.equal((await call('/auth/me', 'GET', undefined, alice)).data.username, 'alice');
      assert.equal((await call('/articles')).data.length, 1);
      assert.equal((await call('/articles/' + articleId + '/comments')).data[0].content, '重启后保留');
    });
    await t.test('跨域白名单、会话注销、文章级联删除、未知接口', async () => {
      const denied = await fetch(base + '/stats', { headers: { Origin: 'https://untrusted.example' } });
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      const allowed = await fetch(base + '/stats', { headers: { Origin: 'http://localhost:5173' } });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      assert.equal((await call('/auth/logout', 'POST', undefined, alice)).status, 204);
      assert.equal((await call('/auth/me', 'GET', undefined, alice)).status, 401);
      assert.equal((await call('/articles/' + articleId, 'DELETE', undefined, admin)).status, 204);
      assert.equal((await call('/stats')).data.comments, 0);
      assert.equal((await call('/articles/' + articleId)).status, 404);
      assert.equal((await call('/missing')).status, 404);
      await app.locals.db.prepare('UPDATE sessions SET expires_at=0').run();
      assert.equal((await call('/auth/me', 'GET', undefined, admin)).status, 401);
    });
  } finally {
    await new Promise(resolve => server.close(resolve)); await app.locals.db.close(); rmSync(folder, { recursive: true, force: true });
  }
});
}
