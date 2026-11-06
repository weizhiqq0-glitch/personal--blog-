const express = require('express');
const { randomBytes } = require('node:crypto');
const { validateCredentials, tokenHash } = require('./security');
const { PERMISSIONS, effectivePermissions, publicUser } = require('./permissions');
const { createVerification, normalizeContact } = require('./verification');

function createAccounts({ db, passwords, emailSender }) {
  const verification = createVerification(db, emailSender);
  const fail = (res, status, error) => res.status(status).json({ error });
  const signedIn = (req, res, next) => req.user ? next() : fail(res, 401, '请先登录');
  function requireVerified(req, res, next) {
    if (!req.user) return fail(res, 401, '请先登录');
    if (!req.user.verified_at) return fail(res, 403, '请先完成邮箱验证码绑定');
    next();
  }
  function requirePermission(permission) {
    return (req, res, next) => {
      if (effectivePermissions(req.user).includes(permission)) return next();
      if (!req.user) return fail(res, 401, '请先登录');
      return fail(res, 403, req.user.verified_at ? '当前账号没有此操作权限' : '请先完成邮箱验证码绑定');
    };
  }
  function ownerOnly(req, res, next) {
    if (req.user?.role !== 'owner' || !req.user.verified_at) return fail(res, 403, '只有已验证的站主可以管理角色和授权');
    next();
  }
  async function checkRequest(req, res, next) {
    if (req.path === '/api/health') return next();
    if (req.user?.banned) return fail(res, 403, '此账号已被封禁，请联系站主');
    let visitor = req.get('x-visitor-token');
    if (!/^[a-f0-9]{64}$/.test(visitor || '')) visitor = randomBytes(32).toString('hex');
    res.set('X-Visitor-Token', visitor);
    const key = tokenHash(visitor);
    const now = Date.now();
    const record = await db.prepare(`INSERT INTO visitors(key,first_seen,last_seen) VALUES (?,?,?)
      ON CONFLICT(key) DO UPDATE SET last_seen=excluded.last_seen RETURNING *`).get(key, now, now);
    req.visitorKey = key;
    if (record.banned && req.user?.role !== 'owner') return fail(res, 403, '当前访客已被限制访问，请联系站主');
    next();
  }
  async function audit(req, action, target, details) {
    await db.prepare('INSERT INTO moderation_events(event_key,actor_id,action,target,details,created_at) VALUES (?,?,?,?,?,?)')
      .run(randomBytes(16).toString('hex'), req.user.id, action, String(target), JSON.stringify(details), Date.now());
  }
  function authRouter(authLimit, issueSession) {
    const router = express.Router();
    router.get('/options', (req, res) => res.json({ emailVerification: verification.available, phoneVerification: false, passwordMin: 6, passwordMax: 14 }));
    router.post('/verification-code', authLimit, async (req, res) => {
      const { contactType = 'email', contact: value, purpose } = req.body || {};
      const contact = normalizeContact(contactType, value);
      if (!contact) return fail(res, 400, contactType === 'phone' ? '手机验证码尚未启用，请使用邮箱' : '请输入有效邮箱');
      if (!['register', 'bind', 'reset-password'].includes(purpose)) return fail(res, 400, '验证码用途不正确');
      if (purpose === 'bind' && !req.user) return fail(res, 401, '请先登录');
      if (purpose === 'bind' && req.user.verified_at) return fail(res, 400, '当前账号已经绑定；更换绑定需要单独核验');
      if (purpose === 'bind' && req.user.contact_value && req.user.contact_value !== contact) return fail(res, 400, '请验证预留的邮箱地址');
      const known = purpose === 'reset-password' ? await db.prepare("SELECT id FROM users WHERE contact_type='email' AND contact_value=?").get(contact) : null;
      if (purpose === 'reset-password' && !known) {
        if (!verification.available) return fail(res, 503, '邮箱验证码服务尚未配置');
        return res.json({ verificationId: randomBytes(32).toString('hex'), expiresIn: 300, retryAfter: 60, message: '若此邮箱已绑定账号，将收到验证码' });
      }
      const result = await verification.send({ contact, purpose, userId: purpose === 'bind' ? req.user.id : known?.id || null });
      res.json(purpose === 'reset-password' ? { ...result, message: '若此邮箱已绑定账号，将收到验证码' } : result);
    });
    router.post('/register', authLimit, async (req, res) => {
      const { username, password, verificationId, code, contactType = 'email', contact: value } = req.body || {};
      if (!validateCredentials(username, password)) return fail(res, 400, '用户名须为2—32位汉字、字母、数字、下划线或短横线；密码须为6—14位');
      const contact = normalizeContact(contactType, value);
      if (!contact) return fail(res, 400, '注册必须绑定有效邮箱');
      if (!await verification.consume({ id: verificationId, code, contact, purpose: 'register' })) return fail(res, 400, '验证码不正确、已过期或已使用，请重新获取');
      try {
        const result = await db.prepare("INSERT INTO users(username,password_hash,role,contact_type,contact_value,verified_at) VALUES (?,?,'user','email',?,?)")
          .run(username, await passwords.hashPassword(password), contact, new Date().toISOString());
        const user = await db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid));
        res.status(201).json(await issueSession(user));
      } catch (error) {
        if (error.code === '23505' || error.message.includes('UNIQUE')) return fail(res, 409, '用户名或邮箱已被使用');
        throw error;
      }
    });
    router.post('/login', authLimit, async (req, res) => {
      const { username, password } = req.body || {};
      // Existing longer passwords can still authenticate; newly set passwords are 6–14.
      if (typeof username !== 'string' || typeof password !== 'string' || username.length > 32 || password.length > 128 || !password) return fail(res, 401, '用户名或密码错误');
      const user = await db.prepare('SELECT * FROM users WHERE username=?').get(username);
      const matches = await passwords.verifyPassword(password, user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
      if (!user || !matches) return fail(res, 401, '用户名或密码错误');
      if (user.banned) return fail(res, 403, '此账号已被封禁，请联系站主');
      res.json(await issueSession(user));
    });
    router.get('/me', signedIn, (req, res) => res.json(publicUser(req.user)));
    router.post('/logout', signedIn, async (req, res) => {
      await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(req.get('authorization').slice(7)));
      res.status(204).end();
    });
    router.post('/contact', signedIn, authLimit, async (req, res) => {
      if (req.user.verified_at) return fail(res, 400, '账号已经完成绑定');
      const contact = normalizeContact(req.body?.contactType || 'email', req.body?.contact);
      if (!contact || (req.user.contact_value && req.user.contact_value !== contact)) return fail(res, 400, '请输入有效的预留邮箱');
      if (!await verification.consume({ id: req.body.verificationId, code: req.body.code, contact, purpose: 'bind', userId: req.user.id })) return fail(res, 400, '验证码不正确、已过期或已使用');
      try {
        await db.prepare("UPDATE users SET contact_type='email',contact_value=?,verified_at=? WHERE id=? AND verified_at IS NULL").run(contact, new Date().toISOString(), req.user.id);
      } catch (error) {
        if (error.code === '23505' || error.message.includes('UNIQUE')) return fail(res, 409, '此邮箱已被其他账号绑定');
        throw error;
      }
      res.json(publicUser(await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)));
    });
    router.post('/password/reset', authLimit, async (req, res) => {
      const contact = normalizeContact('email', req.body?.contact);
      const password = req.body?.password;
      if (!validateCredentials('reset', password) || !contact) return fail(res, 400, '请输入有效邮箱和6—14位新密码');
      const user = await db.prepare("SELECT * FROM users WHERE contact_type='email' AND contact_value=?").get(contact);
      if (!user || !await verification.consume({ id: req.body.verificationId, code: req.body.code, contact, purpose: 'reset-password', userId: user.id })) return fail(res, 400, '验证码不正确、已过期或已使用');
      const hash = await passwords.hashPassword(password);
      await db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      await db.prepare('UPDATE users SET password_hash=?,verified_at=COALESCE(verified_at,?) WHERE id=?').run(hash, new Date().toISOString(), user.id);
      res.json({ message: '密码已重置，请使用新密码登录' });
    });
    return router;
  }
  function managementRouter() {
    const router = express.Router();
    router.param('id', (req, res, next, id) => /^[1-9]\d*$/.test(id) && Number(id) <= 2147483647 ? next() : fail(res, 404, '账号不存在'));
    router.use(requireVerified);
    const canList = (req, res, next) => req.user.role === 'owner' || effectivePermissions(req.user).includes('user.ban') ? next() : fail(res, 403, '没有账号管理权限');
    router.get('/users', canList, async (req, res) => {
      const users = await db.prepare('SELECT id,username,role,contact_type,contact_value,verified_at,banned,ban_reason,permissions,created_at FROM users ORDER BY id DESC LIMIT 200').all();
      res.json({ permissions: PERMISSIONS, users: users.map(user => ({ id: user.id, username: user.username, role: user.role, verified: !!user.verified_at, banned: !!user.banned, banReason: user.ban_reason,
        contact: user.contact_value ? user.contact_value[0] + '***@' + user.contact_value.split('@')[1] : '', overrides: JSON.parse(user.permissions || '{}'), permissions: effectivePermissions(user), created_at: user.created_at })) });
    });
    router.patch('/users/:id', ownerOnly, async (req, res) => {
      const target = await db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
      if (!target) return fail(res, 404, '账号不存在');
      if (target.role === 'owner') return fail(res, 403, '站主身份不可通过此接口修改');
      const role = req.body?.role ?? target.role;
      const overrides = req.body?.permissions ?? JSON.parse(target.permissions || '{}');
      if (!['user', 'admin'].includes(role) || !overrides || Array.isArray(overrides) || typeof overrides !== 'object' || Object.entries(overrides).some(([key, value]) => !Object.hasOwn(PERMISSIONS, key) || typeof value !== 'boolean')) return fail(res, 400, '角色或授权内容不正确');
      await db.prepare('UPDATE users SET role=?,permissions=? WHERE id=?').run(role, JSON.stringify(overrides), target.id);
      await audit(req, 'user.permissions', target.id, { role, permissions: overrides });
      res.json({ message: '角色与权限已更新' });
    });
    router.post('/users/:id/ban', requirePermission('user.ban'), async (req, res) => {
      const target = await db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
      if (!target) return fail(res, 404, '账号不存在');
      if (target.role === 'owner' || target.id === req.user.id || (req.user.role !== 'owner' && target.role !== 'user')) return fail(res, 403, '不能封禁自己、站主或同级及更高身份账号');
      if (typeof req.body?.banned !== 'boolean' || (req.body.reason !== undefined && (typeof req.body.reason !== 'string' || req.body.reason.length > 200))) return fail(res, 400, '封禁状态或原因不正确');
      await db.prepare('UPDATE users SET banned=?,ban_reason=? WHERE id=?').run(req.body.banned ? 1 : 0, req.body.reason || '', target.id);
      if (req.body.banned) await db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      await audit(req, 'user.ban', target.id, { banned: req.body.banned, reason: req.body.reason || '' });
      res.json({ message: req.body.banned ? '账号已封禁，登录会话已失效' : '账号已解除封禁' });
    });
    router.get('/visitors', requirePermission('visitor.ban'), async (req, res) => {
      const records = await db.prepare('SELECT * FROM visitors ORDER BY last_seen DESC LIMIT 100').all();
      res.json(records.map(record => ({ key: record.key, current: record.key === req.visitorKey, label: '访客 ' + record.key.slice(0, 10), firstSeen: Number(record.first_seen), lastSeen: Number(record.last_seen), banned: !!record.banned, banReason: record.ban_reason })));
    });
    router.post('/visitors/:key/ban', requirePermission('visitor.ban'), async (req, res) => {
      if (!/^[a-f0-9]{64}$/.test(req.params.key) || typeof req.body?.banned !== 'boolean' || (req.body.reason !== undefined && (typeof req.body.reason !== 'string' || req.body.reason.length > 200))) return fail(res, 400, '访客或封禁状态不正确');
      if (req.params.key === req.visitorKey) return fail(res, 400, '不能封禁当前正在使用的访客标识');
      const result = await db.prepare('UPDATE visitors SET banned=?,ban_reason=? WHERE key=?').run(req.body.banned ? 1 : 0, req.body.reason || '', req.params.key);
      if (!result.changes) return fail(res, 404, '访客不存在');
      await audit(req, 'visitor.ban', req.params.key, { banned: req.body.banned });
      res.json({ message: req.body.banned ? '访客已封禁' : '访客已解除封禁' });
    });
    router.get('/events', ownerOnly, async (req, res) => res.json(await db.prepare('SELECT event_key,actor_id,action,target,details,created_at FROM moderation_events ORDER BY created_at DESC LIMIT 100').all()));
    return router;
  }
  return { checkRequest, requireVerified, requirePermission, authRouter, managementRouter };
}
module.exports = { createAccounts };
