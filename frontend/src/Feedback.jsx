import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { feedbackStatuses } from './feedbackStatuses';
export function Feedback({ user, onLogin }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setItems(await api('/feedback')), []);
  useEffect(() => {
    let active = true;
    if (user && !user.needsContactVerification) api('/feedback').then(value => { if (active) setItems(value); }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [user]);
  async function send(event) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget; const data = new FormData(form);
    setBusy(true); setMessage('');
    try { const result = await api('/feedback', { method: 'POST', body: JSON.stringify({ subject: data.get('subject'), content: data.get('content') }) }); form.reset(); setMessage(result.message); await load(); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="article-card panel"><p className="eyebrow">WE ARE LISTENING</p><h1>问题反馈</h1><p className="muted">遇到问题或有建议，在这里告诉我们。只有你和有权限的管理人员能查看内容。</p>
    {!user ? <button onClick={onLogin}>登录后提交反馈</button> : user.needsContactVerification ? <p>请先完成邮箱验证。</p> : <><form onSubmit={send}><label>标题<input name="subject" maxLength={80} required /></label><label>问题描述<textarea name="content" maxLength={2000} required placeholder="请说明在哪个页面、进行了什么操作、出现什么问题。不要填写密码或验证码。" /></label><button className="primary-button" disabled={busy}>提交反馈</button></form><h2>我的反馈</h2><button disabled={busy} onClick={() => load().catch(e => setMessage(e.message))}>刷新进度</button>{items.map(item => <article className="feedback-item" key={item.report_key}><span className="role-badge">{feedbackStatuses[item.status]}</span><h3>{item.subject}</h3><p>{item.content}</p>{item.reply && <blockquote>管理员回复：{item.reply}</blockquote>}<small>{new Date(Number(item.created_at)).toLocaleString('zh-CN')}</small></article>)}</>}
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
