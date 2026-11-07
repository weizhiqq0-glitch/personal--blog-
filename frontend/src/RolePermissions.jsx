import { useEffect, useState } from 'react';
import { api } from './api';
export function RolePermissions() {
  const [data,setData]=useState(null), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  useEffect(()=>{let active=true;api('/management/role-policy').then(value=>{if(active)setData(value);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
  function preset(mode){setData(current=>({...current,enabled:Object.fromEntries(Object.keys(current.permissions).map(key=>[key,mode==='readonly'?key!=='comment.create':mode==='all']))}));}
  async function save(){setBusy(true);setMessage('');try{const result=await api('/management/role-policy',{method:'PUT',body:JSON.stringify({enabled:data.enabled})});setMessage(result.message);}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  return <section><p className="admin-eyebrow">OWNER ONLY</p><h2>普通用户权限</h2><p className="muted">仅站主可查看与修改。适用于所有已验证普通用户，管理员、站主与未登录访客不受这些开关影响。统一禁用优先于个人授权；恢复默认不会清除账号单独的限制。</p>{message&&<p className="notice" role="status">{message}</p>}{data&&<fieldset disabled={busy}><legend>统一功能开关</legend><div className="actions"><button onClick={()=>preset('all')}>一键恢复默认（全部开启）</button><button onClick={()=>preset('readonly')}>一键只读</button><button onClick={()=>preset('none')}>全部禁用</button></div>{Object.entries(data.permissions).map(([key,label])=><label className="permission-row" key={key}><span>{label}</span><input type="checkbox" checked={data.enabled[key]} onChange={e=>setData({...data,enabled:{...data.enabled,[key]:e.target.checked}})}/><span>{data.enabled[key]?'允许':'禁用'}</span></label>)}<p className="muted">选择预设或调整开关后，点击保存生效。这里不授予普通用户后台管理身份。</p><button className="primary-button" onClick={save}>{busy?'保存中…':'保存统一权限'}</button></fieldset>}</section>;
}
