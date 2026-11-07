import { useEffect, useRef, useState } from 'react';
export function Pet({ hidden }) {
  const [enabled, setEnabled] = useState(() => { const saved = localStorage.getItem('mowu-pet'); return saved === null ? matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)').matches : saved === 'on'; });
  const [status, setStatus] = useState('loading');
  const frame = useRef(null);
  useEffect(() => {
    function receive(event) { if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.petAction === 'search') window.location.hash = '/search'; if (event.origin === location.origin && event.source === frame.current?.contentWindow && ['ready', 'error'].includes(event.data?.petStatus)) setStatus(event.data.petStatus); }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  function toggle() { const next = !enabled; setEnabled(next); setStatus('loading'); localStorage.setItem('mowu-pet', next ? 'on' : 'off'); }
  return <aside className={'pet-companion' + (hidden ? ' pet-hidden' : '')} aria-label="小站看板猫">
    {enabled && !hidden && <><iframe ref={frame} title="Live2D看板猫" src="./pet.html" className="pet-frame" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />{status === 'error' && <p className="pet-error" role="status">看板猫暂时没赶到，稍后再试。</p>}</>}
    <button className="pet-toggle" onClick={toggle} aria-pressed={enabled}>{enabled ? '收起看板猫 ×' : '唤醒看板猫 ✦'}</button>
  </aside>;
}
