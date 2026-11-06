import { useEffect, useState } from 'react';
import { api } from './api';
import { EmailBudget } from './EmailBudget';

const roleNames = { guest: '访客', user: '用户', admin: '管理员', owner: '站主' };
function UserEditor({ account, labels, disabled, save }) {
  const [role, setRole] = useState(account.role);
  const [permissions, setPermissions] = useState(account.overrides);
  return <details className="permission-editor"><summary>角色与权限</summary><form onSubmit={event => { event.preventDefault(); save({ role, permissions }); }}>
    <label>身份<select aria-label="身份" value={role} onChange={event => setRole(event.target.value)} disabled={disabled}><option value="user">用户</option><option value="admin">管理员</option></select></label>
    <p className="muted">“默认”使用该身份的基础权限；管理权限仅对站主与管理员身份生效。普通用户需先提升为管理员才能进入后台。</p>
    <div className="permission-grid">{Object.entries(labels).map(([key, label]) => <label key={key}>{label}<select aria-label={account.username + '的' + label} value={Object.hasOwn(permissions, key) ? String(permissions[key]) : 'default'} disabled={disabled} onChange={event => setPermissions(value => { const next = { ...value }; if (event.target.value === 'default') delete next[key]; else next[key] = event.target.value === 'true'; return next; })}><option value="default">默认</option><option value="true">允许</option><option value="false">禁止</option></select></label>)}</div>
    <button className="primary-button" disabled={disabled}>保存授权</button>
  </form></details>;
}

export function ManagementPanel({ user, onClose, showBudget = true }) {
  const [accounts, setAccounts] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [labels, setLabels] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const owner = user.role === 'owner';
  const listUsers = owner || user.permissions.includes('user.ban');
  const listVisitors = user.permissions.includes('visitor.ban');
  async function load() {
    const [usersResult, visitorResult] = await Promise.all([listUsers ? api('/management/users') : null, listVisitors ? api('/management/visitors') : null]);
    if (usersResult) { setAccounts(usersResult.users); setLabels(usersResult.permissions); }
    if (visitorResult) setVisitors(visitorResult);
  }
  useEffect(() => {
    let active = true;
    Promise.all([listUsers ? api('/management/users') : null, listVisitors ? api('/management/visitors') : null]).then(([usersResult, visitorResult]) => {
      if (!active) return;
      if (usersResult) { setAccounts(usersResult.users); setLabels(usersResult.permissions); }
      if (visitorResult) setVisitors(visitorResult);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [listUsers, listVisitors]);
  async function update(path, body) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { const result = await api(path, { method: path.endsWith('/ban') ? 'POST' : 'PATCH', body: JSON.stringify(body) }); setMessage(result.message); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function ban(path, banned) {
    const reason = banned ? window.prompt('封禁原因（可留空，最多200字）', '') : '';
    if (reason === null) return;
    update(path, { banned, reason });
  }
  return <section className="article-card panel management-panel" aria-label="账号管理">
    <div className="section-heading"><div><p className="eyebrow">{owner ? '站主控制台' : '站点管理'}</p><h2>账号与访问管理</h2></div><button onClick={onClose}>返回首页</button></div>
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice" role="status">{message}</div>}
    {owner && showBudget && <EmailBudget />}
    {listUsers && <><h3>账号</h3><p className="muted">站主可授权或限制其他账号；管理员只能封禁或解封普通用户。</p>
      {accounts.map(account => <article className="management-row" key={account.id}><div><strong>{account.username}</strong><span className="role-badge">{roleNames[account.role]}</span><p>{account.contact || '尚未绑定邮箱'} · {account.verified ? '已验证' : '待验证'} · {account.banned ? '已封禁' : '正常'}</p>{owner && <p className="muted">上次成功登录：{account.lastLogin ? new Date(account.lastLogin.time).toLocaleString('zh-CN') + ' · ' + account.lastLogin.device : '暂无记录（更新后开始记录）'}</p>}{account.banReason && <p className="muted">原因：{account.banReason}</p>}</div>
        {account.id !== user.id && account.role !== 'owner' && (owner || account.role === 'user') && <button className={account.banned ? '' : 'danger'} disabled={busy} onClick={() => ban('/management/users/' + account.id + '/ban', !account.banned)}>{account.banned ? '解除封禁' : '封禁账号'}</button>}
        {owner && account.role !== 'owner' && <UserEditor key={account.id + account.role + JSON.stringify(account.overrides)} account={account} labels={labels} disabled={busy} save={body => update('/management/users/' + account.id, body)} />}
      </article>)}
    </>}
    {listVisitors && <><h3>近期浏览器访客</h3><p className="muted">仅记录页面可见至少3秒且发生点击、按键或滚动的浏览器；接口检查不计入。此为有效浏览估算，不能保证全部为真人。清除浏览器数据可能产生新标识，最多显示最近100个。</p>
      {visitors.map(visitor => <article className="management-row" key={visitor.key}><div><strong>{visitor.label}</strong><p>{new Date(visitor.lastSeen).toLocaleString('zh-CN')} · {visitor.banned ? '已封禁' : '正常'}</p>{visitor.banReason && <p className="muted">原因：{visitor.banReason}</p>}</div><button className={visitor.banned ? '' : 'danger'} disabled={busy || visitor.current} onClick={() => ban('/management/visitors/' + visitor.key + '/ban', !visitor.banned)}>{visitor.current ? '当前浏览器' : visitor.banned ? '解除封禁' : '封禁访客'}</button></article>)}
    </>}
  </section>;
}
