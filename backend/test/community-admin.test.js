const {test}=require('node:test');const assert=require('node:assert/strict');const {once}=require('node:events');const {PGlite}=require('@electric-sql/pglite');const {createPostgresDatabase}=require('../postgres');const {createApp}=require('../app');const {tokenHash}=require('../security');
for(const engine of ['sqlite','postgres'])test(engine+' 后台身份、全站背景与会话在线状态',async()=>{
 const pg=engine==='postgres'?new PGlite():null;
 const database=pg?createPostgresDatabase({async query(sql,values){const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows};},async end(){await pg.close();}}):undefined;
 const app=createApp({dbPath:':memory:',...(database?{database}:{}),passwords:{async hashPassword(){return 'fixture';},async verifyPassword(p,h){return p==='Fixture123'&&h==='fixture';}}});const db=app.locals.db;await db.ready;
 for(const [name,role] of [['owner','owner'],['admin','admin'],['normal','user']])await db.prepare('INSERT INTO users(username,password_hash,role,verified_at) VALUES (?,?,?,?)').run(name,'fixture',role,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',token,body){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.status===204?null:await r.json()};}
 async function login(username,path='/auth/login'){return await call(path,'POST',null,{username,password:'Fixture123'});}
 try{
 const owner=(await login('owner')).data.token,admin=(await login('admin')).data.token,normal=(await login('normal')).data.token;
 assert.equal((await login('normal','/auth/staff-login')).status,403);assert.equal((await login('admin','/auth/staff-login')).status,200);
 await db.prepare('UPDATE users SET permissions=? WHERE id=3').run(JSON.stringify({'site.manage':true,'feedback.manage':true,'user.ban':true,'article.manage':true}));
 for(const path of ['/management/members','/management/users','/management/feedback'])assert.equal((await call(path,'GET',normal)).status,403);
 assert.equal((await call('/management/members')).status,401);
 const bg={kind:'video',url:'https://example.com/background.mp4'};
 assert.equal((await call('/management/appearance','PUT',normal,bg)).status,403);
 assert.equal((await call('/management/appearance','PUT',admin,{kind:'image',url:'javascript:alert(1)'})).status,400);
 assert.equal((await call('/management/appearance','PUT',admin,bg)).status,200);assert.equal((await call('/appearance')).data.kind,'video');
 assert.equal((await call('/management/appearance','PUT',admin,{image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=';
 assert.equal((await call('/management/appearance','PUT',owner,{image})).status,200);const media=await fetch(base+'/appearance/media');assert.equal(media.headers.get('content-type'),'image/png');assert.ok((await media.arrayBuffer()).byteLength>0);
 assert.equal((await call('/presence','POST')).status,401);assert.equal((await call('/presence','POST',normal,{userId:1})).status,204);
 let members=(await call('/management/members','GET',admin)).data.members;assert.equal(members.find(m=>m.id===3).online,true);assert.equal(members.find(m=>m.id===1).online,false);assert.equal('contact' in members[0],false);
 assert.equal((await call('/members')).data.members.some(m=>'online' in m||'lastActive' in m),false);
 await db.prepare('UPDATE account_presence SET last_seen=? WHERE session_hash=?').run(Date.now()-121000,tokenHash(normal));assert.equal((await call('/management/members','GET',owner)).data.members.find(m=>m.id===3).online,false);
 await db.prepare('UPDATE account_presence SET last_seen=? WHERE session_hash=?').run(Date.now(),tokenHash(normal));
 await call('/auth/logout','POST',normal);assert.equal((await call('/management/members','GET',admin)).data.members.find(m=>m.id===3).online,false);
 await db.prepare('UPDATE users SET role=? WHERE id=2').run('user');assert.equal((await call('/management/members','GET',admin)).status,403);assert.equal((await call('/management/appearance','PUT',admin,bg)).status,403);
 assert.equal((await call('/management/appearance','DELETE',owner)).status,200);assert.equal((await call('/appearance')).data.source,'');
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
