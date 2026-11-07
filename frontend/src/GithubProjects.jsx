import { GithubDescription } from './GithubDescription';
import { useEffect, useState } from 'react';
import { api } from './api';
import './GithubProjects.css';
const categories = { hot: ['近期热门', '近一年创建、近7天更新，按累计 Star 排序。'], emerging: ['新兴项目', '近90天创建、至少30个 Star，按累计 Star 排序。'], classics: ['经典项目', '创建超过3年、至少1万个 Star，近180天仍有更新。'], picks: ['小站精选', '结合小站需求人工筛选，附带接入评估。'] };
const notes = {
  'KnifeLemon/Filee': 'MIT · 桌面软件。完整格式转换需要 .NET 和本机引擎，暂不支持在本页直接运行。',
  'chthollyphile/folia-major': 'AGPL-3.0 · 有网页版，完整音乐服务需独立部署；接入前需要保留许可证和对应源码。',
  'elysia395/dsh-wallpaper-engine': 'MIT · 依赖 DSH 宿主及本地文件服务。浏览器不能直接读取访客电脑上的 Steam 工坊目录。',
  'GoogleChromeLabs/squoosh': 'Apache-2.0 · 适合浏览器图片压缩；可作为后续高级编码方案。',
  'ffmpegwasm/ffmpeg.wasm': '浏览器音视频转换候选。核心和编解码器需分别核对许可，运行还需较大内存与资源下载。',
  'vikiboss/60s': '小站已有每日60s板块，可直接从导航进入。',
};
export function GithubProjects() {
  const [category, setCategory] = useState('hot');
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api('/github-projects?category=' + category).then(value => { if (active) setResult(value); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);
  return <section className="github-page"><div className="github-intro"><p className="eyebrow">OPEN SOURCE / NEW POSSIBILITIES</p><h1>从一颗 Star，<br/>发现新的可能。</h1><p className="muted">逛逛开源世界，也把实用的小工具带回小站。</p><div className="actions"><a className="primary-button" href="#/github-search">搜索 GitHub 项目 ↗</a><a href="#/tools">站内工具箱 →</a><a href="#/folia">Folia 音乐 →</a></div></div>
    <div className="github-tabs" role="group" aria-label="项目分类">{Object.entries(categories).map(([key,[label]]) => <button key={key} aria-pressed={category === key} onClick={() => { if (key !== category) { setCategory(key); setLoading(true); setError(''); setResult(null); } }}>{label}</button>)}</div>
    <p className="muted github-method">{categories[category][1]} Star 表示收藏关注，不等于使用人数或推荐人数；这里也不是 GitHub 官方 Trending 榜单。数据缓存6小时。</p>
    {loading && <p role="status" className="empty">正在翻阅开源项目…</p>}{error && <p role="alert" className="notice error">{error}</p>}
    {result && <><div className="github-source"><span>{result.source === 'github-search' ? 'GitHub 搜索数据' : result.source === 'curated' ? '人工精选快照' : '离线精选快照 · 当前分类排行暂不可用'}</span><time>采集于 {new Date(result.fetchedAt).toLocaleString('zh-CN')}</time></div>{result.stale && <p className="notice">暂时无法更新，以下为{result.source === 'snapshot' ? '人工精选项目，不代表当前分类排名' : '上次成功取得的分类数据'}。</p>}
    <div className="github-grid">{result.items.map((item, index) => <article className="paper-card github-repo" key={item.name}><div className="repo-top"><span className="repo-index">{String(index + 1).padStart(2,'0')}</span><span>{item.language || '多语言'}</span></div><h2><a href={"#/github-repo/" + item.name}>{item.name}<span>→</span></a></h2><GithubDescription key={item.name+item.description} name={item.name} text={item.description} /><div className="repo-numbers"><span>☆ {Number(item.stars).toLocaleString()}</span><span>⑂ {Number(item.forks).toLocaleString()}</span><span>{item.license}</span></div>{notes[item.name] && <p className="repo-note">{notes[item.name]}</p>}</article>)}</div>{!result.items.length && <p className="empty">当前条件下没有找到项目。</p>}</>}
<section className="paper-card tool-project-note"><h2>值得常逛的开源工具合集</h2><p>找现成方案时先从这里开始。合集中的每个项目仍需分别核对许可证与部署要求。</p><div className="github-collections">{[['521xueweihan/HelloGitHub','每月发现有趣、实用的项目'],['awesome-selfhosted/awesome-selfhosted','可自行部署的网站与服务'],['ripienaar/free-for-dev','开发者免费服务额度汇总'],['corentinth/it-tools','浏览器实用工具集合']].map(([name,description])=><a key={name} href={'#/github-repo/'+name}><strong>{name}</strong><span>{description} →</span></a>)}</div></section></section>;
}
