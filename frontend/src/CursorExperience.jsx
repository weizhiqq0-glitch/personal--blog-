import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import './CursorExperience.css';

const colors = ['#ff719c', '#89a9ff', '#ffd875', '#75dfba', '#bd8bff', '#ffac78', '#6fdcf1', '#fb93dc'];
function Cursor({ color }) {
  return <svg viewBox="0 0 28 34" aria-hidden="true"><path d="M3 2L23 20L14 21L10 30Z" fill={color} stroke="white" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function TypedText({ text, active, instant }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || instant) return;
    let value = 0;
    const timer = setInterval(() => { value += 2; setCount(value); if (value >= text.length) clearInterval(timer); }, 24);
    return () => clearInterval(timer);
  }, [active, instant, text]);
  return <><span className="sr-only">{text}</span><span aria-hidden="true">{active ? instant ? text : text.slice(0, count) : ''}<i className="typing-caret" /></span></>;
}
function ExperienceRun({ reduced }) {
  const [phase, setPhase] = useState('loading');
  const [shown, setShown] = useState(-1);
  const [instant, setInstant] = useState(reduced);
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState('');
  const stage = useRef(null);
  useEffect(() => {
    const abort = new AbortController();
    const lifecycle = { active: true };
    const started = Date.now();
    let timer;
    const timeout = setTimeout(() => abort.abort(), 8000);
    api('/articles', { signal: abort.signal }).then(value => { if (lifecycle.active) setArticles(value.slice(0, 3)); })
      .catch(() => { if (lifecycle.active) setError('文章暂时加载失败，下面展示动效示例。'); })
      .finally(() => { clearTimeout(timeout); if (lifecycle.active) timer = setTimeout(() => setPhase('revealing'), reduced ? 0 : Math.max(0, 1600 - (Date.now() - started))); });
    return () => { lifecycle.active = false; clearTimeout(timeout); clearTimeout(timer); abort.abort(); };
  }, [reduced]);
  useEffect(() => {
    if (phase !== 'revealing' || instant) return;
    let index = 0;
    const first = setTimeout(() => setShown(0), 0);
    const timer = setInterval(() => { index++; setShown(index); if (index >= 2) clearInterval(timer); }, 1700);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [phase, instant]);
  function skip() { setInstant(true); setPhase('revealing'); }
  const cards = articles.length ? articles.map(article => ({ title: article.title, text: article.summary })) : [
    { title: '你好，欢迎来到 mowu 的小站', text: '让五颜六色的光标一起，把这页日常慢慢写出来。' },
    { title: '把想法变成文字', text: '加载完成后，光标逐一框出内容，文字像正在输入一样浮现。' },
    { title: '接下来，交给你探索', text: '这是独立的动效体验页。你可以重播，也可以随时跳过。' },
  ];
  return <div ref={stage} className={'cursor-stage ' + (phase === 'loading' && !instant ? 'is-loading' : 'is-ready')} onPointerMove={event => {
    if (event.pointerType === 'touch') return;
    const box = event.currentTarget.getBoundingClientRect();
    stage.current.style.setProperty('--pointer-x', Math.min(box.width - 70, Math.max(70, event.clientX - box.left)) + 'px');
    stage.current.style.setProperty('--pointer-y', Math.min(box.height - 70, Math.max(70, event.clientY - box.top)) + 'px');
  }}>
    <div className="cursor-stage-top"><span>mowu / creative loading</span><button onClick={skip}>跳过动画 →</button></div>
    <div className="cursor-orbit" aria-hidden="true">{colors.map((color, index) => <span key={color} style={{ '--angle': index * 45 + 'deg', '--color': color }}><Cursor color={color} /></span>)}</div>
    {phase === 'loading' && !instant ? <div className="cursor-loading" role="status"><span>一点灵感，正在汇合</span><h2>正在翻开这一页</h2><p>移动鼠标，让色彩跟着你。</p><div className="cursor-progress" /></div> : <div className="cursor-reveal-grid">{cards.map((card, index) => <article className={'cursor-reveal-card ' + (instant || shown >= index ? 'revealed' : '')} key={index} style={{ '--card-color': colors[index * 2] }}>
      <div className="selection-cursor"><Cursor color={colors[index * 2]} /><span>cursor {index + 1}</span></div>
      <span className="cursor-card-number">0{index + 1}</span><h2><TypedText text={card.title} active={instant || shown >= index} instant={instant} /></h2><p><TypedText text={card.text} active={instant || shown >= index} instant={instant} /></p>
    </article>)}</div>}
    {error && <p className="cursor-source-note" role="status">{error}</p>}
  </div>;
}
export function CursorExperience() {
  const [run, setRun] = useState(0);
  const [reduced, setReduced] = useState(() => localStorage.getItem('mowu-reduce-animation') === 'yes' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return <section className="experience-page"><p className="eyebrow">PLAY WITH COLOR</p><div className="section-heading"><div><h1>让灵感，有迹可循。</h1><p className="muted">彩色光标聚拢 → 框选内容 → 逐字浮现</p></div><button onClick={() => setRun(value => value + 1)}>重新体验 ↻</button></div>
    <label className="motion-setting"><input type="checkbox" checked={reduced} onChange={event => { setReduced(event.target.checked); localStorage.setItem('mowu-reduce-animation', event.target.checked ? 'yes' : 'no'); setRun(value => value + 1); }} />减少动画，直接显示内容</label>
    <ExperienceRun key={run} reduced={reduced} />
  </section>;
}

export function SiteLoader({ loading, onDone }) {
  const [skipped, setSkipped] = useState(() => localStorage.getItem('mowu-reduce-animation') === 'yes' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const target = useRef(null);
  useEffect(() => {
    const timer = setTimeout(onDone, skipped ? 0 : loading ? 8000 : 1100);
    return () => clearTimeout(timer);
  }, [loading, onDone, skipped]);
  return skipped ? null : <div className="site-loader" role="status" ref={target} onPointerMove={event => {
    target.current.style.setProperty('--pointer-x', event.clientX + 'px');
    target.current.style.setProperty('--pointer-y', event.clientY + 'px');
  }}>
    <span className="loader-wordmark">✦ mowu的小站</span><button className="loader-skip" onClick={() => setSkipped(true)}>跳过动画 →</button>
    <div className="cursor-orbit" aria-hidden="true">{colors.map((color, index) => <span key={color} style={{ '--angle': index * 45 + 'deg', '--color': color }}><Cursor color={color} /></span>)}</div>
    <div className="cursor-loading"><span>A LITTLE COLOR, A LITTLE STORY</span><h2>{loading ? '正在收集这一页的灵感' : '准备好了，翻开这一页'}</h2><p>移动鼠标，让色彩围着你旋转。</p><div className="cursor-progress" /></div>
  </div>;
}
