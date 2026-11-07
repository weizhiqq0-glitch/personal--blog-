const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {PGlite}=require('@electric-sql/pglite');
const {openDatabase}=require('../database');
const {createPostgresDatabase}=require('../postgres');
const {createApp}=require('../app');
const {tokenHash}=require('../security');
for(const engine of ['sqlite','postgres'])test(engine+'：统一权限、全文搜索与图片上传安全边界',async()=>{
  const pg=engine==='postgres'?new PGlite():null;
  const db=pg?createPostgresDatabase({async query(sql,values){const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows};},async end(){await pg.close();}}):openDatabase(':memory:');
  await db.ready;
  for(const [index,role] of ['owner','admin','user'].entries()){
    await db.prepare('INSERT INTO users(username,password_hash,role,verified_at,permissions) VALUES (?,?,?,?,?)').run(role,'private-password-hash',role,'2026-01-01',JSON.stringify({'comment.create':true}));
    await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(role+'-session'),index+1,Date.now()+3600000);
  }
  await db.prepare('INSERT INTO articles(title,content,tags,author_id) VALUES (?,?,?,?)').run('小站记录','独特正文词 与 100%进度','["标签"]',1);
  const app=createApp({database:db,authLimit(req,res,next){next();}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
  async function call(path,role='owner',method='GET',body){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{method,headers:{'Content-Type':'application/json',...(role?{Authorization:'Bearer '+role+'-session'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:(response.headers.get('content-type')||'').includes('json')?await response.json():await response.arrayBuffer()};}
  const policy=enabled=>call('/management/role-policy','owner','PUT',{enabled});
  try{
    for(const role of ['admin','user',null]){assert.ok([401,403].includes((await call('/management/role-policy',role)).status));assert.ok([401,403].includes((await call('/management/role-policy',role,'PUT',{enabled:{'article.read':false,'comment.read':false,'comment.create':false}})).status));}
    assert.equal((await call('/management/role-policy')).data.enabled['comment.create'],true);
    assert.equal((await policy({'article.read':true,'comment.read':true,'comment.create':false,'article.manage':true})).status,400);
    assert.equal((await policy({'article.read':true,'comment.read':true,'comment.create':false})).status,200);
    assert.equal((await call('/articles/1/comments','user','POST',{content:'绕过全局限制'})).status,403);
    assert.equal((await call('/auth/me','user')).data.permissions.includes('comment.create'),false);
    assert.equal((await call('/articles/1/comments','admin','POST',{content:'管理员不受影响'})).status,201);
    assert.equal((await call('/articles/1/comments','owner','POST',{content:'站主不受影响'})).status,201);
    await db.prepare('UPDATE users SET permissions=? WHERE id=3').run('{"comment.create":false}');
    await policy({'article.read':true,'comment.read':true,'comment.create':true});
    assert.equal((await call('/auth/me','user')).data.permissions.includes('comment.create'),false);
    const found=await call('/search?q='+encodeURIComponent('独特正文词'),'user');assert.equal(found.status,200);assert.equal(found.data.articles.length,1);assert.equal(JSON.stringify(found.data).includes('private-password-hash'),false);
    assert.equal((await call('/search?q='+encodeURIComponent('%'),'user')).data.articles.length,1);
    assert.equal((await call('/search?q='+encodeURIComponent('_'),'user')).data.articles.length,0);
    await call('/content/moments','owner','POST',{title:'板块搜索测试',content:'内容关键词',url:'',image:''});
    assert.equal((await call('/search?q='+encodeURIComponent('内容关键词'),'user')).data.content.length,1);
    await policy({'article.read':false,'comment.read':false,'comment.create':false});
    assert.equal((await call('/search?q=100','user')).status,403);
    assert.equal((await call('/articles','user')).status,403);
    assert.equal((await call('/articles',null)).status,200);
    assert.equal((await call('/articles','owner')).status,200);
    assert.equal((await call('/content-media','user','POST',{image:'data:image/svg+xml;base64,PHN2Zy8+'})).status,403);
    assert.equal((await call('/content-media','owner','POST',{image:'data:image/svg+xml;base64,PHN2Zy8+'})).status,400);
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV5sAAAAASUVORK5CYII=';
    const media=await call('/content-media','admin','POST',{image:png});assert.equal(media.status,201);
    assert.equal((await call(media.data.path,null)).status,200);
    const entry=await call('/content/photos','owner','POST',{title:'本地相册图片',content:'说明',url:'',image:'/api'+media.data.path});assert.equal(entry.status,201);
    assert.equal((await call('/content/photos','owner','POST',{title:'恶意图片',content:'',url:'',image:'data:text/html;base64,aaaa'})).status,400);
    const events=await call('/management/events');assert.ok(events.data.some(event=>event.action==='role.permissions'));
    assert.equal((await call('/management/role-policy')).data.enabled['article.read'],false);
  }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});
test('小猫夜间范围与午夜属于同一个休眠周期',async()=>{
  const {nightPeriod}=await import('../../frontend/src/pet-clock.js');
  const date=(day,hour,minute=0)=>new Date(2026,10,day,hour,minute);
  assert.equal(nightPeriod(date(7,17,59)),null);
  assert.equal(nightPeriod(date(7,18)),'2026-11-7');
  assert.equal(nightPeriod(date(8,5,59)),'2026-11-7');
  assert.equal(nightPeriod(date(8,6)),null);
  assert.equal(nightPeriod(date(8,18)),'2026-11-8');
});
