const express = require('express');
const cors = require('cors');
const { randomBytes } = require('node:crypto');
const security = require('./security');
const { tokenHash } = security;
const { publicUser, effectivePermissions } = require('./permissions');
const { createAccounts } = require('./accounts');
const { createEmailSender } = require('./email');

function createApi(options) {
  const { hashPassword, verifyPassword } = options.passwords || security;
  const db = options.database;
  const accounts = createAccounts({ db, localDeviceEnrollment: options.localDeviceEnrollment === true, ownerDeviceSetupHash: options.ownerDeviceSetupHash, ownerEntryHash: options.ownerEntryHash || process.env.OWNER_ENTRY_CODE_HASH, mailPolicy: options.mailPolicy, passwords: { hashPassword, verifyPassword }, emailSender: options.emailSender || createEmailSender(options.emailConfig) });
  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  // Render is the one trusted reverse proxy in the documented deployment.
  if (process.env.TRUST_PROXY_HOPS === '1') app.set('trust proxy', 1);
  const origins = (options.origins || process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim());
  app.use(cors({ exposedHeaders: ['X-Visitor-Token'], origin(origin, done) { done(null, !origin || origins.includes(origin)); } }));
  app.use('/api/content-media', express.json({ limit: '1mb' }));
  app.use('/api/management/appearance', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '256kb' }));
  let ownerMigration;
  app.use(async (req, res, next) => {
    await db.ready;
    if (options.initialOwnerName) {
      if (!ownerMigration) ownerMigration = require('./owner-name-migration').migrateOwnerName(db, options.initialOwnerName).catch(error => { ownerMigration = undefined; throw error; });
      await ownerMigration;
    }
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    if (token) req.user = await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token), Date.now());
    req.mailIp = options.trustCloudflare ? (req.get('cf-connecting-ip') || req.ip) : req.ip;
    return accounts.checkRequest(req, res, next);
  });
  const fail = (res, code, error) => res.status(code).json({ error });
  const loginRequired = accounts.requireVerified;
  const adminRequired = accounts.requirePermission('article.manage');
  const attempts = new Map();
  function defaultAuthLimit(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const bucket = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
    bucket.count++; attempts.set(key, bucket);
    if (bucket.count > 30) return fail(res, 429, '登录或注册过于频繁，请15分钟后重试');
    next();
  }
  const authLimit = options.authLimit || defaultAuthLimit;
  async function issueSession(user) {
    await db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token), user.id, Date.now() + 7 * 86400_000);
    return { token, user: publicUser(await accounts.hydrateUser(user)) };
  }
  app.get('/api/health', async (req, res) => {
    await db.prepare('SELECT 1 AS n').get();
    res.json({ ok: true, version: 2, message: '博客后端运行正常' });
  });
  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return fail(res, 404, '内容不存在');
    next();
  });
  app.post('/api/visits', async (req, res) => {
    if (!origins.includes(req.get('origin')) || !/^[a-f0-9]{64}$/.test(req.get('x-visitor-token') || '') || req.body?.engaged !== true) return fail(res, 400, '无效的页面访问');
    await accounts.recordVisit(req);
    res.status(204).end();
  });
  app.use('/api/auth', accounts.authRouter(authLimit, issueSession));
  const avatars = require('./avatars').createAvatars({ db, requireVerified: accounts.requireVerified, authLimit });
  app.use('/api/avatars', avatars);
  app.use('/api/management', accounts.requireStaff);
  const community = require('./community-admin').createCommunityAdmin({ db, requireVerified: accounts.requireVerified, requireStaff: accounts.requireStaff, requirePermission: accounts.requirePermission });
  app.use('/api', community);
  app.use('/api/management', accounts.managementRouter(authLimit));
  const support = require('./support').createSupport({ db, requireVerified: accounts.requireVerified, requirePermission: accounts.requirePermission, authLimit });
  app.use('/api/feedback', support.publicRouter);
  app.use('/api/management', support.managementRouter);
  const siteContent = require('./site-content').createSiteContent({ db, requireVerified: accounts.requireVerified, requirePermission: accounts.requirePermission, authLimit });
  app.use('/api/content', siteContent);
  app.use('/api/content-media', require('./content-media').createContentMedia({db,requireStaff:accounts.requireStaff,requirePermission:accounts.requirePermission,authLimit}));
  app.get('/api/stats', async (req, res) => res.json({ articles: (await db.prepare('SELECT COUNT(*) AS n FROM articles').get()).n, comments: (await db.prepare('SELECT COUNT(*) AS n FROM comments').get()).n, users: (await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n }));
  const githubProjects = require('./github-projects').createGithubProjects();
  const githubBrowser = require('./github-browser').createGithubBrowser();
  const githubRequests = new Map();
  function githubLimit(req, res, next) {
    const now = Date.now();
    for (const [key, bucket] of githubRequests) if (bucket.until <= now) githubRequests.delete(key);
    const key = req.mailIp;
    if (!githubRequests.has(key) && githubRequests.size >= 2000) return fail(res, 429, '查询人数较多，请稍后重试');
    const bucket = githubRequests.get(key) || { count: 0, until: now + 600000 };
    githubRequests.set(key, bucket);
    if (++bucket.count > 30) return fail(res, 429, '查询过于频繁，请10分钟后重试');
    next();
  }
  const translateGithub = require('./github-translation').createGithubTranslation({db});
  app.post('/api/github-translate', githubLimit, async (req,res) => {
    try { res.json(await translateGithub(req.body?.text)); }
    catch(error) { fail(res,[400,429].includes(error.status)?error.status:503,error.status?error.message:'中文翻译暂不可用，请查看原文或稍后重试'); }
  });
  for (const [path, lookup] of [
    ['/api/github-search', req => githubBrowser.search(req.query.q, Number(req.query.page || 1))],
    ['/api/github-repo', req => githubBrowser.repo(req.query.name)],
  ]) app.get(path, githubLimit, async (req, res) => {
    try { res.json(await lookup(req)); }
    catch (error) { fail(res, [400,404,429].includes(error.status) ? error.status : 503, error.status ? error.message : 'GitHub 暂时无法连接，请稍后重试。'); }
  });
  app.get('/api/github-projects', async (req, res) => {
    const category = req.query.category || 'hot';
    const data = await githubProjects(category);
    if (!data) return res.status(400).json({ error: '项目分类不存在' });
    res.json(data);
  });
  app.get('/api/site-profile', async (req, res) => {
    res.json(await avatars.siteProfile());
  });
  app.get('/api/members', async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return fail(res, 400, '页码无效');
    // Public directory deliberately selects no contact, password or device fields.
    const rows = await db.prepare("SELECT id,username,role FROM users WHERE banned=0 AND verified_at IS NOT NULL AND role IN ('owner','admin','user') ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,id LIMIT 61 OFFSET ?").all((page - 1) * 60);
    res.json({ members: rows.slice(0, 60), hasMore: rows.length > 60 });
  });
  const articleSelect = 'SELECT a.*,u.username AS author,(SELECT COUNT(*) FROM comments c WHERE c.article_id=a.id) AS comment_count FROM articles a JOIN users u ON u.id=a.author_id';
  const serialize = article => ({ ...article, tags: JSON.parse(article.tags) });
  const getArticle = id => db.prepare(articleSelect + ' WHERE a.id=?').get(id);
  app.get('/api/search', accounts.requirePermission('article.read'), async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length > 80) return fail(res, 400, '搜索词须为1—80字');
    // Parameter binding and literal substring matching avoid wildcard expansion.
    const pattern = '%' + q.replace(/[!%_]/g, value => '!' + value) + '%';
    const rows = await db.prepare(articleSelect + " WHERE lower(a.title) LIKE lower(?) ESCAPE '!' OR lower(a.content) LIKE lower(?) ESCAPE '!' OR lower(a.tags) LIKE lower(?) ESCAPE '!' ORDER BY a.id DESC LIMIT 40").all(pattern,pattern,pattern);
    res.json({content: await siteContent.search(pattern), articles: rows.map(article => ({ id: article.id, title: article.title, summary: article.content.slice(Math.max(0,article.content.toLowerCase().indexOf(q.toLowerCase())-40), Math.max(0,article.content.toLowerCase().indexOf(q.toLowerCase())-40)+180), tags: JSON.parse(article.tags) })) });
  });
  app.get('/api/articles', accounts.requirePermission('article.read'), async (req, res) => {
    const articles = (await db.prepare(articleSelect + ' ORDER BY a.id DESC').all()).map(serialize).map(({ content, ...article }) => ({ ...article, summary: content.slice(0, 140) }));
    res.json(articles);
  });
  app.get('/api/articles/:id', accounts.requirePermission('article.read'), async (req, res) => {
    const article = await getArticle(req.params.id);
    if (!article) return fail(res, 404, '文章不存在');
    res.json(serialize(article));
  });
  function articleInput(body) {
    const { title, content, tags = [] } = body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 || typeof content !== 'string' || !content.trim() || content.length > 50000 || !Array.isArray(tags) || tags.length > 8 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20)) return null;
    return [title.trim(), content.trim(), JSON.stringify([...new Set(tags.map(tag => tag.trim()))])];
  }
  app.post('/api/articles', adminRequired, async (req, res) => {
    const data = articleInput(req.body);
    if (!data) return fail(res, 400, '请填写标题和正文；标题最多120字、正文最多50000字、最多8个标签且每个不超过20字');
    const result = await db.prepare('INSERT INTO articles(title,content,tags,author_id) VALUES (?,?,?,?)').run(...data, req.user.id);
    res.status(201).json(serialize(await getArticle(Number(result.lastInsertRowid))));
  });
  app.put('/api/articles/:id', adminRequired, async (req, res) => {
    if (!await getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    const data = articleInput(req.body);
    if (!data) return fail(res, 400, '文章内容不符合长度或标签要求');
    await db.prepare("UPDATE articles SET title=?,content=?,tags=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(...data, req.params.id);
    res.json(serialize(await getArticle(req.params.id)));
  });
  app.delete('/api/articles/:id', adminRequired, async (req, res) => {
    const result = await db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
    if (!result.changes) return fail(res, 404, '文章不存在');
    res.status(204).end();
  });
  app.get('/api/articles/:id/comments', accounts.requirePermission('comment.read'), async (req, res) => {
    if (!await getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    res.json(await db.prepare('SELECT c.*,u.username,u.role FROM comments c JOIN users u ON u.id=c.user_id WHERE c.article_id=? ORDER BY c.id DESC').all(req.params.id));
  });
  app.post('/api/articles/:id/comments', loginRequired, accounts.requirePermission('comment.create'), async (req, res) => {
    if (!await getArticle(req.params.id)) return fail(res, 404, '文章不存在');
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 2000) return fail(res, 400, '评论须为1—2000字');
    const recent = (await db.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id=? AND created_at>strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute')").get(req.user.id)).n;
    if (recent >= 10) return fail(res, 429, '评论太频繁，请稍后再试');
    const result = await db.prepare('INSERT INTO comments(article_id,user_id,content) VALUES (?,?,?)').run(req.params.id, req.user.id, content.trim());
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.delete('/api/comments/:id', loginRequired, async (req, res) => {
    const comment = await db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
    if (!comment) return fail(res, 404, '评论不存在');
    if (!effectivePermissions(req.user).includes('comment.moderate') && comment.user_id !== req.user.id) return fail(res, 403, '只能删除自己的评论');
    await db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id);
    res.status(204).end();
  });
  app.use((req, res) => fail(res, 404, '接口不存在'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return fail(res, 400, '请求内容不是有效 JSON');
    if (error.type === 'entity.too.large') return fail(res, 413, '提交内容过大');
    if (error.status && error.status >= 400 && error.status < 600) return fail(res, error.status, error.message);
    console.error('接口处理失败：', error.code || error.name);
    fail(res, 500, '服务器处理失败，请稍后重试');
  });
  return app;
}
module.exports = { createApi };
