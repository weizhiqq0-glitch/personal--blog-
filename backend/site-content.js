const express = require('express');
const { randomBytes } = require('node:crypto');
const KINDS = ['projects', 'photos', 'music', 'moments', 'chatter', 'friends', 'about'];
function safeLink(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function validateContent(body, kind) {
  if (!KINDS.includes(kind) || typeof body?.title !== 'string' || !body.title.trim() || body.title.length > 120 || typeof body.content !== 'string' || body.content.length > 20000) return null;
  const url = safeLink(body.url), image = /^\/api\/content-media\/[a-f0-9]{32}$/.test(body.image || '') ? body.image : safeLink(body.image);
  if (url === null || image === null || (kind === 'music' && !url) || (kind === 'photos' && !image)) return null;
  return { title: body.title.trim(), content: body.content.trim(), url, image };
}
function createSiteContent({ db, requireVerified, requirePermission, authLimit }) {
  let ready;
  function init() {
    if (!ready) ready = Promise.resolve(db.ready).then(() => db.prepare('CREATE TABLE IF NOT EXISTS site_content(item_key TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,url TEXT NOT NULL,image TEXT NOT NULL,author_id INTEGER NOT NULL REFERENCES users(id),created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL)').run()).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  const router = express.Router();
  router.search = async pattern => { await init(); return db.prepare("SELECT item_key,kind,title,content FROM site_content WHERE lower(title) LIKE lower(?) ESCAPE '!' OR lower(content) LIKE lower(?) ESCAPE '!' ORDER BY created_at DESC LIMIT 40").all(pattern,pattern); };
  router.param('kind', (req, res, next, kind) => KINDS.includes(kind) ? next() : res.status(404).json({ error: '板块不存在' }));
  router.get('/:kind', async (req, res) => {
    await init();
    res.json(await db.prepare('SELECT item_key,kind,title,content,url,image,created_at,updated_at FROM site_content WHERE kind=? ORDER BY created_at DESC LIMIT 200').all(req.params.kind));
  });
  router.post('/:kind', requireVerified, requirePermission('site.manage'), authLimit, async (req, res) => {
    const value = validateContent(req.body, req.params.kind);
    if (!value) return res.status(400).json({ error: '请填写标题和内容；链接须为HTTPS，照片须有图片链接，音乐须有音频直链' });
    await init(); const key = randomBytes(16).toString('hex'), now = Date.now();
    const count = await db.prepare('SELECT COUNT(*) AS n FROM site_content WHERE kind=?').get(req.params.kind);
    if (Number(count.n) >= 200) return res.status(400).json({ error: '每个板块最多保留200项，请先整理旧内容' });
    await db.prepare('INSERT INTO site_content(item_key,kind,title,content,url,image,author_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(key, req.params.kind, value.title, value.content, value.url, value.image, req.user.id, now, now);
    res.status(201).json({ message: '内容已发布', key });
  });
  router.patch('/:kind/:key', requireVerified, requirePermission('site.manage'), async (req, res) => {
    const value = validateContent(req.body, req.params.kind);
    if (!value || !/^[a-f0-9]{32}$/.test(req.params.key)) return res.status(400).json({ error: '内容格式不正确，链接须为HTTPS' });
    await init();
    const result = await db.prepare('UPDATE site_content SET title=?,content=?,url=?,image=?,updated_at=? WHERE kind=? AND item_key=?').run(value.title, value.content, value.url, value.image, Date.now(), req.params.kind, req.params.key);
    if (!result.changes) return res.status(404).json({ error: '内容不存在' });
    res.json({ message: '内容已更新' });
  });
  router.delete('/:kind/:key', requireVerified, requirePermission('site.manage'), async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.key)) return res.status(404).json({ error: '内容不存在' });
    await init(); const result = await db.prepare('DELETE FROM site_content WHERE kind=? AND item_key=?').run(req.params.kind, req.params.key);
    if (!result.changes) return res.status(404).json({ error: '内容不存在' });
    res.json({ message: '内容已删除' });
  });
  return router;
}
module.exports = { createSiteContent, validateContent };
