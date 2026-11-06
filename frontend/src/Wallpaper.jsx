import { useEffect, useRef, useState } from 'react';

export function Wallpaper({ wallpaper }) {
  const video = useRef(null);
  const [failedSource, setFailedSource] = useState('');
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const { source, value } = wallpaper;
  useEffect(() => {
    const update = () => {
      if (!video.current) return;
      if (document.hidden || !motion) video.current.pause();
      else video.current.play().catch(() => {});
    };
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [source, motion]);
  if (!source || failedSource === source) return null;
  return <div className="personal-wallpaper" aria-hidden="true">
    {value?.kind === 'video' ? <video key={source} ref={video} src={source} muted loop playsInline autoPlay={motion} preload="metadata" onError={() => setFailedSource(source)} /> : <img src={source} alt="" onError={() => setFailedSource(source)} />}
    <div className="wallpaper-shade" />
  </div>;
}
export function WallpaperSettings({ wallpaper }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState('image');
  const [url, setUrl] = useState('');
  async function run(action) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function select(event) {
    const file = event.target.files?.[0]; if (!file) return;
    run(async () => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('请选择10MB以内的 JPG、PNG 或 WebP 图片');
      const bitmap = await createImageBitmap(file); let image;
      try {
        const scale = Math.min(1, 1920 / bitmap.width, 1920 / bitmap.height);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        image = canvas.toDataURL('image/jpeg', .82);
        if (image.length > 699075) image = canvas.toDataURL('image/jpeg', .5);
        if (image.length > 699075) throw Error('图片压缩后仍较大，请选择更小的图片或填写图片直链');
      } finally { bitmap.close(); }
      await wallpaper.save({ image }); setMessage('全站背景图片已发布，其他访客刷新网页后即可看到');
    });
  }
  function saveUrl(event) { event.preventDefault(); run(async () => { await wallpaper.save({ kind, url }); setMessage('全站背景已发布，其他访客刷新网页后即可看到'); }); }
  return <section className="article-card panel settings-page"><p className="eyebrow">SITE APPEARANCE</p><h1>全站背景</h1><p className="muted">由站主和有权限的管理员统一设置，所有访客看到同一背景。</p>
    <label>上传背景图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={select} disabled={busy} /></label><p className="muted">选择10MB以内图片，自动压缩后保存到本站。背景图片为公开内容。</p>
    <form onSubmit={saveUrl}><label>直链类型<select value={kind} onChange={e => setKind(e.target.value)}><option value="image">图片</option><option value="video">动态视频</option></select></label><label>HTTPS 图片或视频直链<input type="url" value={url} onChange={e => setUrl(e.target.value)} required maxLength={2000} placeholder="https://…" /></label><p className="muted">视频使用可公开播放的 MP4/WebM 直链。请使用有权公开的素材，链接不要包含私密密钥。</p><button className="primary-button" disabled={busy}>发布全站背景</button></form>
    <p className="muted">Wallpaper Engine 的图片可以上传；视频素材可托管后填写直链。Steam 创意工坊链接、场景包无法直接运行。</p>
    {wallpaper.source && <><p>当前背景：{wallpaper.value.kind === 'video' ? '动态视频' : '图片'}</p><div className="background-preview">{wallpaper.value.kind === 'video' ? <video src={wallpaper.source} controls muted preload="metadata" /> : <img src={wallpaper.source} alt="当前全站背景预览" />}</div></>}
    <button disabled={busy || !wallpaper.source} onClick={() => run(async () => { await wallpaper.save(null); setMessage('已恢复全站默认背景'); })}>恢复默认背景</button>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
