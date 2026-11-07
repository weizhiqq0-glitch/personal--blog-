const {test}=require('node:test');const assert=require('node:assert/strict');const {openDatabase}=require('../database');const {createGithubTranslation}=require('../github-translation');
test('中文简介翻译：固定地址、缓存、并发合并、字数限额与失败降级',async()=>{
 const db=openDatabase(':memory:');let calls=0;const translate=createGithubTranslation({db,fetcher:async url=>{calls++;assert.ok(url.startsWith('https://translate.googleapis.com/'));return new Response(JSON.stringify([[['浏览器实用工具','Browser tools']]]));}});
 try{assert.equal((await translate('中文简介')).source,'original');assert.equal(calls,0);const values=await Promise.all([translate('Browser tools'),translate('Browser tools')]);assert.equal(values[0].text,'浏览器实用工具');assert.equal(calls,1);await translate('Browser tools');assert.equal(calls,1);await assert.rejects(translate('x'.repeat(401)),e=>e.status===400);
 const day=new Date().toISOString().slice(0,10);await db.prepare('UPDATE github_translation_budget SET used=6000 WHERE day=?').run(day);await assert.rejects(translate('New project'),e=>e.status===429);assert.equal(calls,1);assert.equal((await translate('Browser tools')).text,'浏览器实用工具');
 }finally{db.close();}
});
