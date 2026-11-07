import { useEffect, useState } from 'react';
import { api } from './api';
import './GithubProjects.css';
export function GithubSearch() {
  const [keyword,setKeyword] = useState(''); const [query,setQuery] = useState(null); const [result,setResult] = useState(null);
  const [loading,setLoading] = useState(false); const [error,setError] = useState('');
  useEffect(() => {
    if (!query) return;
    let active = true;
    api('/github-search?q=' + encodeURIComponent(query.q) + '&page=' + query.page).then(set => { if (active) setResult(set); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);
  function search(q,page = 1) { if (!q.trim()) return; setQuery({q:q.trim(),page});setLoading(true);setError('');setResult(null); }
  return <section className="github-page"><p className="eyebrow">GITHUB / FIND SOMETHING USEFUL</p><h1>找一个，刚好用得上的项目。</h1><p className="muted">通过小站查询公开仓库与 README，无需先打开 GitHub。这里只提供公开资料浏览，不是完整 Git 镜像或文件下载代理。</p><form className="github-search-form" onSubmit={e => { e.preventDefault();search(keyword); }}><label>项目名称或关键词<input value={keyword} maxLength={100} onChange={e=>setKeyword(e.target.value)} placeholder="例如：file converter、folia、wallpaper" required/></label><button className="primary-button" disabled={loading}>{loading?'搜索中…':'搜索项目 ↗'}</button></form><div className="github-quick">{['Filee','Folia','wallpaper','selfhosted','it-tools'].map(q=><button key={q} disabled={loading} onClick={()=>{setKeyword(q);search(q);}}>{q}</button>)}</div>{error&&<p className="notice error" role="alert">{error}</p>}{loading&&<p role="status">正在查询 GitHub，请稍候…</p>}{result&&<><p className="muted">找到约 {result.total.toLocaleString()} 个结果，按累计 Star 排序{result.incomplete?' · GitHub 返回的搜索结果不完整':''}。</p><div className="github-grid">{result.items.map(item=><article className="paper-card github-repo" key={item.name}><div className="repo-top"><span>{item.language||'多语言'}</span><span>☆ {item.stars.toLocaleString()}</span></div><h2><a href={'#/github-repo/'+item.name}>{item.name}<span>→</span></a></h2><p>{item.description}</p><div className="repo-numbers"><span>{item.license}</span><a href={'#/github-repo/'+item.name}>站内查看说明 →</a></div></article>)}</div>{!result.items.length&&<p className="empty">没有找到，试试英文名称或更短的关键词。</p>}<div className="actions github-pagination"><button disabled={loading||result.page===1} onClick={()=>search(query.q,result.page-1)}>上一页</button><span>第 {result.page} 页</span><button disabled={loading||result.items.length<12||result.page>=20||result.page*12>=result.total} onClick={()=>search(query.q,result.page+1)}>下一页</button></div></>}</section>;
}
export function GithubRepo({name}) {
  const [repo,setRepo]=useState(null);const [error,setError]=useState('');
  useEffect(()=>{let active=true;api('/github-repo?name='+encodeURIComponent(name)).then(value=>{if(active)setRepo(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[name]);
  return <section className="github-page"><a href="#/github-search">← 返回搜索</a>{error?<p className="notice error" role="alert">{error}</p>:!repo?<p role="status">正在打开项目说明…</p>:<><p className="eyebrow">PUBLIC REPOSITORY</p><h1 className="repo-title">{repo.name}</h1><p>{repo.description}</p><div className="repo-numbers"><span>☆ {repo.stars.toLocaleString()}</span><span>{repo.language}</span><span>{repo.license}</span><a href={repo.url} target="_blank" rel="noopener noreferrer">原仓库 ↗</a></div><section className="paper-card repo-readme"><h2>README</h2><p className="muted">以原始 Markdown 文本展示，不执行仓库中的 HTML 或脚本，也不加载外部图片。使用或修改项目之前，请核对其许可证。</p>{repo.readmeUnavailable?<p>暂时无法读取 README，请访问原仓库查看。</p>:<pre>{repo.readme}</pre>}</section></>}</section>;
}
