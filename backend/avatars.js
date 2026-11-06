const express = require('express');

const MAX_BYTES = 96 * 1024;
function validateAvatar(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES / 3) * 4 + 32 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const bytes = Buffer.from(value.slice(22), 'base64');
  if (bytes.length > MAX_BYTES || bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  // Accept bounded, static PNG containers only; never serve SVG/HTML or remote URLs.
  let offset = 8;
  let first = true;
  let imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (offset + length + 12 > bytes.length || type === 'acTL') return null;
    if (first) {
      if (type !== 'IHDR' || length !== 13) return null;
      const width = bytes.readUInt32BE(offset + 8), height = bytes.readUInt32BE(offset + 12);
      if (!width || !height || width > 256 || height > 256) return null;
      first = false;
    }
    if (type === 'IDAT') imageData = true;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && offset === bytes.length && imageData ? bytes : null;
  }
  return null;
}
function createAvatars({ db, requireVerified, authLimit }) {
  const router = express.Router();
  let ready;
  function init() {
    if (!ready) ready = Promise.resolve(db.ready).then(() => db.prepare('CREATE TABLE IF NOT EXISTS account_avatars(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,png TEXT NOT NULL,updated_at BIGINT NOT NULL)').run()).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  router.put('/me', requireVerified, authLimit, async (req, res) => {
    const bytes = validateAvatar(req.body?.image);
    if (!bytes) return res.status(400).json({ error: '头像须为不超过256×256、96KB的静态PNG，请重新选择图片' });
    await init();
    const version = Date.now();
    await db.prepare('INSERT INTO account_avatars(user_id,png,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET png=excluded.png,updated_at=excluded.updated_at').run(req.user.id, bytes.toString('base64'), version);
    res.json({ message: '头像已更新', version });
  });
  router.delete('/me', requireVerified, authLimit, async (req, res) => {
    await init(); await db.prepare('DELETE FROM account_avatars WHERE user_id=?').run(req.user.id);
    res.json({ message: '已恢复默认头像', version: Date.now() });
  });
  router.get('/:id', async (req, res) => {
    if (!/^[1-9]\d{0,9}$/.test(req.params.id)) return res.status(404).end();
    await init();
    const avatar = await db.prepare('SELECT png FROM account_avatars WHERE user_id=?').get(req.params.id);
    if (!avatar) return res.status(404).end();
    res.set('Content-Type', 'image/png');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.send(Buffer.from(avatar.png, 'base64'));
  });
  return router;
}
module.exports = { createAvatars, validateAvatar };
