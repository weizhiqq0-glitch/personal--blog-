import { useEffect, useState } from 'react';
const automaticDark = () => { const hour = new Date().getHours(); return hour < 6 || hour >= 18; };
export function useTheme() {
  const [theme, setTheme] = useState(() => { const saved = localStorage.getItem('blog-theme'); return ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto'; });
  const [night, setNight] = useState(automaticDark);
  useEffect(() => {
    const update = () => setNight(automaticDark());
    const timer = setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  function choose(value) { setTheme(value); localStorage.setItem('blog-theme', value); }
  return { theme, choose, dark: theme === 'auto' ? night : theme === 'dark' };
}
