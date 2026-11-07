import { ImagePicker } from './ImagePicker';
import './SiteSearch.css';
import { useRef, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';

async function compressAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw Error('请选择8MB以内的 JPG、PNG 或 WebP 图片');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    let data = canvas.toDataURL('image/png');
    if (data.length > 131094) {
      const small = document.createElement('canvas'); small.width = 128; small.height = 128;
      small.getContext('2d').drawImage(canvas, 0, 0, 128, 128); data = small.toDataURL('image/png');
    }
    return data;
  } finally { bitmap.close(); }
}
export function AvatarSettings({ user, onUpdated }) {
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const input = useRef(null);
  const selection = useRef(0);
  async function select(file) {
    const current = ++selection.current;
    setPreview(''); setMessage('');
    if (!file) return;
    try { const data = await compressAvatar(file); if (current === selection.current) setPreview(data); }
    catch (e) { if (current === selection.current) setMessage(e.message); }
  }
  async function save(remove = false) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await api('/avatars/me', { method: remove ? 'DELETE' : 'PUT', ...(remove ? {} : { body: JSON.stringify({ image: preview }) }) });
      ++selection.current; setPreview(''); if (input.current) input.current.value = '';
      onUpdated(result.version); setMessage(result.message);
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="avatar-settings"><h2>我的头像</h2><div className="avatar-preview-row">
    {preview ? <img className="avatar-preview" src={preview} alt="新头像预览" /> : <Avatar id={user.id} name={user.username} version={user.avatarVersion} size={80} />}
    <div><ImagePicker label="选择头像" onSelect={select} disabled={busy} /><p className="muted">自动居中裁成正方形。头像会公开显示在账号和评论旁，并随账号同步。</p></div>
    </div><div className="actions"><button disabled={busy || !preview || user.needsContactVerification} onClick={() => save()} className="primary-button">保存头像</button><button disabled={busy || user.needsContactVerification} onClick={() => save(true)}>恢复默认头像</button></div>{message && <p role="status">{message}</p>}</section>;
}
