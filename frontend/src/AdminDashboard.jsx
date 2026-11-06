import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ManagementPanel } from './ManagementPanel';
import { EmailBudget } from './EmailBudget';
import { LoginReports } from './LoginReports';
import { feedbackStatuses } from './feedbackStatuses';
import './AdminDashboard.css';
import { OwnerReportNotice } from './OwnerReportNotice';
import { AdminMembers } from './AdminMembers';
import { WallpaperSettings } from './Wallpaper';
import { ContentManager } from './ContentManager';

function AdminArticles() {
  const [articles, setArticles] = useState([]);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setArticles(await api('/articles')), []);
  useEffect(() => { let active = true; api('/articles').then(value => { if (active) setArticles(value); }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, []);
  async function run(action) { if (busy) return; setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function edit(id) { run(async () => { const article = await api('/articles/' + id); setDraft({ ...article, tags: article.tags.join('，') }); }); }
  function save(event) {
    event.preventDefault(); run(async () => {
      await api('/articles' + (draft.id ? '/' + draft.id : ''), { method: draft.id ? 'PUT' : 'POST', body: JSON.stringify({ title: draft.title, content: draft.content, tags: draft.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) }) });
      setDraft(null); setMessage('文章已保存'); await load();
    });
  }
  function remove(id) { if (window.confirm('删除文章及其评论？此操作不可撤销。')) run(async () => { await api('/articles/' + id, { method: 'DELETE' }); setMessage('文章已删除'); await load(); }); }
  return <><div className="admin-section-heading"><h2>文章管理</h2><button className="primary-button" disabled={busy} onClick={() => setDraft({ title: '', content: '', tags: '' })}>＋ 发布文章</button></div>
    {message && <p className="notice" role="status">{message}</p>}
    {draft && <form onSubmit={save} className="admin-editor"><h3>{draft.id ? '编辑文章' : '新建文章'}</h3><label>标题<input value={draft.title} maxLength={120} required onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>标签<input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="用逗号分隔，最多8个" /></label><label>正文<textarea className="editor" value={draft.content} maxLength={50000} required onChange={e => setDraft({ ...draft, content: e.target.value })} /></label><div className="actions"><button className="primary-button" disabled={busy}>保存并发布</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>取消</button></div></form>}
    <div className="admin-table-wrap"><table><thead><tr><th>标题</th><th>作者</th><th>评论</th><th>操作</th></tr></thead><tbody>{articles.map(article => <tr key={article.id}><td>{article.title}</td><td>{article.author}</td><td>{article.comment_count}</td><td className="table-actions"><button disabled={busy} onClick={() => edit(article.id)}>编辑</button><button disabled={busy} className="danger" onClick={() => remove(article.id)}>删除</button></td></tr>)}</tbody></table>{!articles.length && <p className="empty">暂无文章，点击“发布文章”开始。</p>}</div>
  </>;
}
function AdminComments() {
  const [items, setItems] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setItems(await api('/management/comments')), []);
  useEffect(() => { let active = true; api('/management/comments').then(value => { if (active) setItems(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function remove(id) { if (busy || !window.confirm('确定删除这条评论吗？')) return; setBusy(true); try { await api('/comments/' + id, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <><h2>评论管理</h2><p className="muted">显示最近200条评论。</p>{error && <p className="notice error">{error}</p>}{items.map(item => <article className="feedback-item" key={item.id}><strong>{item.username}</strong><small> · {item.article_title}</small><p>{item.content}</p><button disabled={busy} className="danger" onClick={() => remove(item.id)}>删除评论</button></article>)}{!items.length && <p className="empty">暂无评论。</p>}</>;
}
function FeedbackEditor({ item, onSave, busy }) {
  const [status, setStatus] = useState(item.status); const [reply, setReply] = useState(item.reply);
  return <article className="feedback-item"><h3>{item.subject}</h3><small>{item.username} · {new Date(Number(item.created_at)).toLocaleString('zh-CN')}</small><p>{item.content}</p><form onSubmit={event => { event.preventDefault(); onSave(item.report_key, { status, reply }); }}><label>处理状态<select value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(feedbackStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>回复用户<textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={2000} /></label><button disabled={busy} className="primary-button">保存处理结果</button></form></article>;
}
function AdminFeedback() {
  const [items, setItems] = useState([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setItems(await api('/management/feedback')), []);
  useEffect(() => { let active = true; api('/management/feedback').then(value => { if (active) setItems(value); }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, []);
  async function save(key, body) { if (busy) return; setBusy(true); try { const result = await api('/management/feedback/' + key, { method: 'PATCH', body: JSON.stringify(body) }); setMessage(result.message); await load(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  return <><h2>问题反馈</h2><button onClick={() => load().catch(e => setMessage(e.message))}>刷新列表</button>{message && <p className="notice" role="status">{message}</p>}{items.map(item => <FeedbackEditor key={item.report_key + item.updated_at} item={item} onSave={save} busy={busy} />)}{!items.length && <p className="empty">暂无反馈，用户提交的问题会出现在这里。</p>}</>;
}
function Overview() {
  const [stats, setStats] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/stats').then(setStats).catch(e => setError(e.message)); }, []);
  return <><h2>站点概览</h2><p className="muted">在这里管理小站的内容、成员与服务状态。</p>{error && <p className="notice error">{error}</p>}<div className="admin-metrics">{[['文章', stats?.articles], ['评论', stats?.comments], ['账号', stats?.users]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div><section className="admin-welcome"><h3>前台与后台，各司其职。</h3><p>博客前台用于阅读和交流；这里用于管理。所有修改通过独立后端校验权限后写入数据库。</p><a href="#/">返回 mowu的小站 →</a></section></>;
}
export function AdminDashboard({ user, route, onLogin, wallpaper }) {
  const owner = user?.role === 'owner';
  const can = permission => user?.permissions?.includes(permission) && !user.needsContactVerification;
  const sections = [
    ['overview', '站点概览', true], ['articles', '文章管理', can('article.manage')], ['comments', '评论管理', can('comment.moderate')],
    ['users', '账号与访客', owner || can('user.ban') || can('visitor.ban')], ['feedback', '问题反馈', can('feedback.manage')], ['quota', '额度与用量', owner], ['security', '登录报备', owner],
    ['content', '板块内容', can('site.manage')], ['appearance', '全站背景', can('site.manage')], ['members', '成员列表', true],
  ];
  const allowed = user && !user.needsContactVerification && ['owner', 'admin'].includes(user.role);
  const active = route === '/management' ? 'users' : route.split('/')[2] || 'overview';
  return <div className="admin-shell"><aside className="admin-sidebar"><a className="admin-logo" href="#/admin">✦ mowu<span>管理后台</span></a><nav aria-label="管理后台导航">{sections.filter(([, , enabled]) => enabled && allowed).map(([id, label]) => <a key={id} href={'#/admin/' + id} aria-current={active === id ? 'page' : undefined}>{label}<span>›</span></a>)}</nav><a className="admin-return" href="#/">← 返回博客前台</a></aside><div className="admin-workspace"><header className="admin-header"><span>控制台 / {sections.find(([id]) => id === active)?.[1] || '页面不存在'}</span><span>{user?.username || '尚未登录'}</span></header><main className="admin-content">
    {!allowed ? <><h1>管理后台</h1><p>{user ? '当前账号尚未验证，或没有后台管理权限。' : '请先登录站主或管理员账号。'}</p>{!user && <button className="primary-button" onClick={onLogin}>登录账号</button>}</> : !sections.some(([id, , enabled]) => id === active && enabled) ? <p>该页面不存在或当前账号没有权限。</p> : <>
      <OwnerReportNotice user={user} route={route} />
      {active === 'members' && <AdminMembers />}{active === 'appearance' && <WallpaperSettings wallpaper={wallpaper} />}{active === 'overview' && <Overview />}{active === 'articles' && <AdminArticles />}{active === 'comments' && <AdminComments />}{active === 'users' && <ManagementPanel user={user} onClose={() => { window.location.hash = '/admin'; }} showBudget={false} />}{active === 'feedback' && <AdminFeedback />}{active === 'quota' && <><h2>额度与用量</h2><p className="muted">这里显示 EmailJS 邮件额度估算与防刷限制，并非现金余额。</p><EmailBudget /></>}{active === 'security' && <LoginReports />}{active === 'content' && <ContentManager />}
    </>}
  </main></div></div>;
}
