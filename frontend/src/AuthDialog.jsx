import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { api } from './api';

export function AuthDialog({ mode, busy, error, onClose, onModeChange, onSubmit, initialEmail = '' }) {
  const dialog = useRef(null);
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [validation, setValidation] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [verificationId, setVerificationId] = useState('');
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const clicks = useRef({ count: 0, time: 0 });
  const [ownerStep, setOwnerStep] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryBusy, setEntryBusy] = useState(false);
  function tapMoon() {
    if (mode !== 'login' || busy) return;
    const now = Date.now();
    clicks.current.count = now - clicks.current.time > 2000 ? 1 : clicks.current.count + 1;
    clicks.current.time = now;
    if (clicks.current.count >= 3) { clicks.current.count = 0; setOwnerStep('gate'); setValidation(''); }
  }
  async function verifyEntry(event) {
    event.preventDefault(); setEntryBusy(true); setValidation('');
    try { await api('/auth/owner-entry', { method: 'POST', body: JSON.stringify({ entryCode }) }); setOwnerStep('login'); }
    catch (e) { setValidation(e.message); }
    finally { setEntryBusy(false); }
  }
  const register = mode === 'register';
  const binding = mode === 'bind';
  const reset = mode === 'reset';
  const needsCode = register || binding || reset;
  const disabled = busy || sending;
  const checkConnection = useCallback(async () => {
    setConnecting(true); setConnectionError('');
    try { const options = await api('/auth/options'); setEmailAvailable(options.emailVerification); }
    catch (e) { setConnectionError(e.message); }
    finally { setConnecting(false); }
  }, []);
  useEffect(() => {
    let active = true;
    api('/auth/options').then(options => { if (active) setEmailAvailable(options.emailVerification); })
      .catch(e => { if (active) setConnectionError(e.message); })
      .finally(() => { if (active) setConnecting(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!remaining) return; const timer = setTimeout(() => setRemaining(value => value - 1), 1000); return () => clearTimeout(timer); }, [remaining]);
  async function sendCode() {
    const input = dialog.current.querySelector('#auth-email');
    if (!input.reportValidity()) return;
    setSending(true); setValidation(''); setDeliveryMessage('');
    try {
      const result = await api('/auth/verification-code', { method: 'POST', body: JSON.stringify({ contactType: 'email', contact: email, purpose: binding ? 'bind' : reset ? 'reset-password' : 'register' }) });
      setVerificationId(result.verificationId); setRemaining(result.retryAfter); setDeliveryMessage(result.message);
    } catch (e) { setValidation(e.message); }
    finally { setSending(false); }
  }
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    element.querySelector('input')?.focus({ preventScroll: true });
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  function submit(event) {
    event.preventDefault();
    setValidation('');
    const data = new FormData(event.currentTarget);
    if ((register || reset) && data.get('password') !== data.get('confirm')) {
      setValidation('两次密码不一致，再检查一下吧。');
      return;
    }
    if (needsCode && !verificationId) { setValidation('请先获取邮箱验证码。'); return; }
    onSubmit(event);
  }
  return (
    <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title" aria-describedby="auth-description"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="auth-shell">
        <aside className="auth-art">
          <div className="art-brand"><span>✦</span> 我的小站</div>
          <div className="night-scene"><div className="scene-stars" /><button type="button" className="scene-moon" aria-label="月亮" onClick={tapMoon} /><div className="scene-hill hill-back" /><div className="scene-hill hill-middle" /><div className="scene-hill hill-front" /><span className="scene-orbit orbit-one" /><span className="scene-orbit orbit-two" /></div>
          <div className="art-caption"><span className="art-kicker">SOMEWHERE, SOMETHING</span><h2>把平凡的日子，<br />写成自己的故事。</h2><p>在这里相遇，也在文字里重逢。</p><div className="art-dots"><i /><i /><i /></div></div>
          <span className="art-index">随心记录 · 慢慢生长</span>
        </aside>
        <section className="auth-content">
          <button className="dialog-close" type="button" aria-label="关闭登录注册窗口" disabled={busy} onClick={onClose}><Icon name="close" /></button>
          <div className="auth-wordmark"><button type="button" className="mobile-owner-moon" aria-label="月亮" onClick={tapMoon}>◯</button><span>✦</span> 很高兴遇见你</div>
          {!binding && <div className="auth-tabs" aria-label="选择账号操作">
            <button type="button" aria-pressed={mode === 'login'} className={mode === 'login' ? 'active' : ''} disabled={disabled} onClick={() => { if (mode !== 'login') onModeChange('login'); }}>登录</button>
            <button type="button" aria-pressed={register} className={register ? 'active' : ''} disabled={busy} onClick={() => { if (!register) onModeChange('register'); }}>注册</button>
          </div>}
          <h2 id="auth-title">{ownerStep ? '站主专属入口' : binding ? '绑定你的邮箱' : reset ? '找回你的账号' : register ? '开启一段新的故事' : '欢迎回来。'}</h2>
          <p id="auth-description" className="auth-description">{binding ? '验证邮箱后，账号的操作权限才会生效。' : reset ? '验证已绑定的邮箱，设置6—14位新密码。' : register ? '用邮箱验证码创建账号，保存你的足迹。' : '登录你的小小天地，继续上次的相遇。'}</p>
          {ownerStep === 'gate' ? <form className="auth-form" onSubmit={verifyEntry}><label htmlFor="owner-entry">入口口令</label><div className="auth-input"><input id="owner-entry" type="password" autoComplete="off" value={entryCode} onChange={e => setEntryCode(e.target.value)} maxLength={128} required disabled={entryBusy} /></div><p className="muted">入口验证后，仍需站主账号和密码。</p>{validation && <p className="auth-error" role="alert">{validation}</p>}<button className="auth-submit" disabled={entryBusy}>{entryBusy ? '正在验证…' : '进入站主登录'}</button><button type="button" onClick={() => { setOwnerStep(''); setEntryCode(''); }}>返回普通登录</button></form> : <form onSubmit={submit} className="auth-form">
            {ownerStep === 'login' && <><input type="hidden" name="ownerLogin" value="yes" /><input type="hidden" name="entryCode" value={entryCode} /><p className="field-hint">入口已验证 · 请使用站主账号和密码</p></>}
            <p className="muted">注册邮箱供站主管理账号使用；成功登录会记录时间与设备供站主查看，不记录登录地点。</p>
            {!binding && !reset && <><label htmlFor="auth-username">用户名</label>
            <div className="auth-input"><Icon name="user" /><input id="auth-username" name="username" autoComplete="username" minLength={2} maxLength={32} required placeholder={register ? '给自己起个名字' : '输入你的用户名'} aria-describedby={register ? 'username-hint' : undefined} disabled={busy} /></div>
            {register && <span id="username-hint" className="field-hint">2—32位，可用中文、字母、数字、下划线和短横线</span>}</>}
            {!binding && <><label htmlFor="auth-password">{reset ? '新密码' : '密码'}</label>
            <div className="auth-input"><Icon name="lock" /><input id="auth-password" name="password" type={visiblePassword ? 'text' : 'password'} autoComplete={register || reset ? 'new-password' : 'current-password'} minLength={register || reset ? 6 : 1} maxLength={register || reset ? 14 : 128} required placeholder={register || reset ? '设置6—14位密码' : '输入你的密码'} disabled={disabled} /><button className="password-toggle" type="button" aria-label={visiblePassword ? '隐藏密码' : '显示密码'} aria-pressed={visiblePassword} onClick={() => setVisiblePassword(!visiblePassword)}><Icon name={visiblePassword ? 'eyeOff' : 'eye'} size={18} /></button></div></>}
            {(register || reset) && <><label htmlFor="auth-confirm">确认密码</label><div className="auth-input"><Icon name="lock" /><input id="auth-confirm" name="confirm" type={visiblePassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={14} required placeholder="再输入一次密码" disabled={disabled} /></div></>}
            {needsCode && <>
              <label htmlFor="auth-email">邮箱</label>
              <div className="auth-input"><input id="auth-email" name="contact" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setVerificationId(''); setDeliveryMessage(''); setRemaining(0); }} readOnly={binding && !!initialEmail} disabled={disabled} placeholder="接收验证码的邮箱" /></div>
              <label htmlFor="auth-code">邮箱验证码</label>
              <div className="verification-row"><div className="auth-input"><input id="auth-code" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="6位验证码" disabled={disabled} /></div><button type="button" onClick={sendCode} disabled={disabled || remaining > 0 || emailAvailable === false}>{sending ? '发送中…' : remaining ? remaining + '秒后重发' : '获取验证码'}</button></div>
              <input type="hidden" name="verificationId" value={verificationId} />
              {deliveryMessage && <span className="field-hint" role="status">{deliveryMessage}</span>}
              {emailAvailable === false && <span className="auth-error">邮箱发信服务尚未配置，请站主先完成配置。</span>}
            </>}
            {connectionError && <div className="auth-error" role="alert"><span>{connectionError}</span></div>}
            {(connectionError || error || validation) && <button type="button" disabled={connecting || disabled} onClick={checkConnection}>{connecting ? '正在重新连接…' : '重新连接'}</button>}
            {connecting && <p className="field-hint" role="status">正在检查服务器连接…</p>}
            {(validation || error) && <div className="auth-error" role="alert"><Icon name="info" size={16} /><span>{validation || error}</span></div>}
            <button className="auth-submit" type="submit" disabled={disabled || (needsCode && emailAvailable === false)}>{busy ? '请稍候…' : binding ? '验证并绑定' : reset ? '重置密码' : register ? '创建账号' : '登录小站'}<Icon name="arrow" size={18} /></button>
          </form>}
          {!binding && <p className="auth-switch">{register || reset ? '已经有账号了？' : '第一次来到这里？'}<button type="button" disabled={disabled} onClick={() => onModeChange(register || reset ? 'login' : 'register')}>{register || reset ? '直接登录' : '注册一个账号'}<span> ↗</span></button>{mode === 'login' && <button type="button" disabled={disabled} onClick={() => onModeChange('reset')}>忘记密码</button>}</p>}
          <div className="auth-footnote"><span className="tiny-dot" /> 文字留住时光，你留下故事。</div>
        </section>
      </div>
    </dialog>
  );
}
