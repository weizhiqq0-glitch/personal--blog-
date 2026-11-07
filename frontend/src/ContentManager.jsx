import { useCallback, useEffect, useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { resizeImage } from './resizeImage';
import { resolveMediaUrl } from './api';
import './SiteSearch.css';
import { api } from './api';
import { contentKinds } from './contentKinds';

function Editor({ item, kind, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(item || { title: '', content: '', url: '', image: '' });
  const [imageBusy,setImageBusy]=useState(false);
  async function upload(file){setImageBusy(true);try{const image=await resizeImage(file);const result=await api('/content-media',{method:'POST',body:JSON.stringify({image})});setDraft(current=>({...current,image:'/api'+result.path}));}finally{setImageBusy(false);}}
  return <form className="admin-editor" onSubmit={event => { event.preventDefault(); onSave(draft); }}><h3>{item ? '编辑' : '添加'}{contentKinds[kind].title}</h3><label>标题<input value={draft.title} maxLength={120} required onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>{kind === 'music' ? '歌手 / 简介' : '内容 / 描述'}<textarea value={draft.content} maxLength={20000} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label><label>{kind === 'music' ? '音频直链（HTTPS）' : '跳转链接（可选，HTTPS）'}<input type="url" value={draft.url} required={kind === 'music'} maxLength={2000} onChange={e => setDraft({ ...draft, url: e.target.value })} /></label><label>{kind === 'photos' ? '照片链接（HTTPS）' : '封面链接（可选，HTTPS）'}<input type="text" value={draft.image} required={kind === 'photos'} maxLength={2000} onChange={e => setDraft({ ...draft, image: e.target.value })} /></label><ImagePicker label="从相册或电脑添加图片" onSelect={upload} disabled={busy||imageBusy} preview={resolveMediaUrl(draft.image)} /><p className="muted">图片选择后会上传为公开素材，保存表单后展示在板块中。使用你有权使用的公开媒体直链。不要填写密码、签名密钥或包含私密凭证的链接。图片和音乐在前台由访客浏览器直接加载。</p><div className="actions"><button className="primary-button" disabled={busy||imageBusy}>保存并发布</button><button type="button" onClick={onCancel} disabled={busy}>取消</button></div></form>;
}
function KindManager({ kind }) {
  const [items, setItems] = useState([]); const [editing, setEditing] = useState(undefined); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(async () => setItems(await api('/content/' + kind)), [kind]);
  useEffect(() => { let active = true; api('/content/' + kind).then(value => { if (active) setItems(value); }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, [kind]);
  async function run(action) { if (busy) return; setBusy(true); setMessage(''); try { await action(); await load(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function save(draft) { run(async () => { const result = await api('/content/' + kind + (draft.item_key ? '/' + draft.item_key : ''), { method: draft.item_key ? 'PATCH' : 'POST', body: JSON.stringify(draft) }); setMessage(result.message); setEditing(undefined); }); }
  function remove(key) { if (window.confirm('确定删除这条内容吗？')) run(async () => { const result = await api('/content/' + kind + '/' + key, { method: 'DELETE' }); setMessage(result.message); if (editing?.item_key === key) setEditing(undefined); }); }
  return <><div className="admin-section-heading"><h3>{contentKinds[kind].title} · {items.length}</h3><button className="primary-button" disabled={busy} onClick={() => setEditing(null)}>＋ 添加内容</button></div>{message && <p className="notice" role="status">{message}</p>}{editing !== undefined && <Editor key={editing?.item_key || 'new'} kind={kind} item={editing} busy={busy} onSave={save} onCancel={() => setEditing(undefined)} />}
    {items.map(item => <article className="feedback-item" key={item.item_key}><h3>{item.title}</h3><p>{item.content.slice(0, 180)}</p><div className="actions"><button disabled={busy} onClick={() => setEditing(item)}>编辑</button><button disabled={busy} className="danger" onClick={() => remove(item.item_key)}>删除</button></div></article>)}{!items.length && <p className="empty">该板块还没有内容。</p>}
  </>;
}
export function ContentManager() {
  const [kind, setKind] = useState('projects');
  return <><h2>板块内容</h2><div className="content-kind-tabs">{Object.entries(contentKinds).map(([key, config]) => <button key={key} aria-pressed={kind === key} onClick={() => setKind(key)}>{config.title}</button>)}</div><KindManager key={kind} kind={kind} /></>;
}
