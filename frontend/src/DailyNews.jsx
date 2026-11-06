import { useEffect, useRef, useState } from 'react';
import { cachedNews, chinaDate, loadNews } from './news';
export function DailyNews() {
  const [result, setResult] = useState(cachedNews);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  const cooldown = useRef(0);
  async function refresh() {
    if (request.current || Date.now() < cooldown.current) return;
    const controller = new AbortController(); request.current = controller;
    cooldown.current = Date.now() + 30000;
    setBusy(true); setError('');
    try { const value = await loadNews(controller.signal); if (!controller.signal.aborted) setResult(value); }
    catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setBusy(false); } }
  }
  useEffect(() => {
    cooldown.current = 0;
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 1800000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(initial); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); request.current?.abort(); request.current = null; };
  }, []);
  const data = result?.data;
  const today = chinaDate();
  return <section id="daily" className="daily-section feature-section">
    <div className="section-heading"><div><p className="eyebrow">DAILY BRIEF · 片刻看世界</p><h2>每日60s</h2></div><button disabled={busy} onClick={refresh}>{busy ? '正在取报…' : '更新简报 ↻'}</button></div>
    <div className="daily-card"><div className="daily-meta"><span className="feature-badge">{data?.date || today}</span><span>{data ? data.date === today ? '今日简报' : '最近一期 · 尚未取得今日内容' : '每日精选 · 约一分钟阅读'}</span></div>
      {error && <p role="alert" className="notice error">{error}</p>}
      {result?.offline && <p className="notice">网络暂不可用，正在显示本机缓存。请以简报日期为准。</p>}
      {data ? <><ol className="news-list">{data.news.map((item, i) => <li key={data.date + ':' + i}><span>{String(i + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol>{data.tip && <blockquote className="daily-quote">“{data.tip}”</blockquote>}
        <div className="feature-footer"><span>来源：每日60秒 · vikiboss/60s<br />第三方新闻摘要，内容请结合原文核实。</span><div>{data.link && <a href={data.link} target="_blank" rel="noreferrer">查看原文 ↗</a>} <a href="https://github.com/vikiboss/60s" target="_blank" rel="noreferrer">数据项目 ↗</a></div></div></> : <p className="muted">{busy ? '报纸正在路上，请稍候。' : '还没有可显示的简报。'} <a href="https://github.com/vikiboss/60s-static-host" target="_blank" rel="noreferrer">查看数据来源 ↗</a></p>}
    </div>
  </section>;
}
