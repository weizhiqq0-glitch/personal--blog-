const express = require('express');
const cors = require('cors');
const { randomBytes } = require('node:crypto');
const { openDatabase, hashPassword, verifyPassword, tokenHash, validateCredentials } = require('./database');

function createApp(options = {}) {
  const db = openDatabase(options.dbPath);
  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  const origins = (options.origins || process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
  app.use(cors({ origin(origin, done) { done(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    if (token) req.user = db.prepare('SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token), Date.now());
    next();
  });
  const fail = (res, code, error) => res.status(code).json({ error });
  function loginRequired(req, res, next) { if (!req.user) return fail(res, 401, '请先登录，或重新登录'); next(); }
  function adminRequired(req, res, next) { if (!req.user) return fail(res, 401, '请先登录'); if (req.user.role !== 'admin') return fail(res, 403, '只有管理员可以操作'); next(); }
  const attempts = new Map();
  function authLimit(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const bucket = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    bucket.count++; attempts.set(key, bucket);
    if (bucket.count > 30) return fail(res, 429, '登录或注册过于频繁，请15分钟后重试');
    next();
  }
  function issueSession(user) {
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token), user.id, Date.now() + 7 * 86400_000);
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }
  app.get('/api/health', (req, res) => res.json({ ok: true, version: 2, message: '博客后端运行正常' }));
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { username, password } = req.body || {};
    if (!validateCredentials(username, password)) return fail(res, 400, '用户名须为2—32位汉字、字母、数字、下划线或短横线；密码须为10—128位');
    const passwordHash = await hashPassword(password);
    try {
      const result = db.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'user')").run(username, passwordHash);
      res.status(201).json(issueSession({ id: Number(result.lastInsertRowid), username, role: 'user' }));
    } catch (error) {
      if (error.message.includes('UNIQUE')) return fail(res, 409, '用户名已被使用');
      throw error;
    }
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const { username, password } = req.body || {};
    if (!validateCredentials(username, password)) return fail(res, 401, '用户名或密码错误');
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    // 未知用户名也执行同样的密码派生，减少通过响应时间探测账号。
    const matches = await verifyPassword(password, user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
    if (!user || !matches) return fail(res, 401, '用户名或密码错误');
    res.json(issueSession(user));
  });
  app.get('/api/auth/me', loginRequired, (req, res) => res.json(req.user));
  app.post('/api/auth/logout', loginRequired, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(req.get('authorization').slice(7)));
    res.status(204).end();
  });
  app.get('/api/stats', (req, res) => res.json({ articles: db.prepare('SELECT COUNT(*) AS n FROM articles').get().n, comments: db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n }));
  const articleSelect = 'SELECT a.*,u.username AS author,(SELECT COUNT(*) FROM comments c WHERE c.article_id=a.id) AS comment_count FROM articles a JOIN users u ON u.id=a.author_id';
  const serialize = article => ({ ...article, tags: JSON.parse(article.tags) });
  const getArticle = id => db.prepare(articleSelect + ' WHERE a.id=?').get(id);
  app.get('/api/articles', (req, res) => {
    const articles = db.prepare(articleSelect + ' ORDER BY a.id DESC').all().map(serialize).map(({ content, ...article }) => ({ ...article, summary: content.slice(0, 140) }));
    res.json(articles);
  });
  app.get('/api/articles/:id', (req, res) => {
    const article = getArticle(req.params.id);
    if (!article) return fail(res, 404, '文章不存在');
    res.json(serialize(article));
  });
  function articleInput(body) {
    const { title, content, tags = [] } = body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 || typeof content !== 'string' || !content.trim() || content.length > 50000 || !Array.isArray(tags) || tags.length > 8 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20)) return null;
    return [title.trim(), content.trim(), JSON.stringify([...new Set(tags.map(tag => tag.trim()))])];
  }
  app.post('/api/articles', adminRequired, (req, res) => {
    const data = articleInput(req.body);
    if (!data) return fail(res, 400, '请填写标题和正文；标题最多120字、正文最多50000字、最多8个标签且每个不超过20字');
    const result = db.prepare('INSERT INTO articles(title,content,tags,author_id) VALUES (?,?,?,?)').run(...data, req.user.id);
    res.status(201).json(serialize(getArticle(Number(result.lastInsertRowid))));
  });
  app.put('/api/articles/:id', adminRequired, (req, res) => {
    if (!getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    const data = articleInput(req.body);
    if (!data) return fail(res, 400, '文章内容不符合长度或标签要求');
    db.prepare("UPDATE articles SET title=?,content=?,tags=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(...data, req.params.id);
    res.json(serialize(getArticle(req.params.id)));
  });
  app.delete('/api/articles/:id', adminRequired, (req, res) => {
    const result = db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
    if (!result.changes) return fail(res, 404, '文章不存在');
    res.status(204).end();
  });
  app.get('/api/articles/:id/comments', (req, res) => {
    if (!getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    res.json(db.prepare('SELECT c.*,u.username,u.role FROM comments c JOIN users u ON u.id=c.user_id WHERE c.article_id=? ORDER BY c.id DESC').all(req.params.id));
  });
  app.post('/api/articles/:id/comments', loginRequired, (req, res) => {
    if (!getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 2000) return fail(res, 400, '评论须为1—2000字');
    const recent = db.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id=? AND created_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute')").get(req.user.id).n;
    if (recent >= 10) return fail(res, 429, '评论太频繁，请稍后再试');
    const result = db.prepare('INSERT INTO comments(article_id,user_id,content) VALUES (?,?,?)').run(req.params.id, req.user.id, content.trim());
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.delete('/api/comments/:id', loginRequired, (req, res) => {
    const comment = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
    if (!comment) return fail(res, 404, '评论不存在');
    if (req.user.role !== 'admin' && comment.user_id !== req.user.id) return fail(res, 403, '只能删除自己的评论');
    db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id);
    res.status(204).end();
  });
  app.use((req, res) => fail(res, 404, '接口不存在'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return fail(res, 400, '请求内容不是有效 JSON');
    if (error.type === 'entity.too.large') return fail(res, 413, '提交内容过大');
    console.error(error.message);
    fail(res, 500, '服务器处理失败，请稍后重试');
  });
  return app;
}
module.exports = { createApp };
