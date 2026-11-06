import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function LoginReports() {
  const [status, setStatus] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const state = await api('/management/device-status');
    setStatus(state);
    if (state.trusted) setReports(await api('/management/login-reports'));
    else setReports([]);
  }, []);
  useEffect(() => {
    let active = true;
    const check = () => { if (active && !document.hidden) load().catch(e => { if (active) setError(e.message); }); };
    check(); const timer = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [load]);
  async function bind(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const currentPassword = new FormData(form).get('currentPassword');
    const setupCode = new FormData(form).get('setupCode');
    setBusy(true); setError('');
    try {
      if (!localStorage.getItem('mowu-owner-device')) localStorage.setItem('mowu-owner-device', Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join(''));
      await api('/management/trusted-device', { method: 'POST', body: JSON.stringify({ currentPassword, setupCode }) });
      form.reset(); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="article-card panel"><p className="eyebrow">OWNER SECURITY</p><h1>站主登录报备</h1>
    <p className="muted">其他浏览器成功登录站主账号时生成报备，仅已绑定浏览器登录站主后能查看。每30秒检查一次；保留90天，最多显示100条，不记录地点。</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!status ? <p>正在检查设备…</p> : status.trusted ? <><p className="notice">当前浏览器是唯一报备查看设备。</p><button onClick={() => load().catch(e => setError(e.message))}>刷新报备</button>
      {reports.length ? reports.map(report => <article className="management-row" key={report.id}><strong>其他设备登录</strong><p>{new Date(report.time).toLocaleString('zh-CN')} · {report.device}</p></article>) : <p className="empty">暂无其他设备登录记录。</p>}</> : status.enrollmentAvailable ? <form onSubmit={bind}><h2>绑定这台设备</h2><p>输入当前站主密码，将本浏览器绑定为唯一报备查看设备。清除浏览器数据会丢失凭证，需要通过本机工具恢复。</p>{status.requiresSetupCode && <label>本机绑定授权码<input type="password" name="setupCode" autoComplete="off" required maxLength={128} /></label>}<label>当前站主密码<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128} /></label><button className="primary-button" disabled={busy}>{busy ? '绑定中…' : '绑定当前浏览器'}</button></form> : <p className="notice">{status.bound ? '此浏览器没有查看报备的权限，请使用已绑定的本机浏览器。' : '尚未绑定设备，请在本机测试服务中完成绑定。'}</p>}
  </section>;
}
