import { useEffect, useState } from 'react';
import { api } from './api';
import { contentKinds } from './contentKinds';
import './SiteSearch.css';
const pages=[['/','首页'],['/archive','文章归档'],['/daily','每日60s 新闻'],['/github','GitHub 开源精选'],['/github-search','GitHub 仓库搜索'],['/tools','工具箱 文件转换'],['/folia','Folia 音乐播放器 歌词'],['/members','站员'],['/feedback','问题反馈'],['/settings','用户设置 头像 密码'],['/playground','游乐场 AI游戏'],...Object.entries(contentKinds).map(([key,value])=>['/'+key,value.title])];
export function SiteSearch({ openArticle }) {
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const q=query.trim().toLowerCase();
  useEffect(()=>{let active=true;if(!q)return()=>{active=false;};const timer=setTimeout(async()=>{setBusy(true);setMessage('');try{const data=await api('/search?q='+encodeURIComponent(q));if(active)setResults([...data.articles.map(item=>({...item,key:'article-'+item.id,type:'文章'})),...data.content.map(item=>({key:item.item_key,title:item.title,summary:item.content.slice(0,160),path:'/'+item.kind,type:contentKinds[item.kind]?.title||'板块'}))]);}catch(e){if(active){setResults([]);setMessage(e.message);}}finally{if(active)setBusy(false);}},350);return()=>{active=false;clearTimeout(timer);};},[q]);
  const links=q?pages.filter(([,name])=>name.toLowerCase().includes(q)):pages;
  return <section className="article-card panel site-search"><p className="eyebrow">FIND SOMETHING YOU LOVE</p><h1>搜索小站</h1><p className="muted">找文章、标签、照片描述、板块内容，或直接跳转到需要的功能。</p><label>想找什么？<input type="search" value={query} maxLength={80} onChange={e=>{setQuery(e.target.value);setResults([]);setMessage('');setBusy(!!e.target.value.trim());}} placeholder="例如：生活、音乐、头像…" /></label><h2>{q?'相关页面':'快捷前往'}</h2><div className="search-shortcuts">{links.map(([path,name])=><a key={path} href={'#'+path}>{name} ↗</a>)}</div>{q&&<><h2>站内内容</h2>{busy&&<p role="status">正在搜索…</p>}{message&&<p role="status" className="notice">{message}</p>}{results.map(item=><article className="site-search-result" key={item.key}><small>{item.type}</small><h3>{item.id?<button onClick={()=>openArticle(item.id)}>{item.title}</button>:<a href={'#'+item.path}>{item.title}</a>}</h3><p>{item.summary}</p></article>)}{!busy&&!message&&!results.length&&<p>没有找到匹配内容，换个关键词试试。</p>}</>}</section>;
}
