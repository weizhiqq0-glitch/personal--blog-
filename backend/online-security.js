const { createHash } = require('node:crypto');

const prefix = 'bcrypt-sha256:';
const dummyHash = '$2a$12$......................0000000000000000000000000000000';
const digest = password => createHash('sha256').update(password, 'utf8').digest('hex');

// bcrypt runs in PostgreSQL; database/network wait does not use Worker CPU quota.
// SHA-256 first preserves the full 128-character password beyond bcrypt's 72-byte limit.
function createOnlinePasswords(db, { legacyVerify } = {}) {
  return {
    async hashPassword(password) {
      const result = await db.prepare("SELECT crypt(?, gen_salt('bf', 12)) AS hash").get(digest(password));
      return prefix + result.hash;
    },
    async verifyPassword(password, stored) {
      if (!stored.startsWith(prefix) && legacyVerify) return legacyVerify(password, stored);
      const hash = stored.slice(prefix.length);
      const valid = stored.startsWith(prefix) && /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash);
      const candidate = valid ? hash : dummyHash;
      const result = await db.prepare('SELECT crypt(?,?)=? AS matches').get(digest(password), candidate, candidate);
      return valid && result.matches === true;
    },
  };
}

function createOnlineAuthLimit(db) {
  return async (req, res, next) => {
    // Cloudflare overwrites this header on public requests to the Worker.
    const ip = req.get('cf-connecting-ip') || req.ip || 'unknown';
    const key = createHash('sha256').update(ip).digest('hex');
    const now = Date.now();
    await db.prepare('DELETE FROM auth_attempts WHERE expires_at<=?').run(now);
    const attempt = await db.prepare(`INSERT INTO auth_attempts(key,count,expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=auth_attempts.count+1 RETURNING count`).get(key, now + 15 * 60_000);
    if (attempt.count > 30) return res.status(429).json({ error: '登录或注册过于频繁，请15分钟后重试' });
    next();
  };
}
module.exports = { createOnlinePasswords, createOnlineAuthLimit };
