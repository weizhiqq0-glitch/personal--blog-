import { useEffect } from 'react';
import { api } from './api';

export function usePresence(user) {
  const id = user?.id;
  const needsContactVerification = user?.needsContactVerification;
  useEffect(() => {
    if (!id || needsContactVerification) return;
    let inFlight = false;
    function heartbeat() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      api('/presence', { method: 'POST' }).catch(() => {}).finally(() => { inFlight = false; });
    }
    heartbeat(); const timer = setInterval(heartbeat, 45000);
    document.addEventListener('visibilitychange', heartbeat);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', heartbeat); };
  }, [id, needsContactVerification]);
}
