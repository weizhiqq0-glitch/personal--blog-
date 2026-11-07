import { ArticleBody } from './ArticleBody';
import { SiteSearch } from './SiteSearch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthDialog } from './AuthDialog';
import { Icon } from './Icon';
import { BlinkStar } from './BlinkStar';
import { useBlinkFavicon } from './useBlinkFavicon';
import { GithubProjects } from './GithubProjects';
import { GithubSearch, GithubRepo } from './GithubSearch';
import { FoliaPage } from './FoliaPage';
import { Toolbox } from './Toolbox';
import { AdminDashboard } from './AdminDashboard';
import { Members } from './Members';
import { Feedback } from './Feedback';
import { ContentPage } from './ContentPages';
import { contentKinds } from './contentKinds';
import { RadialNav } from './RadialNav';
import './App.css';
import { usePageVisit } from './usePageVisit';
import { useTheme } from './useTheme';
import { SiteStatus } from './SiteStatus';
import { DailyNews } from './DailyNews';
import { Playground } from './Playground';
import { Pet } from './Pet';
import { usePageTitle } from './usePageTitle';
import { UserSettings } from './UserSettings';
import { Avatar } from './Avatar';
import { Wallpaper } from './Wallpaper';
import { usePresence } from './usePresence';
import { useWallpaper } from './useWallpaper';
import { BlogSidebar, BlogRightbar, ArticleArchive } from './BlogSidebars';
import './BlogTheme.css';
import { SettingsDock } from './SettingsDock';
import { CursorExperience, SiteLoader } from './CursorExperience';
const currentRoute = () => { const path = window.location.hash.slice(1) || '/'; return path === '/security' ? '/admin/security' : path === '/appearance' ? '/admin/appearance' : path; };

const date = value => new Date(value).toLocaleString('zh-CN');
export default function App() {
  usePageVisit();
  usePageTitle();
  useBlinkFavicon();
  const { dark, theme, choose } = useTheme();
  const [keyword, setKeyword] = useState('');
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState({ articles: 0, comments: 0, users: 0 });
  const [token, setToken] = useState(() => sessionStorage.getItem('blog-token') || '');
  const [user, setUser] = useState(null);
  const wallpaper = useWallpaper();
  usePresence(user);
  const [authMode, setAuthMode] = useState(null);
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const navigate = () => { setRoute(currentRoute()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const home = !route.startsWith('/') || route === '/';
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const panel = useRef(null);
  const can = permission => user?.permissions?.includes(permission);
  const admin = can('article.manage');
  const staff = !user?.needsContactVerification && ['owner', 'admin'].includes(user?.role);
  const roleNames = { guest: '访客', user: '用户', admin: '管理员', owner: '站主' };
  const [year] = useState(() => new Date().getFullYear());
  const detailId = detail?.id;

  useEffect(() => {
    let active = true;
    Promise.all([api('/articles'), api('/stats')])
      .then(([list, totals]) => { if (active) { setArticles(list); setStats(totals); } })
      .catch(e => { if (active) { setArticles([]); setError(e.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route, token]);
  useEffect(() => {
    let active = true;
    if (token) api('/auth/me', { token }).then(value => { if (active) setUser(value); }).catch(e => {
      if (active) {
        if (e.status === 401) { setToken(''); setUser(null); sessionStorage.removeItem('blog-token'); }
        else setError(e.message);
      }
    });
    return () => { active = false; };
  }, [token, route]);
  useEffect(() => { if (detailId) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [detailId]);

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
  function closePanels() { setDetail(null); setAuthMode(null); setComment(''); }
  async function openArticle(id) {
    await run(async () => {
      const [article, list] = await Promise.all([api('/articles/' + id), api('/articles/' + id + '/comments')]);
      window.location.hash = '/'; closePanels(); setDetail(article); setComments(list);
    });
  }
  function showAuth(mode) { setAuthMode(mode); setError(''); }
  function authenticate(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(async () => {
      const payload = { username: data.get('username'), password: data.get('password'), contactType: 'email', contact: data.get('contact'), code: data.get('code'), verificationId: data.get('verificationId'), entryCode: data.get('entryCode') };
      const path = data.get('ownerLogin') === 'yes' ? '/auth/owner-login' : authMode === 'bind' ? '/auth/contact' : authMode === 'reset' ? '/auth/password/reset' : '/auth/' + (authMode === 'login' && (route.startsWith('/admin') || route === '/management') ? 'staff-login' : authMode);
      const result = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      if (authMode === 'bind') { setUser(result); setAuthMode(null); setMessage('邮箱绑定成功，账号权限已生效'); await refresh(); return; }
      if (authMode === 'reset') { setAuthMode('login'); setMessage(result.message); return; }
      sessionStorage.setItem('blog-token', result.token); setToken(result.token); setUser(result.user);
      setAuthMode(result.user.needsContactVerification ? 'bind' : null); setMessage('登录成功，欢迎 ' + result.user.username); await refresh();
    });
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
  const settingsProps = { user, theme, choose,
    onAvatarUpdated: version => setUser(current => current ? { ...current, avatarVersion: version } : current),
    onSaved: text => { sessionStorage.removeItem('blog-token'); setToken(''); setUser(null); setMessage(text); showAuth('login'); }
  };
  const visible = articles.filter(a => [a.title, a.summary, ...a.tags].join(' ').toLowerCase().includes(keyword.trim().toLowerCase()));
  if (route.startsWith('/admin') || route === '/management') return <div className={dark ? 'page dark' : 'page'}>
    <AdminDashboard user={user} route={route} wallpaper={wallpaper} onLogin={() => showAuth('login')} />
    <RadialNav route={route} />
    <SettingsDock key={route} {...settingsProps} />
    {authMode && <AuthDialog key={authMode} mode={authMode} staffOnly={route.startsWith('/admin') || route === '/management'} busy={busy} error={error} onClose={() => { setAuthMode(null); setError(''); }} onModeChange={showAuth} onSubmit={authenticate} />}
  </div>;
  return (
    <main className={(dark ? 'page dark' : 'page') + (wallpaper.source ? ' has-wallpaper' : '')}>
      <Wallpaper wallpaper={wallpaper} />
      {!introDone && <SiteLoader loading={loading} onDone={finishIntro} />}
      <div className={'layout' + (introDone ? ' startup-reveal' : '')} inert={!introDone}>
        <header className="topbar">
          <a className="brand" href="#/" onClick={closePanels}><span className="brand-mark"><BlinkStar /></span><span>mowu的小站</span></a>
          <nav>
            <a href="#/" onClick={closePanels}>首页</a><a href="#/archive" onClick={closePanels}>文章归档</a><a href="#/search" onClick={closePanels}>搜索</a>
            <a className="feature-nav" href="#/daily" onClick={closePanels}>每日60s</a>
            <a className="feature-nav" href="#/playground" onClick={closePanels}>游乐场</a>
            <a className="feature-nav" href="#/experience" onClick={closePanels}>动效体验</a>
            <a className="feature-nav" href="#/github" onClick={closePanels}>GitHub</a><a href="#/members" onClick={closePanels}>站员</a><a href="#/feedback" onClick={closePanels}>问题反馈</a>
            {user ? <><span className="account"><Avatar id={user.id} name={user.username} version={user.avatarVersion} />{user.username} · {roleNames[user.role]}</span>{staff && <a className="admin-entry" href="#/admin" onClick={closePanels}>管理后台 ↗</a>}<button disabled={busy} onClick={() => run(async () => {
              try { await api('/auth/logout', { token, method: 'POST' }); } catch (e) { if (e.status !== 401) throw e; }
              sessionStorage.removeItem('blog-token'); setToken(''); setUser(null); setMessage('已退出登录');
            })}>退出</button></> : <><button className="nav-login" disabled={busy} onClick={() => showAuth('login')}><Icon name="user" size={16} />登录</button><button className="nav-register" disabled={busy} onClick={() => showAuth('register')}>加入小站 <span>↗</span></button></>}
            <button className="icon-button" aria-label={dark ? '切换日间模式' : '切换夜间模式'} onClick={() => choose(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} /></button>
            <select className="theme-select" aria-label="主题模式" value={theme} onChange={e => choose(e.target.value)}><option value="auto">随时间切换</option><option value="light">始终日间</option><option value="dark">始终夜间</option></select>
          </nav>
        </header>
        {error && !authMode && <div className="notice error" role="alert">{error}<button disabled={busy} onClick={() => run(refresh)}>重新连接</button></div>}
        {message && <div className="notice" role="status">{message}</div>}
        {user?.needsContactVerification && <div className="notice">账号需要先验证邮箱才能启用操作权限。<button onClick={() => showAuth('bind')}>绑定邮箱</button></div>}
        {home && <><section className="hero-card">
          <div className="hero-copy"><p className="eyebrow"><span className="tiny-dot" /> 一隅小站 · 一点日常</p><h1>淡淡的，<br />就会<span className="heading-accent">顺顺的。</span></h1><p className="intro">收集生活的细碎，记录成长的轨迹。<br />愿这里的文字，也能陪你度过一小段时光。</p><a className="primary-button" href="#articles" onClick={closePanels}>翻开我的日常 <Icon name="arrow" size={17} /></a></div>
          <div className="hero-visual" aria-hidden="true"><div className="visual-label"><span className="tiny-dot" /> 此刻，刚刚好</div><div className="hero-sun" /><div className="hero-mountain mountain-back" /><div className="hero-mountain mountain-front" /><div className="hero-visual-caption"><span>把日子写成诗</span><span>✦</span></div></div>
        </section>
        <section className="stats-row"><div><strong>{stats.articles}</strong><span>文章</span></div><div><strong>{stats.comments}</strong><span>评论</span></div><div><strong>{stats.users}</strong><span>成员</span></div><div><strong>2026</strong><span>开始写作</span></div></section>
        </>}
        <div ref={panel} className="panel-anchor" />
        {authMode && <AuthDialog key={authMode} mode={authMode} busy={busy} error={error} onClose={() => { setAuthMode(null); setError(''); }} onModeChange={showAuth} onSubmit={authenticate} initialEmail={authMode === 'bind' ? user?.contact?.value || '' : ''} />}
        {route === '/search' && <SiteSearch openArticle={openArticle} />}{route === '/settings' && <UserSettings user={user} onAvatarUpdated={version => setUser(current => ({ ...current, avatarVersion: version }))} theme={theme} choose={choose} onSaved={text => { sessionStorage.removeItem('blog-token'); setToken(''); setUser(null); setMessage(text); showAuth('login'); }} />}
        {route === '/github' && <GithubProjects />}
        {route === '/github-search' && <GithubSearch />}
        {route.startsWith('/github-repo/') && <GithubRepo key={route} name={route.slice('/github-repo/'.length)} />}
        {route === '/folia' && <FoliaPage />}
        {route === '/tools' && <Toolbox />}
        {route === '/experience' && <CursorExperience />}
        {route === '/members' && <Members user={user} />}
        {route === '/feedback' && <Feedback key={user?.id || 'guest'} user={user} onLogin={() => showAuth('login')} />}
        {Object.hasOwn(contentKinds, route.slice(1)) && <ContentPage key={route} kind={route.slice(1)} />}
        {(route === '/archive' || route.startsWith('/tags/')) && <ArticleArchive articles={articles} tag={route.startsWith('/tags/') ? (() => { try { return decodeURIComponent(route.slice(6)); } catch { return ''; } })() : ''} openArticle={openArticle} />}
        {home && <>
        {detail && <section className="article-card panel">
          <button className="read-button" onClick={() => setDetail(null)}>← 返回文章列表</button>
          <p className="article-date">{detail.author} · {date(detail.created_at)}</p><h2>{detail.title}</h2><div className="tags">{detail.tags.map(t => <span key={t}>#{t}</span>)}</div>
          <ArticleBody content={detail.content} />
          <section className="comment-section"><h3>评论 · {comments.length}</h3>
            {can('comment.create') ? <form onSubmit={postComment}><label>发表你的评论<textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} required placeholder="友善交流，分享你的想法" /></label><button className="primary-button" disabled={busy}>发表评论</button></form> : <p className="muted">{user ? '请完成邮箱绑定；若已绑定，则当前账号暂未开放评论权限。' : '登录后即可参与讨论。'}{!user && <button onClick={() => showAuth('login')}>去登录</button>}</p>}
            {!comments.length && <p className="muted">还没有评论，来分享第一个想法吧。</p>}
            {comments.map(c => <article key={c.id} className="comment"><div className="comment-heading"><Avatar id={c.user_id} name={c.username} version={c.user_id === user?.id ? user.avatarVersion : 0} /><strong>{c.username}{['owner', 'admin'].includes(c.role) ? ' · ' + roleNames[c.role] : ''}</strong><span>{date(c.created_at)}</span></div><p>{c.content}</p>{(can('comment.moderate') || c.user_id === user?.id) && <button className="read-button danger" disabled={busy} onClick={() => removeComment(c.id)}>删除评论</button>}</article>)}
          </section>
        </section>}
        <div className="blog-columns"><BlogSidebar articles={articles} stats={stats} user={user} /><section id="articles"><div className="section-heading"><div><p className="eyebrow">最新记录</p><h2>最近写了什么</h2></div><label className="search"><Icon name="search" size={18} /><input aria-label="搜索文章或标签" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索文章或标签" /></label></div>
          {loading ? <p className="empty">正在加载文章…</p> : <><div className="article-grid">{visible.map(a => <article key={a.id} className="article-card"><div className="article-icon"><Icon name="book" size={24} /></div><p className="article-date">{date(a.created_at)} · {a.comment_count}条评论</p><h3>{a.title}</h3><p className="article-summary">{a.summary}</p><div className="article-footer"><div className="tags">{a.tags.map(t => <span key={t}>#{t}</span>)}</div><button className="read-button" disabled={busy} onClick={() => openArticle(a.id)}>阅读 →</button></div></article>)}</div>{!visible.length && !error && <div className="empty"><span className="empty-icon"><Icon name="book" size={32} /></span><h3>{keyword ? '没有找到这篇故事' : '故事，从这里开始'}</h3><p>{keyword ? '换个词试试，或许会有新的发现。' : '第一篇文章正在酝酿，值得记录的日子都不必着急。'}</p>{admin && !keyword && <button className="read-button" onClick={() => { window.location.hash = '/admin/articles'; }}>写下第一篇文章 →</button>}</div>}</>}
        </section><BlogRightbar articles={articles} openArticle={openArticle} /></div>
        </>}
        {route === '/daily' && <DailyNews />}
        {route === '/playground' && <Playground />}
        <SiteStatus />
        <footer>© {year} mowu的小站 · 用心记录每一天</footer>
      </div>
      {introDone && <SettingsDock key={route} {...settingsProps} />}
      {introDone && <RadialNav route={route} />}
      <Pet hidden={!!authMode || ['/experience', '/settings', '/security', '/management', '/appearance'].includes(route)} />
    </main>
  );
}
