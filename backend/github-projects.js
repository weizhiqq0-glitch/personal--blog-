const seed = require('./github-seed.json');
const TTL = 6 * 3600000;
const RETRY = 10 * 60000;
function queries(now) {
  const day = days => new Date(now - days * 86400000).toISOString().slice(0, 10);
  return {
    hot: `is:public archived:false stars:>100 pushed:>${day(7)} created:>${day(365)}`,
    emerging: `is:public archived:false stars:>30 created:>${day(90)}`,
    classics: `is:public archived:false stars:>10000 created:<${day(3 * 365)} pushed:>${day(180)}`,
  };
}
function sanitize(item) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(item.full_name || '')) return null;
  return { name: item.full_name, description: String(item.description || '').slice(0, 400), stars: Number(item.stargazers_count) || 0, forks: Number(item.forks_count) || 0, language: item.language || '', license: item.license?.spdx_id || '未声明', url: 'https://github.com/' + item.full_name, createdAt: item.created_at, pushedAt: item.pushed_at };
}
function createGithubProjects({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  const failures = new Map();
  return async function load(category = 'hot') {
    if (!['hot', 'emerging', 'classics', 'picks'].includes(category)) return null;
    if (category === 'picks') return { category, source: 'curated', fetchedAt: seed.fetchedAt, items: seed.items };
    const old = cache.get(category);
    if (old && now() - old.time < TTL) return old.data;
    function fallback() {
      return old ? { ...old.data, stale: true } : { category, source: 'snapshot', fetchedAt: seed.fetchedAt, items: seed.items, stale: true };
    }
    if (now() < (failures.get(category) || 0)) return fallback();
    if (pending.has(category)) return pending.get(category);
    const promise = (async () => {
      try {
        const response = await fetcher('https://api.github.com/search/repositories?q=' + encodeURIComponent(queries(now())[category]) + '&sort=stars&order=desc&per_page=6', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mowu-blog-projects' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error('GitHub unavailable');
        const body = await response.json();
        if (!Array.isArray(body.items) || body.incomplete_results) throw Error('Incomplete results');
        const data = { category, source: 'github-search', fetchedAt: new Date(now()).toISOString(), items: body.items.map(sanitize).filter(Boolean) };
        cache.set(category, { time: now(), data }); failures.delete(category);
        return data;
      } catch {
        failures.set(category, now() + RETRY);
        return fallback();
      } finally { pending.delete(category); }
    })();
    pending.set(category, promise);
    return promise;
  };
}
module.exports = { createGithubProjects, queries, sanitize };
