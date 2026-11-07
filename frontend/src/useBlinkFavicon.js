import { useEffect } from 'react';
export function useBlinkFavicon() {
  useEffect(() => {
    const link = document.querySelector('link[rel="icon"]');
    if (!link) return;
    const original = link.href;
    const originalType = link.type;
    link.type = 'image/png';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frames = [false, true].map(closed => {
      ctx.clearRect(0, 0, 64, 64);
      const gradient = ctx.createLinearGradient(0, 0, 64, 64); gradient.addColorStop(0, '#dfe8da'); gradient.addColorStop(1, '#e6dff2');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 19); ctx.fill();
      ctx.fillStyle = '#6b8f71'; ctx.fill(new Path2D('M32 8C35 24 40 29 56 32C40 35 35 40 32 56C29 40 24 35 8 32C24 29 29 24 32 8Z'));
      ctx.fillStyle = '#fffdf6';
      for (const x of [27, 37]) { ctx.beginPath(); ctx.ellipse(x, 32, 1.8, closed ? .7 : 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
      return canvas.toDataURL('image/png');
    });
    let timer;
    function draw() {
      clearTimeout(timer);
      link.href = frames[0];
      if (document.hidden || reduce.matches) return;
      timer = setTimeout(() => { link.href = frames[1]; timer = setTimeout(draw, 170); }, 5500);
    }
    draw(); document.addEventListener('visibilitychange', draw); reduce.addEventListener('change', draw);
    return () => { clearTimeout(timer); link.href = original; link.type = originalType; document.removeEventListener('visibilitychange', draw); reduce.removeEventListener('change', draw); };
  }, []);
}
