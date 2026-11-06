import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthDialog } from './AuthDialog';
import { Icon } from './Icon';
import { ManagementPanel } from './ManagementPanel';
import './App.css';
import { usePageVisit } from './usePageVisit';
import { useTheme } from './useTheme';
import { SiteStatus } from './SiteStatus';

const date = value => new Date(value).toLocaleString('zh-CN');
const initialDraft = { title: '', content: '', tags: '' };
export default function App() {
  usePageVisit();
  const { dark, theme, choose } = useTheme();
  const [keyword, setKeyword] = useState('');
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState({ articles: 0, comments: 0, users: 0 });
  const [token, setToken] = useState(() => sessionStorage.getItem('blog-token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [management, setManagement] = useState(false);
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const panel = useRef(null);
  const can = permission => user?.permissions?.includes(permission);
  const admin = can('article.manage');
  const canManage = !user?.needsContactVerification && (user?.role === 'owner' || can('user.ban') || can('visitor.ban'));
  const roleNames = { guest: '访客', user: '用户', admin: '管理员', owner: '站主' };
  const [year] = useState(() => new Date().getFullYear());
  const detailId = detail?.id;

  useEffect(() => {
    let active = true;
    Promise.all([api('/articles'), api('/stats')])
      .then(([list, totals]) => { if (active) { setArticles(list); setStats(totals); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (token) api('/auth/me', { token }).then(value => { if (active) setUser(value); }).catch(e => {
      if (active) {
        if (e.status === 401) { setToken(''); setUser(null); sessionStorage.removeItem('blog-token'); }
        else setError(e.message);
      }
    });
    return () => { active = false; };
  }, [token]);
  useEffect(() => { if (editing || detailId) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editing, detailId]);

  async function refresh() {
    const [list, totals] = await Promise.all([api('/articles'), api('/stats')]);
    setArticles(list); setStats(totals);
  }
  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  function closePanels() { setDetail(null); setEditing(false); setManagement(false); setAuthMode(null); setComment(''); }
  async function openArticle(id) {
    await run(async () => {
      const [article, list] = await Promise.all([api('/articles/' + id), api('/articles/' + id + '/comments')]);
      closePanels(); setDetail(article); setComments(list);
    });
  }
  function writeArticle(article = null) {
    closePanels(); setEditId(article?.id || null);
    setDraft(article ? { title: article.title, content: article.content, tags: article.tags.join('，') } : initialDraft);
    setEditing(true);
  }
  function showAuth(mode) { setAuthMode(mode); setError(''); }
  function authenticate(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(async () => {
      const payload = { username: data.get('username'), password: data.get('password'), contactType: 'email', contact: data.get('contact'), code: data.get('code'), verificationId: data.get('verificationId') };
      const path = authMode === 'bind' ? '/auth/contact' : authMode === 'reset' ? '/auth/password/reset' : '/auth/' + authMode;
      const result = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      if (authMode === 'bind') { setUser(result); setAuthMode(null); setMessage('邮箱绑定成功，账号权限已生效'); await refresh(); return; }
      if (authMode === 'reset') { setAuthMode('login'); setMessage(result.message); return; }
      sessionStorage.setItem('blog-token', result.token); setToken(result.token); setUser(result.user);
      setAuthMode(result.user.needsContactVerification ? 'bind' : null); setMessage('登录成功，欢迎 ' + result.user.username); await refresh();
    });
  }
  function saveArticle(event) {
    event.preventDefault();
    run(async () => {
      const article = await api('/articles' + (editId ? '/' + editId : ''), {
        token, method: editId ? 'PUT' : 'POST', body: JSON.stringify({ ...draft, tags: draft.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) }),
      });
      setEditing(false); setDetail(article); setComments(await api('/articles/' + article.id + '/comments'));
      setMessage('文章已保存'); await refresh();
    });
  }
  async function removeArticle() {
    if (!window.confirm('确定删除这篇文章及其所有评论吗？此操作无法撤销。')) return;
    await run(async () => { await api('/articles/' + detail.id, { token, method: 'DELETE' }); setDetail(null); setMessage('文章已删除'); await refresh(); });
  }
  function postComment(event) {
    event.preventDefault();
    run(async () => {
      await api('/articles/' + detail.id + '/comments', { token, method: 'POST', body: JSON.stringify({ content: comment }) });
      setComment(''); setComments(await api('/articles/' + detail.id + '/comments')); await refresh(); setMessage('评论已发表');
    });
  }
  function removeComment(id) {
    if (!window.confirm('确定删除这条评论吗？')) return;
    run(async () => { await api('/comments/' + id, { token, method: 'DELETE' }); setComments(await api('/articles/' + detail.id + '/comments')); await refresh(); });
  }
  const visible = articles.filter(a => [a.title, a.summary, ...a.tags].join(' ').toLowerCase().includes(keyword.trim().toLowerCase()));
  return (
    <main className={dark ? 'page dark' : 'page'}>
      <div className="layout">
        <header className="topbar">
          <a className="brand" href="#" onClick={closePanels}><span className="brand-mark">✦</span><span>我的小站</span></a>
          <nav>
            <a href="#articles" onClick={closePanels}>文章</a>
            {user ? <><span className="account">{user.username} · {roleNames[user.role]}</span>{admin && <button disabled={busy} onClick={() => writeArticle()}>写文章</button>}{canManage && <button disabled={busy} onClick={() => { closePanels(); setManagement(true); }}>账号管理</button>}<button disabled={busy} onClick={() => run(async () => {
              try { await api('/auth/logout', { token, method: 'POST' }); } catch (e) { if (e.status !== 401) throw e; }
              sessionStorage.removeItem('blog-token'); setToken(''); setUser(null); setEditing(false); setManagement(false); setMessage('已退出登录');
            })}>退出</button></> : <><button className="nav-login" disabled={busy} onClick={() => showAuth('login')}><Icon name="user" size={16} />登录</button><button className="nav-register" disabled={busy} onClick={() => showAuth('register')}>加入小站 <span>↗</span></button></>}
            <button className="icon-button" aria-label={dark ? '切换日间模式' : '切换夜间模式'} onClick={() => choose(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} /></button>
            <select className="theme-select" aria-label="主题模式" value={theme} onChange={e => choose(e.target.value)}><option value="auto">随时间切换</option><option value="light">始终日间</option><option value="dark">始终夜间</option></select>
          </nav>
        </header>
        {error && !authMode && <div className="notice error" role="alert">{error}<button disabled={busy} onClick={() => run(refresh)}>重新连接</button></div>}
        {message && <div className="notice" role="status">{message}</div>}
        {user?.needsContactVerification && <div className="notice">账号需要先验证邮箱才能启用操作权限。<button onClick={() => showAuth('bind')}>绑定邮箱</button></div>}
        <section className="hero-card">
          <div className="hero-copy"><p className="eyebrow"><span className="tiny-dot" /> 一隅小站 · 一点日常</p><h1>淡淡的，<br />就会<span className="heading-accent">顺顺的。</span></h1><p className="intro">收集生活的细碎，记录成长的轨迹。<br />愿这里的文字，也能陪你度过一小段时光。</p><a className="primary-button" href="#articles" onClick={closePanels}>翻开我的日常 <Icon name="arrow" size={17} /></a></div>
          <div className="hero-visual" aria-hidden="true"><div className="visual-label"><span className="tiny-dot" /> 此刻，刚刚好</div><div className="hero-sun" /><div className="hero-mountain mountain-back" /><div className="hero-mountain mountain-front" /><div className="hero-visual-caption"><span>把日子写成诗</span><span>✦</span></div></div>
        </section>
        <section className="stats-row"><div><strong>{stats.articles}</strong><span>文章</span></div><div><strong>{stats.comments}</strong><span>评论</span></div><div><strong>{stats.users}</strong><span>成员</span></div><div><strong>2026</strong><span>开始写作</span></div></section>
        <div ref={panel} className="panel-anchor" />
        {authMode && <AuthDialog key={authMode} mode={authMode} busy={busy} error={error} onClose={() => { setAuthMode(null); setError(''); }} onModeChange={showAuth} onSubmit={authenticate} initialEmail={authMode === 'bind' ? user?.contact?.value || '' : ''} />}
        {management && canManage && <ManagementPanel user={user} onClose={() => setManagement(false)} />}
        {editing && admin && <section className="article-card panel"><h2>{editId ? '编辑文章' : '发布新文章'}</h2><form onSubmit={saveArticle}>
          <label>标题<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required maxLength={120} /></label>
          <label>标签<input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="用逗号分隔，最多8个" /></label>
          <label>正文<textarea className="editor" value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} required maxLength={50000} placeholder="写下你的故事…" /></label>
          <div className="actions"><button className="primary-button" disabled={busy}>{busy ? '保存中…' : '保存并发布'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>取消</button></div>
        </form></section>}
        {detail && !editing && <section className="article-card panel">
          <button className="read-button" onClick={() => setDetail(null)}>← 返回文章列表</button>
          <p className="article-date">{detail.author} · {date(detail.created_at)}</p><h2>{detail.title}</h2><div className="tags">{detail.tags.map(t => <span key={t}>#{t}</span>)}</div>
          <div className="article-body">{detail.content}</div>
          {admin && <div className="actions"><button disabled={busy} onClick={() => writeArticle(detail)}>编辑文章</button><button className="danger" disabled={busy} onClick={removeArticle}>删除文章</button></div>}
          <section className="comment-section"><h3>评论 · {comments.length}</h3>
            {can('comment.create') ? <form onSubmit={postComment}><label>发表你的评论<textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} required placeholder="友善交流，分享你的想法" /></label><button className="primary-button" disabled={busy}>发表评论</button></form> : <p className="muted">{user ? '请完成邮箱绑定；若已绑定，则当前账号暂未开放评论权限。' : '登录后即可参与讨论。'}{!user && <button onClick={() => showAuth('login')}>去登录</button>}</p>}
            {!comments.length && <p className="muted">还没有评论，来分享第一个想法吧。</p>}
            {comments.map(c => <article key={c.id} className="comment"><div className="comment-heading"><strong>{c.username}{['owner', 'admin'].includes(c.role) ? ' · ' + roleNames[c.role] : ''}</strong><span>{date(c.created_at)}</span></div><p>{c.content}</p>{(can('comment.moderate') || c.user_id === user?.id) && <button className="read-button danger" disabled={busy} onClick={() => removeComment(c.id)}>删除评论</button>}</article>)}
          </section>
        </section>}
        <section id="articles"><div className="section-heading"><div><p className="eyebrow">最新记录</p><h2>最近写了什么</h2></div><label className="search"><Icon name="search" size={18} /><input aria-label="搜索文章或标签" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索文章或标签" /></label></div>
          {loading ? <p className="empty">正在加载文章…</p> : <><div className="article-grid">{visible.map(a => <article key={a.id} className="article-card"><div className="article-icon"><Icon name="book" size={24} /></div><p className="article-date">{date(a.created_at)} · {a.comment_count}条评论</p><h3>{a.title}</h3><p className="article-summary">{a.summary}</p><div className="article-footer"><div className="tags">{a.tags.map(t => <span key={t}>#{t}</span>)}</div><button className="read-button" disabled={busy} onClick={() => openArticle(a.id)}>阅读 →</button></div></article>)}</div>{!visible.length && !error && <div className="empty"><span className="empty-icon"><Icon name="book" size={32} /></span><h3>{keyword ? '没有找到这篇故事' : '故事，从这里开始'}</h3><p>{keyword ? '换个词试试，或许会有新的发现。' : '第一篇文章正在酝酿，值得记录的日子都不必着急。'}</p>{admin && !keyword && <button className="read-button" onClick={() => writeArticle()}>写下第一篇文章 →</button>}</div>}</>}
        </section>
        <SiteStatus />
        <footer>© {year} 我的小站 · 用心记录每一天</footer>
      </div>
    </main>
  );
}
