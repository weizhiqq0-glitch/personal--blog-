import { useEffect } from 'react';
import { api } from './api';

export function usePageVisit() {
  useEffect(() => {
    const state = { interacted: false, visibleMs: 0, last: Date.now(), sent: false, cancelled: false, retryAt: 0 };
    function interaction(event) { if (event.isTrusted && document.visibilityState === 'visible') state.interacted = true; }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, interaction, { passive: true }));
    function tick() {
      const now = Date.now();
      if (document.visibilityState === 'visible') state.visibleMs += Math.min(1000, now - state.last);
      state.last = now;
      if (!state.sent && state.interacted && state.visibleMs >= 3000 && now >= state.retryAt) {
        state.sent = true;
        api('/visits', { method: 'POST', body: JSON.stringify({ engaged: true }) }).catch(() => { if (!state.cancelled) { state.sent = false; state.retryAt = Date.now() + 30000; } });
      }
    }
    const timer = setInterval(tick, 1000);
    return () => { state.cancelled = true; clearInterval(timer); events.forEach(name => window.removeEventListener(name, interaction)); };
  }, []);
}
