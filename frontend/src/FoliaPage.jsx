import { useState } from 'react';
import './GithubProjects.css';
const configured = import.meta.env.VITE_FOLIA_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5191/' : '');
function foliaUrl() {
  try { const url = new URL(configured); return !url.username && !url.password && (url.protocol === 'https:' || import.meta.env.DEV && url.hostname === '127.0.0.1' && url.protocol === 'http:') ? url.href : ''; } catch { return ''; }
}
export function FoliaPage() {
  const [started,setStarted] = useState(false); const source = foliaUrl();
  const [connecting,setConnecting] = useState(false);
  const [error,setError] = useState('');
  async function openPlayer() {
    setConnecting(true); setError('');
    try {
      await fetch(source, { mode:'no-cors', credentials:'omit', signal:AbortSignal.timeout(10000) });
      setStarted(true);
    } catch { setError('暂时连不上播放器。请稍后重试，或使用上方“在独立窗口打开”。本地测试请确认启动窗口仍在运行。'); }
    finally { setConnecting(false); }
  }
  return <section className="folia-page"><p className="eyebrow">FOLIA / LYRICS REIMAGINED</p><h1>把音乐，带进小站。</h1><p className="muted">Folia 原版播放器作为独立应用运行，账号与博客分开。可以先使用自己的本地音乐；在线曲库、AI 与同步服务需要另外配置。</p><div className="actions"><a href="https://github.com/chthollyphile/folia-major" target="_blank" rel="noopener noreferrer">上游源码 · AGPL-3.0 ↗</a>{source&&<a href={source} target="_blank" rel="noopener noreferrer">在独立窗口打开 ↗</a>}</div>{source?<>{!started?<div className="paper-card folia-launch"><span aria-hidden="true">♫</span><h2>一首歌的时间</h2><p>打开后会加载独立的 Folia 服务。博客登录凭证不会传入播放器。</p><button className="primary-button" disabled={connecting} onClick={openPlayer}>{connecting ? "正在连接播放器…" : "打开 Folia 播放器 ↗"}</button>{error && <p className="notice error" role="alert">{error}</p>}</div>:<><p className="notice">首次加载可能较慢。若长时间没有出现音乐库，或浏览器阻止嵌入，请使用上方“在独立窗口打开”。</p><iframe className="folia-frame" title="Folia 音乐播放器" src={source} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" allow="autoplay; fullscreen" referrerPolicy="no-referrer"/></>}</>:<div className="paper-card folia-launch"><h2>播放器尚未部署到线上</h2><p>本地接入入口已准备好。正式上线需要部署独立 Folia 服务，再设置 VITE_FOLIA_URL。</p></div>}</section>;
}
