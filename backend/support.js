const express = require('express');
const { randomBytes } = require('node:crypto');

function createSupport({ db, requireVerified, requirePermission, authLimit }) {
  let ready;
  function init() {
    if (!ready) ready = Promise.resolve(db.ready).then(async () => {
      await db.prepare("CREATE TABLE IF NOT EXISTS feedback_reports(report_key TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',reply TEXT NOT NULL DEFAULT '',created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL)").run();
      await db.prepare('CREATE INDEX IF NOT EXISTS feedback_user_time ON feedback_reports(user_id,created_at)').run();
    }).catch(error => { ready = undefined; throw error; });
    return ready;
  }
  const publicRouter = express.Router();
  publicRouter.use(requireVerified);
  publicRouter.get('/', async (req, res) => {
    await init();
    res.json(await db.prepare('SELECT report_key,subject,content,status,reply,created_at,updated_at FROM feedback_reports WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id));
  });
  publicRouter.post('/', authLimit, async (req, res) => {
    const { subject, content } = req.body || {};
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 80 || typeof content !== 'string' || !content.trim() || content.length > 2000) return res.status(400).json({ error: '请填写标题（最多80字）和问题描述（最多2000字）' });
    await init();
    const now = Date.now();
    const count = await db.prepare('SELECT COUNT(*) AS n FROM feedback_reports WHERE user_id=? AND created_at>?').get(req.user.id, now - 86400_000);
    if (Number(count.n) >= 5) return res.status(429).json({ error: '每个账号24小时内最多提交5条反馈，请等候处理' });
    const key = randomBytes(16).toString('hex');
    await db.prepare('INSERT INTO feedback_reports(report_key,user_id,subject,content,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(key, req.user.id, subject.trim(), content.trim(), now, now);
    res.status(201).json({ message: '反馈已提交，你可以在这里查看处理进度', key });
  });
  const managementRouter = express.Router();
  managementRouter.get('/feedback', requireVerified, requirePermission('feedback.manage'), async (req, res) => {
    await init();
    res.json(await db.prepare('SELECT f.*,u.username FROM feedback_reports f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 200').all());
  });
  managementRouter.patch('/feedback/:key', requireVerified, requirePermission('feedback.manage'), async (req, res) => {
    const { status, reply } = req.body || {};
    if (!/^[a-f0-9]{32}$/.test(req.params.key) || !['open', 'processing', 'resolved'].includes(status) || typeof reply !== 'string' || reply.length > 2000) return res.status(400).json({ error: '反馈状态或回复内容不正确' });
    await init();
    const result = await db.prepare('UPDATE feedback_reports SET status=?,reply=?,updated_at=? WHERE report_key=?').run(status, reply.trim(), Date.now(), req.params.key);
    if (!result.changes) return res.status(404).json({ error: '反馈不存在' });
    res.json({ message: '处理状态与回复已保存' });
  });
  managementRouter.get('/comments', requireVerified, requirePermission('comment.moderate'), async (req, res) => {
    res.json(await db.prepare('SELECT c.id,c.article_id,c.content,c.created_at,u.username,a.title AS article_title FROM comments c JOIN users u ON u.id=c.user_id JOIN articles a ON a.id=c.article_id ORDER BY c.id DESC LIMIT 200').all());
  });
  return { publicRouter, managementRouter };
}
module.exports = { createSupport };
