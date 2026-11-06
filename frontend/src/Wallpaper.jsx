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
  const input = useRef(null);
  async function select(event) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    const image = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    const video = ['video/mp4', 'video/webm'].includes(file.type);
    if ((!image && !video) || file.size > (video ? 40 : 10) * 1024 * 1024) { setMessage('请选择10MB以内的JPG/PNG/WebP，或40MB以内的MP4/WebM'); return; }
    setBusy(true); setMessage('');
    try {
      if (image) { const bitmap = await createImageBitmap(file); bitmap.close(); }
      else {
        const url = URL.createObjectURL(file);
        try {
          await new Promise((resolve, reject) => {
            const element = document.createElement('video');
            const finish = error => { clearTimeout(timer); element.removeAttribute('src'); element.load(); if (error) reject(error); else resolve(); };
            const timer = setTimeout(() => finish(Error('视频读取超时，请换一个文件')), 10000);
            element.onloadedmetadata = () => finish(); element.onerror = () => finish(Error('浏览器无法播放该视频，请换用MP4（H.264）'));
            element.preload = 'metadata'; element.src = url;
          });
        } finally { URL.revokeObjectURL(url); }
      }
      await wallpaper.save({ blob: file, kind: video ? 'video' : 'image', name: file.name });
      setMessage('背景已应用，切换页面也会保留');
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try { await wallpaper.save(null); if (input.current) input.current.value = ''; setMessage('已恢复小站默认背景'); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="article-card panel settings-page"><p className="eyebrow">YOUR OWN SCENERY</p><h1>背景设置</h1><p className="muted">给自己的小站视角，换一片喜欢的风景。</p>
    <label>选择图片或动态壁纸<input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={select} disabled={busy} /></label>
    <p>图片不超过10MB，视频不超过40MB。动态壁纸静音循环播放。</p>
    <p className="muted">仅保存在当前浏览器、当前账号下，不上传服务器、不影响其他人。更换设备需重新设置，清除网站数据会清除壁纸。</p>
    <p className="muted">Wallpaper Engine 的图片和视频文件可以使用；Steam 创意工坊链接、场景包和可执行程序无法直接作为网页背景。</p>
    {wallpaper.value && <p>当前背景：{wallpaper.value.name}</p>}
    <button disabled={busy || !wallpaper.value} onClick={clear}>{busy ? '处理中…' : '恢复默认背景'}</button>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
