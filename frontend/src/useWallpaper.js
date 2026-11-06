import { useEffect, useState } from 'react';
import { api } from './api';
const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export function useWallpaper() {
  const [value, setValue] = useState(null);
  useEffect(() => {
    let active = true;
    function load() {
      if (document.hidden) return;
      api('/appearance').then(next => { if (active) setValue(next); }).catch(() => {});
    }
    load(); const timer = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  async function save(next) {
    const result = await api('/management/appearance', { method: next ? 'PUT' : 'DELETE', ...(next ? { body: JSON.stringify(next) } : {}) });
    setValue(result);
  }
  return { value, source: value?.source?.startsWith('/api/') ? origin + value.source : value?.source || '', save };
}
