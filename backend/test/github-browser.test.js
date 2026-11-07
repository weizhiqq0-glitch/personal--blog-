const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGithubBrowser } = require('../github-browser');
test('API rejects invalid queries and limits repeated calls without contacting GitHub', async () => {
  const { createApp } = require('../app');
  const { once } = require('node:events');
  const app = createApp({ dbPath: ':memory:' });
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/api/github-search?q=';
  try {
    for (let n=0;n<30;n++) assert.equal((await fetch(url)).status,400);
    const response=await fetch(url,{headers:{'cf-connecting-ip':'1.2.3.4','x-forwarded-for':'5.6.7.8'}});
    assert.equal(response.status,429); assert.match((await response.json()).error,/频繁/);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); app.locals.db.close(); }
});
test('public search fixes upstream, coalesces/cache requests and rejects invalid input', async () => {
  const urls = [];
  const browser = createGithubBrowser({ fetcher: async url => { urls.push(url); return new Response(JSON.stringify({ items: [{ full_name:'owner/tool', stargazers_count:12 }], total_count:1 })); } });
  const [a,b] = await Promise.all([browser.search('tool is:private'),browser.search('tool is:private')]);
  assert.deepEqual(a,b); assert.equal(urls.length,1);
  const url = new URL(urls[0]); assert.equal(url.origin,'https://api.github.com');
  assert.ok(url.searchParams.get('q').endsWith('is:public archived:false'));
  assert.ok(!url.searchParams.get('q').includes('is:private'));
  assert.equal(a.items[0].url,'https://github.com/owner/tool');
  await browser.search('tool is:private'); assert.equal(urls.length,1);
  for (const q of ['', 'x'.repeat(101), '\u0000']) await assert.rejects(browser.search(q), { status:400 });
  await assert.rejects(browser.search('test',21), { status:400 });
  await assert.rejects(browser.repo('../../evil'), { status:400 });
  await assert.rejects(browser.repo('https://example.com'), { status:400 });
});
test('repo returns inert README and never private repository fields', async () => {
  const calls=[];
  const browser=createGithubBrowser({fetcher:async url=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/readme') ? { encoding:'base64',size:25,content:Buffer.from('<script>bad()</script>').toString('base64') } : {full_name:'owner/tool',private:false,secret:'must not leak'}));}});
  const repo=await browser.repo('owner/tool'); assert.equal(repo.readme,'<script>bad()</script>'); assert.equal(repo.secret,undefined);
  assert.deepEqual(calls,['https://api.github.com/repos/owner/tool','https://api.github.com/repos/owner/tool/readme']);
  const privateBrowser=createGithubBrowser({fetcher:async()=>new Response(JSON.stringify({full_name:'owner/private',private:true}))});
  await assert.rejects(privateBrowser.repo('owner/private'),{status:404});
});
test('upstream rate limits cause cooldown; missing or large README degrades safely',async()=>{
  let calls=0; const limited=createGithubBrowser({fetcher:async()=>{calls++;return new Response('',{status:403});}});
  await assert.rejects(limited.search('tool'),{status:503});
  await assert.rejects(limited.search('another'),{status:429});assert.equal(calls,1);
  const browser=createGithubBrowser({fetcher:async url=>new Response(JSON.stringify(url.endsWith('/readme')?{encoding:'base64',size:200001,content:'YQ=='}:{full_name:'owner/tool'}))});
  assert.equal((await browser.repo('owner/tool')).readmeUnavailable,true);
});
test('uses Worker-compatible manual mode and rejects upstream redirects',async()=>{
  const browser=createGithubBrowser({fetcher:async(url,options)=>{
    assert.equal(options.redirect,'manual');
    return new Response('',{status:302,headers:{Location:'https://untrusted.example'}});
  }});
  await assert.rejects(browser.search('tool'),{status:503});
});
