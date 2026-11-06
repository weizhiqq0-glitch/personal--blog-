const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { Miniflare, Response, convertV4MiniflareOptions } = require('miniflare');
const { createPostgresDatabase } = require('../postgres');
const { createOnlinePasswords } = require('../online-security');

test('Workers 运行时、真实 PostgreSQL 密码哈希、权限、重启和频率限制', {
  skip: !process.env.WORKER_TEST_DATABASE_URL && '需要隔离的 WORKER_TEST_DATABASE_URL，CI 会提供测试数据库',
}, async t => {
  const schema = 'worker_test_' + randomBytes(6).toString('hex');
  const control = new Pool({ connectionString: process.env.WORKER_TEST_DATABASE_URL });
  await control.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await control.query('CREATE SCHEMA ' + schema);
  const pool = new Pool({ connectionString: process.env.WORKER_TEST_DATABASE_URL, options: '-c search_path=' + schema + ',public' });
  const db = createPostgresDatabase(pool);
  let mf;
  const messages = new Map();
  let registration = 0;
  async function makeWorker(databaseConfigured = true) {
    const options = convertV4MiniflareOptions({
      modules: true,
      scriptPath: path.join(__dirname, '../.wrangler/build/worker.js'),
      compatibilityDate: '2026-11-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        CORS_ORIGINS: 'https://weizhiqq0-glitch.github.io', EMAIL_PROVIDER: 'brevo', EMAIL_FROM: 'test-sender@example.com', BREVO_API_KEY: 'isolated-test-only',
        ...(databaseConfigured ? { DATABASE_URL: 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require' } : {}),
      },
      // Route the actual Neon HTTP protocol to isolated real PostgreSQL.
      // No test reaches the user's Neon database or public Cloudflare account.
      outboundService: async request => {
        if (new URL(request.url).hostname === 'api.brevo.com') {
          const body = await request.json();
          messages.set(body.to[0].email, body.textContent.match(/\d{6}/)[0]);
          return Response.json({ messageId: 'isolated-test-only' });
        }
        assert.ok(['ep-test.neon.tech', 'api.neon.tech'].includes(new URL(request.url).hostname));
        const { query, params } = await request.json();
        try {
          const result = await pool.query(query, params);
          return Response.json({ command: result.command, rowCount: result.rowCount,
            fields: result.fields.map(field => ({ name: field.name, dataTypeID: field.dataTypeID })),
            rows: result.rows.map(row => result.fields.map(field => row[field.name] == null ? null : String(row[field.name]))),
          });
        } catch (error) {
          return Response.json({ message: error.message, code: error.code }, { status: 400 });
        }
      },
    });
    options.workers[0].dev = { ...options.workers[0].dev, stripCfConnectingIp: false };
    return new Miniflare(options);
  }
  async function call(url, method = 'GET', body, token, ip = '192.0.2.1') {
    if (url === '/auth/register' && body) {
      const contact = 'worker-fixture' + ++registration + '@example.com';
      const proof = await call('/auth/verification-code', 'POST', { contact, purpose: 'register' });
      body = { ...body, contact, code: messages.get(contact), verificationId: proof.data.verificationId };
    }
    const response = await mf.dispatchFetch('https://blog-test.example/api' + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip,
        Origin: 'https://weizhiqq0-glitch.github.io', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: response.status === 204 ? null : await response.json(), headers: response.headers };
  }
  let admin, alice, bob, articleId;
  try {
    await db.ready;
    const passwords = createOnlinePasswords(db);
    await t.test('pgcrypto 真实哈希、长密码不会在72字节处被截断', async () => {
      const password = '长'.repeat(35) + '-Password-A';
      const hash = await passwords.hashPassword(password);
      assert.match(hash, /^bcrypt-sha256:\$2a\$12\$/);
      assert.equal(await passwords.verifyPassword(password, hash), true);
      assert.equal(await passwords.verifyPassword('长'.repeat(35) + '-Password-B', hash), false);
      assert.equal(await passwords.verifyPassword(password, 'malformed'), false);
    });
    await t.test('缺少数据库私密配置时明确拒绝服务', async () => {
      mf = await makeWorker(false);
      assert.equal((await call('/health')).status, 503);
      await mf.dispose(); mf = await makeWorker();
      assert.equal((await call('/health')).status, 200);
    });
    await t.test('Workers 注册与登录、角色不能伪造、用户名不区分大小写', async () => {
      let result = await call('/auth/register', 'POST', { username: 'alice', password: 'Alice123', role: 'admin' });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      assert.equal(result.data.user.role, 'user'); alice = result.data.token;
      assert.equal((await call('/auth/register', 'POST', { username: 'ALICE', password: 'Other123' })).status, 409);
      assert.equal((await call('/auth/login', 'POST', { username: 'ALICE', password: 'Alice123' })).status, 200);
      assert.equal((await call('/auth/login', 'POST', { username: 'unknown', password: 'Wrong123' })).status, 401);
      bob = (await call('/auth/register', 'POST', { username: 'bob', password: 'Bob123' })).data.token;
      await db.prepare("INSERT INTO users(username,password_hash,role,verified_at) VALUES (?,?,'admin','2026-11-01T00:00:00Z')").run('owner', await passwords.hashPassword('Owner123'));
      admin = (await call('/auth/login', 'POST', { username: 'owner', password: 'Owner123' })).data.token;
      assert.equal((await call('/auth/me', 'GET', undefined, admin)).data.role, 'admin');
    });
    await t.test('Workers 文章增删改与管理员权限', async () => {
      const body = { title: 'Cloudflare 文章', content: '由真实接口保存的正文', tags: ['测试'] };
      assert.equal((await call('/articles', 'POST', body)).status, 401);
      assert.equal((await call('/articles', 'POST', body, alice)).status, 403);
      const result = await call('/articles', 'POST', body, admin);
      assert.equal(result.status, 201); articleId = result.data.id;
      assert.equal((await call('/articles/' + articleId, 'PUT', body, alice)).status, 403);
      assert.equal((await call('/articles/' + articleId, 'PUT', { ...body, title: '修改成功' }, admin)).data.title, '修改成功');
      assert.equal((await call('/articles')).data[0].comment_count, 0);
      assert.deepEqual((await call('/articles/' + articleId)).data.tags, ['测试']);
      assert.equal((await call('/articles/bad-id')).status, 404);
    });
    await t.test('Workers 评论权限、跨域、会话与数据库重启保留', async () => {
      const commentPath = '/articles/' + articleId + '/comments';
      assert.equal((await call(commentPath, 'POST', { content: '评论' })).status, 401);
      const comment = await call(commentPath, 'POST', { content: '评论' }, alice);
      assert.equal(comment.status, 201);
      assert.equal((await call('/comments/' + comment.data.id, 'DELETE', undefined, bob)).status, 403);
      assert.equal((await call('/stats')).headers.get('access-control-allow-origin'), 'https://weizhiqq0-glitch.github.io');
      await mf.dispose(); mf = await makeWorker();
      assert.equal((await call('/auth/me', 'GET', undefined, alice)).data.username, 'alice');
      assert.equal((await call(commentPath)).data[0].content, '评论');
      assert.equal((await call('/articles/' + articleId, 'DELETE', undefined, admin)).status, 204);
      assert.equal((await call('/stats')).data.comments, 0);
      assert.equal((await call('/auth/logout', 'POST', undefined, alice)).status, 204);
      assert.equal((await call('/auth/me', 'GET', undefined, alice)).status, 401);
    });
    await t.test('跨 Worker 实例的登录频率限制，以及不同访问者互不影响', async () => {
      for (let i = 0; i < 30; i++) assert.equal((await call('/auth/login', 'POST', {}, undefined, '192.0.2.100')).status, 401);
      await mf.dispose(); mf = await makeWorker();
      assert.equal((await call('/auth/login', 'POST', {}, undefined, '192.0.2.100')).status, 429);
      assert.equal((await call('/auth/login', 'POST', {}, undefined, '192.0.2.101')).status, 401);
    });
  } finally {
    await mf?.dispose();
    await db.close();
    await control.query('DROP SCHEMA ' + schema + ' CASCADE');
    await control.end();
  }
});
