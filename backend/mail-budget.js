const { randomBytes } = require('node:crypto');
const { tokenHash } = require('./security');
const DAY = 86400000;
const POLICY = { email: 4, browser: 6, account: 4, ipHour: 5, ipDay: 10, siteDay: 20, monthly: 200, reserve: 20 };
function cycle(settings, now) {
  const anchor = new Date(settings.resetAt);
  let reset = anchor.getTime();
  let offset = 0;
  while (reset <= now) {
    offset++;
    const month = anchor.getUTCMonth() + offset;
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), month + 1, 0)).getUTCDate();
    reset = Date.UTC(anchor.getUTCFullYear(), month, Math.min(anchor.getUTCDate(), end), anchor.getUTCHours(), anchor.getUTCMinutes());
  }
  return { key: settings.generation + ':' + reset, resetAt: reset, allowance: offset ? 200 : settings.remaining };
}
function createMailBudget(db, overrides = {}) {
  const policy = { ...POLICY, ...overrides };
  let ready;
  function init() {
    if (!ready) ready = (async () => {
      await db.ready;
      await db.prepare('CREATE TABLE IF NOT EXISTS mail_budget_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
      await db.prepare('CREATE TABLE IF NOT EXISTS mail_budget_cycles(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,accepted INTEGER NOT NULL DEFAULT 0)').run();
      await db.prepare('CREATE TABLE IF NOT EXISTS page_visitors(key TEXT PRIMARY KEY,first_seen BIGINT NOT NULL,last_seen BIGINT NOT NULL)').run();
      const now = new Date();
      // Existing platform usage is unknown: require owner calibration before enabling delivery.
      const value = { remaining: 0, resetAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1), generation: 'initial', calibrated: false };
      await db.prepare('INSERT INTO mail_budget_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('current', JSON.stringify(value));
    })().catch(error => { ready = undefined; throw error; });
    return ready;
  }
  async function state() {
    await init();
    const settings = JSON.parse((await db.prepare('SELECT value FROM mail_budget_settings WHERE key=?').get('current')).value);
    return { settings, period: cycle(settings, Date.now()) };
  }
  function denied(message) { const error = Error(message); error.status = 429; throw error; }
  async function limit(key, max, duration) {
    const now = Date.now();
    const row = await db.prepare(`INSERT INTO verification_limits(key,count,expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN verification_limits.expires_at<=? THEN 1 ELSE verification_limits.count+1 END,
      expires_at=CASE WHEN verification_limits.expires_at<=? THEN excluded.expires_at ELSE verification_limits.expires_at END
      WHERE verification_limits.expires_at<=? OR verification_limits.count<? RETURNING count`).get(tokenHash('budget:' + key), now + duration, now, now, now, max);
    if (!row) denied('验证码请求已达到安全上限，请稍后再试');
  }
  return {
    init,
    async status() {
      const { settings, period } = await state();
      const row = await db.prepare('SELECT attempts,accepted FROM mail_budget_cycles WHERE key=?').get(period.key);
      const remaining = settings.calibrated ? Math.max(0, period.allowance - Number(row?.attempts || 0)) : 0;
      return { calibrated: settings.calibrated, remaining, publicRemaining: Math.max(0, remaining - policy.reserve), attempts: Number(row?.attempts || 0), accepted: Number(row?.accepted || 0), resetAt: period.resetAt, policy };
    },
    async calibrate(remaining, resetAt) {
      const reset = Date.parse(resetAt);
      if (!Number.isInteger(remaining) || remaining < 0 || remaining > 200 || !Number.isFinite(reset) || reset <= Date.now() || reset > Date.now() + 32 * DAY) {
        const error = Error('剩余额度须为0—200的整数，下次重置日期须在未来32天内'); error.status = 400; throw error;
      }
      await init();
      const value = { remaining, resetAt: reset, generation: randomBytes(16).toString('hex'), calibrated: true };
      await db.prepare('UPDATE mail_budget_settings SET value=? WHERE key=?').run(JSON.stringify(value), 'current');
      return this.status();
    },
    async reserve({ contact, browser, ip, account, owner }) {
      await init();
      const { settings, period } = await state();
      if (!settings.calibrated) denied('请站主先在账号管理中校准 EmailJS 剩余额度');
      await limit('email:' + contact, policy.email, DAY);
      await limit('ip-hour:' + ip, policy.ipHour, 3600000);
      await limit('ip-day:' + ip, policy.ipDay, DAY);
      await limit('browser:' + browser, policy.browser, DAY);
      if (account) await limit('account:' + account, policy.account, DAY);
      // Unauthenticated password reset always uses the public pool, even for the owner.
      if (!owner) await limit('site-day', policy.siteDay, DAY);
      const max = Math.max(0, period.allowance - (owner ? 0 : policy.reserve));
      if (!max) denied('本站邮件额度暂不足，请联系站主或等待额度重置');
      const row = await db.prepare(`INSERT INTO mail_budget_cycles(key,attempts,accepted) VALUES (?,1,0)
        ON CONFLICT(key) DO UPDATE SET attempts=mail_budget_cycles.attempts+1
        WHERE mail_budget_cycles.attempts<? RETURNING attempts`).get(period.key, max);
      if (!row) denied('本站邮件额度暂不足，请联系站主或等待额度重置');
      return period.key;
    },
    async accepted(key) { await db.prepare('UPDATE mail_budget_cycles SET accepted=accepted+1 WHERE key=?').run(key); },
  };
}
module.exports = { createMailBudget, cycle };
