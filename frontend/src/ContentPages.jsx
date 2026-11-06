import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { contentKinds } from './contentKinds';
import './ContentPages.css';

function MediaImage({ src, title }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <div className="media-placeholder">✦<span>{title}</span></div>;
}
function PhotoViewer({ item, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  return <dialog className="photo-viewer" ref={dialog} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><button className="dialog-close" onClick={onClose} aria-label="关闭照片">×</button><MediaImage src={item.image} title={item.title} /><h2>{item.title}</h2><p>{item.content}</p></dialog>;
}
function MusicPlayer({ items }) {
  const [index, setIndex] = useState(0); const [started, setStarted] = useState(false); const [error, setError] = useState('');
  const current = items[index] || items[0];
  if (!current) return <p className="empty">歌单还没有歌曲，站主可以在管理后台添加有权使用的音频直链。</p>;
  function choose(next) { setIndex((next + items.length) % items.length); setStarted(true); setError(''); }
  return <div className="music-page-grid"><section className="paper-card music-player"><MediaImage src={current.image} title={current.title} /><p className="eyebrow">NOW PLAYING</p><h2>{current.title}</h2><p>{current.content}</p><audio key={current.url} src={current.url} controls autoPlay={started} preload="none" onEnded={() => choose(index + 1)} onError={() => setError('音频无法播放，可能链接已失效或不允许外站播放。')} /><div className="actions"><button onClick={() => choose(index - 1)}>上一首</button><button onClick={() => choose(index + 1)}>下一首</button></div>{error && <p role="status">{error}</p>}</section><section className="paper-card music-playlist"><h2>小站歌单</h2>{items.map((item, position) => <button key={item.item_key} aria-pressed={position === index} onClick={() => choose(position)}><span>{String(position + 1).padStart(2, '0')}</span>{item.title}<span>♪</span></button>)}</section></div>;
}
export function ContentPage({ kind }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [photo, setPhoto] = useState(null);
  const config = contentKinds[kind];
  useEffect(() => {
    let active = true;
    api('/content/' + kind).then(value => { if (active) setItems(value); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);
  return <section className={'content-page content-' + kind}><p className="eyebrow">MOWU / {kind.toUpperCase()}</p><h1>{config.title}</h1><p className="muted">{config.subtitle}</p>
    {error && <p className="notice error" role="alert">{error}</p>}{loading ? <p className="empty">正在打开这一页…</p> : kind === 'music' ? <MusicPlayer items={items} /> : <div className="content-collection">{items.map(item => <article className="paper-card content-item" key={item.item_key}>
      {kind === 'photos' ? <button className="photo-open" onClick={() => setPhoto(item)} aria-label={'查看照片：' + item.title}><MediaImage src={item.image} title={item.title} /></button> : item.image && <MediaImage src={item.image} title={item.title} />}
      <h2>{item.title}</h2><p className="content-body">{item.content}</p>
      {['moments', 'chatter'].includes(kind) && <time>{new Date(Number(item.created_at)).toLocaleString('zh-CN')}</time>}
      {item.url && <a className="read-button" href={item.url} target="_blank" rel="noopener noreferrer">{kind === 'friends' ? '去串个门' : '查看详情'} ↗</a>}
    </article>)}</div>}
    {!loading && !error && !items.length && kind !== 'music' && <div className="paper-card empty">{kind === 'about' ? <><h2>mowu的小站</h2><p>记录生活、分享想法，也欢迎你留下评论。小站由独立前端和后端服务共同运行。</p><a href="#/feedback">联系站主 / 问题反馈 →</a></> : <><h2>这一页，等待新的故事</h2><p>站主可以在管理后台的“板块内容”中添加{config.title}。</p></>}</div>}
    {photo && <PhotoViewer item={photo} onClose={() => setPhoto(null)} />}
  </section>;
}
