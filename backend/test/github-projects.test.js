const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGithubProjects, queries } = require('../github-projects');
test('GitHub分类使用动态日期；拒绝任意查询并过滤恶意仓库名', async () => {
  let count = 0;
  const load = createGithubProjects({ fetcher: async url => {
    count++; assert.ok(url.startsWith('https://api.github.com/search/repositories?'));
    return { ok: true, json: async () => ({ items: [{ full_name: 'demo/project', description: 'demo', stargazers_count: 12 }, { full_name: 'javascript:alert(1)' }] }) };
  } });
  assert.equal(await load('https://bad.test'), null);
  assert.equal(count, 0);
  const data = await load('hot');
  assert.equal(data.items.length, 1); assert.equal(data.items[0].url, 'https://github.com/demo/project');
  assert.deepEqual(await load('hot'), data); assert.equal(count, 1);
  assert.match(queries(Date.parse('2026-11-07')).emerging, /2026-08-09/);
});
test('并发请求合并，失败退避，离线快照不冒充榜单，旧数据保留日期', async () => {
  let count = 0, clock = Date.now(), fail = false;
  const load = createGithubProjects({ now: () => clock, fetcher: async () => { count++; await new Promise(resolve => setTimeout(resolve, 5)); return { ok: !fail, json: async () => ({ items: [] }) }; } });
  const [a,b] = await Promise.all([load('hot'), load('hot')]);
  assert.deepEqual(a,b); assert.equal(count,1);
  clock += 7 * 3600000; fail = true;
  const stale = await load('hot'); assert.equal(stale.stale,true); assert.equal(stale.fetchedAt,a.fetchedAt);
  await load('hot'); assert.equal(count,2);
  const fallback = await load('emerging'); assert.equal(fallback.source,'snapshot'); assert.equal(fallback.stale,true);
  const picks = await load('picks'); assert.equal(picks.source,'curated'); assert.ok(picks.items.length);
});
