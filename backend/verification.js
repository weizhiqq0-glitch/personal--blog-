const { randomBytes, randomInt, timingSafeEqual, createHash } = require('node:crypto');
const { tokenHash } = require('./security');
function normalizeContact(type, value) {
  if (type !== 'email' || typeof value !== 'string') return null;
  const contact = value.trim().toLowerCase();
  return contact.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : null;
}
const codeHash = (id, code) => createHash('sha256').update(id + ':' + code).digest('hex');
function createVerification(db, sender, budget) {
  return {
    available: sender.available,
    async send({ contact, purpose, userId = null, context = {} }) {
      if (!sender.available) { const error = Error('邮箱验证码服务尚未配置，暂时无法注册或绑定'); error.status = 503; throw error; }
      const now = Date.now();
      const key = tokenHash('email:' + contact);
      const reserved = await db.prepare(`INSERT INTO verification_delivery(key,next_send_at) VALUES (?,?)
        ON CONFLICT(key) DO UPDATE SET next_send_at=excluded.next_send_at WHERE verification_delivery.next_send_at<=?`).run(key, now + 60000, now);
      if (!reserved.changes) { const error = Error('验证码发送频繁，请60秒后重试'); error.status = 429; throw error; }
      await db.prepare('DELETE FROM verification_limits WHERE expires_at<=?').run(now);
      const bucket = await db.prepare(`INSERT INTO verification_limits(key,count,expires_at) VALUES (?,1,?)
        ON CONFLICT(key) DO UPDATE SET count=verification_limits.count+1 RETURNING count`).get(key, now + 3600000);
      if (bucket.count > 6) { const error = Error('此邮箱验证码已达每小时发送上限，请稍后重试'); error.status = 429; throw error; }
      const budgetKey = await budget.reserve({ contact, ...context });
      const id = randomBytes(32).toString('hex');
      const code = String(randomInt(1000000)).padStart(6, '0');
      await db.prepare('DELETE FROM verification_challenges WHERE expires_at<=?').run(now);
      await db.prepare(`INSERT INTO verification_challenges(request_hash,contact_type,contact_value,purpose,user_id,code_hash,expires_at,created_at)
        VALUES (?,'email',?,?,?,?,?,?)`).run(tokenHash(id), contact, purpose, userId, codeHash(id, code), now + 300000, now);
      try { await sender.send({ to: contact, code }); }
      catch (error) { await db.prepare('DELETE FROM verification_challenges WHERE request_hash=?').run(tokenHash(id)); throw error; }
      await budget.accepted(budgetKey);
      return { verificationId: id, expiresIn: 300, retryAfter: 60, message: '验证码已发送，请查看邮箱及垃圾邮件文件夹' };
    },
    async consume({ id, code, contact, purpose, userId = null }) {
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
      const challenge = await db.prepare(`UPDATE verification_challenges SET attempts=attempts+1
        WHERE request_hash=? AND consumed_at IS NULL AND expires_at>? AND attempts<5 RETURNING *`).get(tokenHash(id), Date.now());
      if (!challenge || challenge.contact_value !== contact || challenge.purpose !== purpose || challenge.user_id !== userId) return false;
      const actual = Buffer.from(codeHash(id, code), 'hex');
      if (!timingSafeEqual(actual, Buffer.from(challenge.code_hash, 'hex'))) return false;
      return !!(await db.prepare('UPDATE verification_challenges SET consumed_at=? WHERE request_hash=? AND consumed_at IS NULL').run(Date.now(), tokenHash(id))).changes;
    },
  };
}
module.exports = { normalizeContact, createVerification };
