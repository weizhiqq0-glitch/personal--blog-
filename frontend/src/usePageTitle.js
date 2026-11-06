import { useEffect } from 'react';
export function usePageTitle() {
  useEffect(() => {
    const update = () => { document.title = document.hidden ? 'QAQ别走了~' : 'mowu的小站'; };
    update(); document.addEventListener('visibilitychange', update);
    return () => { document.removeEventListener('visibilitychange', update); document.title = 'mowu的小站'; };
  }, []);
}
