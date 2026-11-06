import { useState } from 'react';
import { api } from './api';
import { AvatarSettings } from './AvatarSettings';

export function UserSettings({ user, theme, choose, onSaved, onAvatarUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = data.get('newPassword');
    if (password !== data.get('confirmPassword')) { setError('两次新密码不一致'); return; }
    setBusy(true); setError('');
    try {
      const result = await api('/auth/settings', { method: 'PATCH', body: JSON.stringify({ username: data.get('username'), currentPassword: data.get('currentPassword'), ...(password ? { newPassword: password } : {}) }) });
      form.reset(); onSaved(result.message);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="article-card panel settings-page"><p className="eyebrow">MY ACCOUNT</p><h1>用户设置</h1>
    <p className="muted">管理你的账号与当前浏览器的显示偏好。</p>
    {user && <AvatarSettings user={user} onUpdated={onAvatarUpdated} />}
    <label>显示主题<select value={theme} onChange={event => choose(event.target.value)}><option value="auto">随时间切换（06:00—18:00 日间）</option><option value="light">始终日间</option><option value="dark">始终夜间</option></select></label>
    {['owner', 'admin'].includes(user?.role) && <a className="primary-button" href="#/admin/appearance">管理全站背景 →</a>}
    <h2>账号资料</h2>{!user ? <p>请先登录，再修改账号资料。</p> : <><p>已绑定邮箱：{user.contact?.value || '尚未绑定'}</p><p className="muted">邮箱更换需另行核验，这里不提供直接覆盖。</p>
      <form key={user.id + user.username} onSubmit={save}>
        <label>用户名<input name="username" defaultValue={user.username} minLength={2} maxLength={32} required autoComplete="username" /></label>
        <label>当前密码<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" /></label>
        <label>新密码（不改可留空，6—14位）<input name="newPassword" type="password" minLength={6} maxLength={14} autoComplete="new-password" /></label>
        <label>确认新密码<input name="confirmPassword" type="password" minLength={6} maxLength={14} autoComplete="new-password" /></label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <p className="muted">保存账号资料后，所有设备需要重新登录。用户名不能与其他账号重复。</p>
        <button className="primary-button" disabled={busy || user.needsContactVerification}>{busy ? '保存中…' : '保存账号资料'}</button>
      </form></>}
  </section>;
}
