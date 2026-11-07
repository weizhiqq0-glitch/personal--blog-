import { useEffect, useRef, useState } from 'react';
import './GithubProjects.css';
export function Toolbox() {
  const [format, setFormat] = useState('image/webp'); const [quality, setQuality] = useState(85);
  const [file, setFile] = useState(null); const [result, setResult] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  function clearResult() { setResult(null); }
  function select(event) { ++generation.current; setFile(event.target.files?.[0] || null); clearResult(); setError(''); setBusy(false); }
  async function convert(event) {
    event.preventDefault(); if (!file || busy) return;
    const current = ++generation.current; setBusy(true); setError(''); clearResult();
    let bitmap;
    try {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw Error('请选择12MB以内的 JPG、PNG 或 WebP 静态图片。');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 20000000) throw Error('图片超过2000万像素，请先缩小后再转换。');
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw Error('浏览器暂不支持图片处理。');
      if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality / 100));
      if (!blob || blob.type !== format) throw Error('此浏览器不支持所选输出格式，请选择 PNG 或 JPG。');
      if (!active.current || current !== generation.current) return;
      const url = URL.createObjectURL(blob);
      setResult({ url, bytes: blob.size, name: file.name.replace(/\.[^.]+$/, '') + '.' + ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[format]) });
    } catch (e) { if (active.current && current === generation.current) setError(e.message || '转换失败，请换一张图片。'); }
    finally { bitmap?.close(); if (active.current && current === generation.current) setBusy(false); }
  }
  return <section className="toolbox-page"><p className="eyebrow">SMALL TOOLS / JUST FOR YOU</p><h1>小站工具箱</h1><p className="muted">选一张图片，换一种格式。处理在当前浏览器内完成，文件不会上传到服务器。</p><div className="toolbox-grid"><form className="paper-card converter-form" onSubmit={convert}><h2>图片格式转换</h2><label className="file-drop">选择图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={select}/><small>JPG / PNG / WebP · 最大12MB、2000万像素</small></label>{file && <p className="muted">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}<label>输出格式<select value={format} onChange={e => { setFormat(e.target.value); clearResult(); }} disabled={busy}><option value="image/webp">WebP · 适合网页</option><option value="image/png">PNG · 保留透明</option><option value="image/jpeg">JPG · 通用图片</option></select></label>{format !== 'image/png' && <label>图片质量 · {quality}%<input type="range" min="20" max="100" value={quality} disabled={busy} onChange={e => { setQuality(Number(e.target.value)); clearResult(); }}/></label>}<p className="muted">透明图片转 JPG 时填充白底。只转换静态图片，不保留动画和原始元数据；结果不保证比原图小。</p><button className="primary-button" disabled={!file || busy}>{busy ? '正在转换…' : '转换图片 ↗'}</button>{error && <p role="alert" className="notice error">{error}</p>}</form><section className="paper-card converter-result" aria-live="polite"><p className="eyebrow">YOUR RESULT</p>{result ? <><img src={result.url} alt="转换结果预览"/><h2>转换完成</h2><p>{(result.bytes / 1024).toFixed(1)} KB</p><a className="primary-button" href={result.url} download={result.name}>下载图片 ↓</a></> : <><span className="tool-result-icon" aria-hidden="true">◈</span><h2>让文件轻装出发</h2><p className="muted">转换后的图片会出现在这里。</p></>}</section></div><div className="paper-card tool-project-note"><h2>更多开源工具</h2><p>图片转换是小站基于浏览器能力实现的独立工具，并非 Filee 的网页移植版。Filee 完整版需要在电脑上运行；Folia 和 Wallpaper 场景渲染的接入评估见 GitHub 精选项目。</p><a href="#/github">浏览项目与接入说明 →</a></div></section>;
}
