const express = require('express');
const { randomBytes } = require('node:crypto');
const { validImage } = require('./community-admin');
function createContentMedia({db,requireStaff,requirePermission,authLimit}) {
  let ready;
  function init(){if(!ready)ready=Promise.resolve(db.ready).then(()=>db.prepare('CREATE TABLE IF NOT EXISTS content_media(media_key TEXT PRIMARY KEY,mime TEXT NOT NULL,payload TEXT NOT NULL,created_at BIGINT NOT NULL)').run()).catch(error=>{ready=undefined;throw error;});return ready;}
  const router=express.Router();
  router.post('/',requireStaff,requirePermission('site.manage'),authLimit,async(req,res)=>{
    const image=validImage(req.body?.image);if(!image)return res.status(400).json({error:'图片格式不正确或压缩后超过512KB'});
    await init();const count=await db.prepare('SELECT COUNT(*) AS n FROM content_media').get();if(Number(count.n)>=200)return res.status(400).json({error:'本站已达到200张图片存储上限，请联系站主整理'});
    const key=randomBytes(16).toString('hex');await db.prepare('INSERT INTO content_media(media_key,mime,payload,created_at) VALUES (?,?,?,?)').run(key,image.mime,image.payload,Date.now());res.status(201).json({path:'/content-media/'+key});
  });
  router.get('/:key',async(req,res)=>{if(!/^[a-f0-9]{32}$/.test(req.params.key))return res.status(404).end();await init();const row=await db.prepare('SELECT mime,payload FROM content_media WHERE media_key=?').get(req.params.key);if(!row)return res.status(404).end();res.set('Content-Type',row.mime).set('Content-Security-Policy',"default-src 'none'; sandbox");res.send(Buffer.from(row.payload,'base64'));});
  return router;
}
module.exports={createContentMedia};
