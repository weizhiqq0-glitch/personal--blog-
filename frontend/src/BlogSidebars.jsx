import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { contentKinds } from './contentKinds';

export function BlogSidebar({ articles, stats, user }) {
  const [owner, setOwner] = useState(null);
  useEffect(() => {
    let active = true;
    api('/site-profile').then(value => { if (active) setOwner(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const tags = [...new Set(articles.flatMap(article => article.tags))].slice(0, 12);
  return <aside className="blog-sidebar">
    <section className="paper-card profile-card"><span className="paper-tape" aria-hidden="true" /><Avatar id={owner?.id} name={owner?.username || 'mowu'} version={user?.role === 'owner' ? user.avatarVersion : 0} size={88} /><p className="eyebrow">A SMALL CORNER OF THE WORLD</p><h2>mowu</h2><p className="muted">把日常写成故事，<br />把热爱留在这里。</p><div className="profile-counts"><a href="#/archive"><strong>{stats.articles}</strong><span>文章</span></a><div><strong>{stats.comments}</strong><span>评论</span></div><div><strong>{tags.length}</strong><span>标签</span></div></div><a className="profile-github" href="https://github.com/weizhiqq0-glitch/personal--blog-" target="_blank" rel="noopener noreferrer">GitHub · 小站源码 ↗</a></section>
    <section className="paper-card sidebar-tags"><h3>⌑ 标签手记</h3><div className="tags">{tags.map(tag => <a href={'#/tags/' + encodeURIComponent(tag)} key={tag}>#{tag}</a>)}</div>{!tags.length && <p className="muted">写下第一篇文章后，标签会出现在这里。</p>}<a className="read-button" href="#/archive">查看文章归档 →</a></section>
  </aside>;
}
export function BlogRightbar({ articles, openArticle }) {
  return <aside className="blog-rightbar"><section className="paper-card postcard"><span className="paper-tape" aria-hidden="true" /><div className="postcard-landscape" aria-hidden="true"><span className="postcard-sun" /><span className="postcard-ridge" /></div><p className="eyebrow">DEAR VISITOR</p><h2>遇见，即是好天气。</h2><p className="muted">在文字与生活之间，<br />给自己留一点空白。</p></section>
    <section className="paper-card feature-directory"><h3>✦ 小站漫游</h3><a href="#/daily"><span>每日60s</span><small>给世界留一分钟 ↗</small></a><a href="#/playground"><span>游乐场</span><small>去找一点新鲜感 ↗</small></a><a href="#/experience"><span>动效体验</span><small>和色彩一起游动 ↗</small></a><a href="#/appearance"><span>我的壁纸</span><small>换一片自己的风景 ↗</small></a></section>
    <section className="paper-card module-links"><h3>⌘ 更多空间</h3><a href="#/members">站员<span>↗</span></a>{Object.entries(contentKinds).map(([key, config]) => <a key={key} href={'#/' + key}>{config.title}<span>↗</span></a>)}</section>
    {!!articles.length && <section className="paper-card"><h3>最近的故事</h3>{articles.slice(0, 4).map(article => <button className="sidebar-article" key={article.id} onClick={() => openArticle(article.id)}>{article.title}<span>↗</span></button>)}</section>}
  </aside>;
}
export function ArticleArchive({ articles, tag, openArticle }) {
  const list = tag ? articles.filter(article => article.tags.includes(tag)) : articles;
  const groups = Object.groupBy(list, article => new Date(article.created_at).getFullYear());
  return <section className="article-card panel archive-page"><p className="eyebrow">COLLECTED DAYS</p><h1>{tag ? '#' + tag : '文章归档'}</h1><p className="muted">共 {list.length} 篇记录，都是认真生活的痕迹。</p>{Object.entries(groups).reverse().map(([year, values]) => <section key={year}><h2>{year}</h2>{values.map(article => <button className="archive-row" key={article.id} onClick={() => openArticle(article.id)}><time>{new Date(article.created_at).toLocaleDateString('zh-CN')}</time><strong>{article.title}</strong><span>阅读 →</span></button>)}</section>)}{!list.length && <p className="empty">这里的故事，等待你来写。</p>}</section>;
}
