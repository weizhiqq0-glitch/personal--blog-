const { sanitize } = require('./github-projects');
function createGithubBrowser({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  let blockedUntil = 0;
  let running = 0;
  async function get(path) {
    const old = cache.get(path);
    if (old && now() - old.time < 30 * 60000) return old;
    if (pending.has(path)) return pending.get(path);
    if (now() < blockedUntil || running >= 3) throw Object.assign(Error('GitHub 查询繁忙或额度暂不可用，请稍后再试。'), { status: 429 });
    const request = (async () => {
      running++;
      try {
        // Workers supports manual/follow redirect modes. Reject 3xx below instead
        // of using Node's error mode, which fails before sending in Workers.
        const response = await fetcher('https://api.github.com/' + path, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mowu-blog-search' }, signal: AbortSignal.timeout(10000), redirect: 'manual' });
        if (!response.ok) {
          if ([403,429].includes(response.status)) blockedUntil = now() + 60000;
          throw Object.assign(Error(response.status === 404 ? '没有找到这个公开仓库或 README。' : 'GitHub 暂时无法查询，请稍后再试。'), { status: response.status === 404 ? 404 : 503 });
        }
        const text = await response.text();
        if (text.length > 1500000) throw Error('项目资料过大，请访问原仓库查看。');
        const data = JSON.parse(text);
        if (cache.size >= 40) cache.delete(cache.keys().next().value);
        const entry = { time: now(), data };
        cache.set(path, entry); return entry;
      } finally { running--; pending.delete(path); }
    })();
    pending.set(path, request); return request;
  }
  return {
    async search(q, page = 1) {
      if (typeof q !== 'string' || !q.trim() || q.length > 100 || /[\x00-\x1f]/.test(q) || !Number.isInteger(page) || page < 1 || page > 20) throw Object.assign(Error('请输入1—100字关键词，页码范围1—20。'), { status: 400 });
      // GitHub advanced qualifiers are deliberately excluded so callers cannot override the public scope.
      const words = q.match(/[\p{L}\p{N}_.+\-]+/gu)?.join(' ') || '';
      if (!words) throw Object.assign(Error('请输入项目名称或关键词。'), { status: 400 });
      const { data, time } = await get('search/repositories?q=' + encodeURIComponent(words + ' is:public archived:false') + '&sort=stars&order=desc&per_page=12&page=' + page);
      return { items: (data.items || []).filter(item => !item.private).map(sanitize).filter(Boolean), total: data.total_count || 0, incomplete: !!data.incomplete_results, page, fetchedAt: new Date(time).toISOString() };
    },
    async repo(name) {
      if (typeof name !== 'string' || !/^[A-Za-z0-9][\w.-]{0,99}\/[A-Za-z0-9][\w.-]{0,99}$/.test(name) || name.split('/').some(x => x === '.' || x === '..')) throw Object.assign(Error('仓库名称无效。'), { status: 400 });
      const { data, time } = await get('repos/' + name);
      const repo = sanitize(data);
      if (!repo || data.private) throw Object.assign(Error('仅支持公开仓库。'), { status: 404 });
      let readme = '', readmeUnavailable = false;
      try {
        const { data: body } = await get('repos/' + name + '/readme');
        if (body.encoding !== 'base64' || body.size > 200000 || typeof body.content !== 'string') throw Error('README too large');
        readme = Buffer.from(body.content, 'base64').toString('utf8');
      } catch { readmeUnavailable = true; }
      return { ...repo, readme, readmeUnavailable, fetchedAt: new Date(time).toISOString() };
    },
  };
}
module.exports = { createGithubBrowser };
