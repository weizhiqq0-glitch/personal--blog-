import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function AuthDialog({ mode, busy, error, onClose, onModeChange, onSubmit }) {
  const dialog = useRef(null);
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [validation, setValidation] = useState('');
  const register = mode === 'register';
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
    if (register && data.get('password') !== data.get('confirm')) {
      setValidation('两次密码不一致，再检查一下吧。');
      return;
    }
    onSubmit(event);
  }
  return (
    <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title" aria-describedby="auth-description"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="auth-shell">
        <aside className="auth-art" aria-hidden="true">
          <div className="art-brand"><span>✦</span> 我的小站</div>
          <div className="night-scene"><div className="scene-stars" /><div className="scene-moon" /><div className="scene-hill hill-back" /><div className="scene-hill hill-middle" /><div className="scene-hill hill-front" /><span className="scene-orbit orbit-one" /><span className="scene-orbit orbit-two" /></div>
          <div className="art-caption"><span className="art-kicker">SOMEWHERE, SOMETHING</span><h2>把平凡的日子，<br />写成自己的故事。</h2><p>在这里相遇，也在文字里重逢。</p><div className="art-dots"><i /><i /><i /></div></div>
          <span className="art-index">随心记录 · 慢慢生长</span>
        </aside>
        <section className="auth-content">
          <button className="dialog-close" type="button" aria-label="关闭登录注册窗口" disabled={busy} onClick={onClose}><Icon name="close" /></button>
          <div className="auth-wordmark"><span>✦</span> 很高兴遇见你</div>
          <div className="auth-tabs" aria-label="选择账号操作">
            <button type="button" aria-pressed={!register} className={!register ? 'active' : ''} disabled={busy} onClick={() => { if (register) onModeChange('login'); }}>登录</button>
            <button type="button" aria-pressed={register} className={register ? 'active' : ''} disabled={busy} onClick={() => { if (!register) onModeChange('register'); }}>注册</button>
          </div>
          <h2 id="auth-title">{register ? '开启一段新的故事' : '欢迎回来。'}</h2>
          <p id="auth-description" className="auth-description">{register ? '创建一个账号，留下你的想法与足迹。' : '登录你的小小天地，继续上次的相遇。'}</p>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="auth-username">用户名</label>
            <div className="auth-input"><Icon name="user" /><input id="auth-username" name="username" autoComplete="username" minLength={2} maxLength={32} required placeholder={register ? '给自己起个名字' : '输入你的用户名'} aria-describedby={register ? 'username-hint' : undefined} disabled={busy} /></div>
            {register && <span id="username-hint" className="field-hint">2—32位，可用中文、字母、数字、下划线和短横线</span>}
            <label htmlFor="auth-password">密码</label>
            <div className="auth-input"><Icon name="lock" /><input id="auth-password" name="password" type={visiblePassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required placeholder={register ? '设置至少10位密码' : '输入你的密码'} disabled={busy} /><button className="password-toggle" type="button" aria-label={visiblePassword ? '隐藏密码' : '显示密码'} aria-pressed={visiblePassword} onClick={() => setVisiblePassword(!visiblePassword)}><Icon name={visiblePassword ? 'eyeOff' : 'eye'} size={18} /></button></div>
            {register && <><label htmlFor="auth-confirm">确认密码</label><div className="auth-input"><Icon name="lock" /><input id="auth-confirm" name="confirm" type={visiblePassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={128} required placeholder="再输入一次密码" disabled={busy} /></div></>}
            {(validation || error) && <div className="auth-error" role="alert"><Icon name="info" size={16} /><span>{validation || error}</span></div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? '请稍候…' : register ? '创建账号' : '登录小站'}<Icon name="arrow" size={18} /></button>
          </form>
          <p className="auth-switch">{register ? '已经有账号了？' : '第一次来到这里？'}<button type="button" disabled={busy} onClick={() => onModeChange(register ? 'login' : 'register')}>{register ? '直接登录' : '注册一个账号'}<span> ↗</span></button></p>
          <div className="auth-footnote"><span className="tiny-dot" /> 文字留住时光，你留下故事。</div>
        </section>
      </div>
    </dialog>
  );
}
