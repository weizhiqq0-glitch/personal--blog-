import { useEffect, useRef, useState } from 'react';
import { wallpaperStorage } from './wallpaperStorage';

export function useWallpaper(userId) {
  const key = userId ? 'user-' + userId : 'guest';
  const [saved, setSaved] = useState(null);
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
    const state = { active: true };
    wallpaperStorage('get', key).then(value => { if (state.active) setSaved({ key, value, source: value?.blob ? URL.createObjectURL(value.blob) : '' }); }).catch(() => { if (state.active) setSaved({ key, value: null }); });
    return () => { state.active = false; };
  }, [key]);
  const value = saved?.key === key ? saved.value : null;
  useEffect(() => () => { if (saved?.source) URL.revokeObjectURL(saved.source); }, [saved]);
  async function save(next) {
    await wallpaperStorage(next ? 'put' : 'delete', key, next);
    if (current.current === key) setSaved({ key, value: next, source: next?.blob ? URL.createObjectURL(next.blob) : '' });
  }
  return { value, source: value ? saved.source : '', save };
}
