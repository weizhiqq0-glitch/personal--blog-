import { useEffect, useState } from 'react';
import { api } from './api';

export function EmailBudget() {
  const [budget, setBudget] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api('/management/email-budget').then(data => { if (active) setBudget(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function reload(event) {
    event?.preventDefault();
    setBusy(true); setError('');
    try { setBudget(await api('/management/email-budget')); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function calibrate(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm('请先暂停发送请求，并确认这些数值来自 EmailJS 控制台。校准会重新建立本站的额度基线。')) return;
    setBusy(true); setError('');
    try { setBudget(await api('/management/email-budget', { method: 'PATCH', body: JSON.stringify({ remaining: Number(form.get('remaining')), resetAt: new Date(form.get('resetAt')).toISOString() }) })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="email-budget"><p className="eyebrow">仅站主可见</p><h3>邮件额度</h3>
    {error && <p className="notice error" role="alert">{error}</p>}
    {budget && <><div className="budget-summary"><strong>{budget.remaining}<small> / 200 封</small></strong><span>剩余额度 · 本站估算</span></div>
      <p className="muted">{budget.calibrated ? '已按控制台校准' : '尚未校准：历史发送量未知，请先填写控制台实际数值。'} · 预计重置：{new Date(budget.resetAt).toLocaleString('zh-CN')}</p>
      <p>普通用户可用约 {budget.publicRemaining} 封，保留 {budget.policy.reserve} 封供已登录站主使用。本基线内计入 {budget.attempts} 次发送尝试，平台接受 {budget.accepted} 次。</p>
      <p className="muted">邮箱每60秒一次、每天{budget.policy.email}次；同一网络每小时{budget.policy.ipHour}次、每天{budget.policy.ipDay}次；浏览器每天{budget.policy.browser}次；账号每天{budget.policy.account}次；普通用户全站每天{budget.policy.siteDay}次。日限额按首次请求后的24小时计算。</p>
      <button disabled={busy} onClick={reload}>刷新本站统计</button> <a href="https://dashboard.emailjs.com/" target="_blank" rel="noreferrer">打开 EmailJS 控制台 ↗</a>
      <details><summary>校准实际额度</summary><p className="muted">EmailJS 未提供已确认的实时额度查询接口；其他项目发送、失败请求和人工校准可能造成误差。这里填写当前余额和下一次重置时间（本机时区）。</p><form onSubmit={calibrate} className="budget-form"><label>控制台剩余额度<input name="remaining" type="number" min="0" max="200" required /></label><label>下次重置时间<input name="resetAt" type="datetime-local" required /></label><button className="primary-button" disabled={busy}>保存校准</button></form></details>
    </>}
  </section>;
}
