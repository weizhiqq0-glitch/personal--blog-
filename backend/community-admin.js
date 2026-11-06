const express = require('express');
const { tokenHash } = require('./security');
const ONLINE_MS = 120000;

function validImage(value) {
  if (typeof value !== 'string' || value.length > 710000) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 512 * 1024) return null;
  const valid = match[1] === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : match[1] === 'image/jpeg' ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff' && bytes.subarray(-2).toString('hex') === 'ffd9'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return valid ? { mime: match[1], payload: bytes.toString('base64') } : null;
}
function validUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function createCommunityAdmin({ db, requireVerified, requireStaff, requirePermission }) {
  const router = express.Router();
  let ready;
  function init() {
    if (!ready) ready = Promise.resolve(db.ready).then(async () => {
      await db.prepare("CREATE TABLE IF NOT EXISTS site_appearance(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,url TEXT NOT NULL,mime TEXT NOT NULL,payload TEXT NOT NULL,updated_at BIGINT NOT NULL)").run();
      await db.prepare('CREATE TABLE IF NOT EXISTS account_presence(session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,last_seen BIGINT NOT NULL)').run();
    }).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function appearance() {
    const row = await db.prepare('SELECT kind,url,mime,updated_at FROM site_appearance WHERE id=1').get();
    return row ? { kind: row.kind, source: row.mime ? '/api/appearance/media?v=' + row.updated_at : row.url, updatedAt: Number(row.updated_at) } : { kind: '', source: '', updatedAt: 0 };
  }
  router.get('/appearance', async (req, res) => { await init(); res.json(await appearance()); });
  router.get('/appearance/media', async (req, res) => {
    await init();
    const row = await db.prepare('SELECT mime,payload FROM site_appearance WHERE id=1').get();
    if (!row?.mime) return res.status(404).end();
    res.set('Content-Type', row.mime).set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.send(Buffer.from(row.payload, 'base64'));
  });
  router.put('/management/appearance', requireStaff, requirePermission('site.manage'), async (req, res) => {
    const image = validImage(req.body?.image);
    const url = validUrl(req.body?.url);
    const kind = image ? 'image' : req.body?.kind;
    if (!image && (!url || !['image', 'video'].includes(kind))) return res.status(400).json({ error: '请选择图片，或填写有效的 HTTPS 图片/视频直链' });
    await init();
    await db.prepare('INSERT INTO site_appearance(id,kind,url,mime,payload,updated_at) VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,url=excluded.url,mime=excluded.mime,payload=excluded.payload,updated_at=excluded.updated_at').run(kind, image ? '' : url, image?.mime || '', image?.payload || '', Date.now());
    res.json(await appearance());
  });
  router.delete('/management/appearance', requireStaff, requirePermission('site.manage'), async (req, res) => {
    await init(); await db.prepare('DELETE FROM site_appearance WHERE id=1').run(); res.json(await appearance());
  });
  router.post('/presence', requireVerified, async (req, res) => {
    await init();
    const hash = tokenHash(req.get('authorization').replace(/^Bearer /, ''));
    const now = Date.now();
    // One row per authenticated session; the browser cannot claim another user ID.
    // Throttle writes per session even if the endpoint is called repeatedly.
    await db.prepare('INSERT INTO account_presence(session_hash,last_seen) VALUES (?,?) ON CONFLICT(session_hash) DO UPDATE SET last_seen=excluded.last_seen WHERE account_presence.last_seen<?').run(hash, now, now - 20000);
    res.status(204).end();
  });
  router.get('/management/members', requireStaff, async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ error: '页码无效' });
    await init();
    const now = Date.now();
    const rows = await db.prepare("SELECT u.id,u.username,u.role,u.banned,(SELECT MAX(p.last_seen) FROM account_presence p JOIN sessions s ON s.token_hash=p.session_hash WHERE s.user_id=u.id AND s.expires_at>?) AS last_active FROM users u ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,u.id LIMIT 61 OFFSET ?").all(now, (page - 1) * 60);
    res.json({ onlineWindowSeconds: ONLINE_MS / 1000, hasMore: rows.length > 60, members: rows.slice(0, 60).map(row => ({ id: row.id, username: row.username, role: row.role, banned: !!row.banned, online: !row.banned && Number(row.last_active) > now - ONLINE_MS, lastActive: row.last_active ? Number(row.last_active) : null })) });
  });
  return router;
}
module.exports = { createCommunityAdmin, validImage };
