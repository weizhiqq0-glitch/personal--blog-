export const chinaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function parseNews(value, today = chinaDate()) {
  const data = value?.data || value;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > today || !Array.isArray(data.news) || !data.news.length || data.news.length > 40 || data.news.some(item => typeof item !== 'string' || !item.trim() || item.length > 1500)) throw Error('简报数据格式异常');
  let link = '';
  try { const url = new URL(data.link); if (url.protocol === 'https:' && url.hostname === 'mp.weixin.qq.com') link = url.href; } catch { /* optional source */ }
  return { date: data.date, news: data.news, tip: typeof data.tip === 'string' ? data.tip.slice(0, 1000) : '', link };
}
const KEY = 'mowu-daily-news-v1';
export function cachedNews() {
  try { const saved = JSON.parse(localStorage.getItem(KEY)); return { data: parseNews(saved.data), fetched: saved.fetched }; } catch { return null; }
}
export async function loadNews(signal) {
  const saved = cachedNews();
  const today = chinaDate();
  if (saved?.data.date === today && Date.now() - saved.fetched < 1800000) return { ...saved, offline: false };
  const yesterday = chinaDate(new Date(Date.now() - 86400000));
  const sources = [
    `https://raw.githubusercontent.com/vikiboss/60s-static-host/main/static/60s/${today}.json`,
    'https://60s.api.shumengya.top/v2/60s',
    `https://raw.githubusercontent.com/vikiboss/60s-static-host/main/static/60s/${yesterday}.json`,
  ];
  for (const source of sources) {
    if (signal.aborted) throw signal.reason;
    try {
      const response = await fetch(source, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) continue;
      const data = parseNews(await response.json(), today);
      const result = { data, fetched: Date.now(), offline: false };
      try { localStorage.setItem(KEY, JSON.stringify(result)); } catch { /* storage optional */ }
      return result;
    } catch { if (signal.aborted) throw signal.reason; }
  }
  if (saved) return { ...saved, offline: true };
  throw Error('暂时无法获取简报，请稍后重试。');
}
