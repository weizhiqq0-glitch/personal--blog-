const {tokenHash}=require('./security');
function createGithubTranslation({db,fetcher=fetch,now=Date.now,translateText}) {
  let ready;const pending=new Map();
  async function init(){if(!ready)ready=Promise.resolve(db.ready).then(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS github_translations(text_hash TEXT PRIMARY KEY,translated TEXT NOT NULL,created_at BIGINT NOT NULL)').run();await db.prepare('CREATE TABLE IF NOT EXISTS github_translation_budget(day TEXT PRIMARY KEY,used INTEGER NOT NULL)').run();}).catch(error=>{ready=undefined;throw error;});await ready;}
  return async text=>{
    if(typeof text!=='string'||!text.trim()||text.length>400)throw Object.assign(Error('项目简介须为1—400字'),{status:400});
    if(/[\u3400-\u9fff]/.test(text))return {text,source:'original'};
    await init();const key=tokenHash('literal-v2:'+text),cached=await db.prepare('SELECT translated FROM github_translations WHERE text_hash=?').get(key);if(cached)return {text:cached.translated,source:'machine'};
    if(pending.has(key))return pending.get(key);
    if(pending.size>=3)throw Object.assign(Error('翻译繁忙，请稍后点击重试'),{status:429});
    const job=(async()=>{const day=new Date(now()).toISOString().slice(0,10);
      const reserved=await db.prepare('INSERT INTO github_translation_budget(day,used) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET used=github_translation_budget.used+excluded.used WHERE github_translation_budget.used+excluded.used<=4500').run(day,text.length);
      if(!reserved.changes)throw Object.assign(Error('今日免费翻译次数已达本站上限，请查看原文'),{status:429});
      let translated='';
      if(translateText)try{translated=await translateText(text);}catch{/* Public translation fallbacks remain available. */}
      if(!translated)try {
        const response=await fetcher('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q='+encodeURIComponent(text),{redirect:'manual',signal:AbortSignal.timeout(3500)});
        if(!response.ok)throw Error('Primary unavailable');
        const body=await response.text();if(body.length>20000)throw Error('Response too large');const data=JSON.parse(body);translated=Array.isArray(data?.[0])?data[0].map(item=>typeof item?.[0]==='string'?item[0]:'').join(''):'';
      } catch { /* Try a separate public provider below. */ }
      if(!translated)try {
        const response=await fetcher('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair=en%7Czh-CN',{redirect:'manual',signal:AbortSignal.timeout(6500)});
        if(!response.ok)throw Error('Fallback unavailable');
        const body=await response.text();if(body.length>100000)throw Error('Response too large');const data=JSON.parse(body);
        if(Number(data.responseStatus)!==200||typeof data.responseData?.translatedText!=='string')throw Error('Fallback unavailable');
        translated=data.responseData.translatedText.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      } catch { /* Public providers may rate-limit shared cloud IPs. */ }
      if(!translated) {
        const auth=await fetcher('https://edge.microsoft.com/translate/auth',{redirect:'manual',signal:AbortSignal.timeout(3500)});
        if(!auth.ok)throw Error('翻译服务暂不可用');const token=await auth.text();if(token.length>12000||!/^[A-Za-z0-9_.-]+$/.test(token))throw Error('翻译服务暂不可用');
        const response=await fetcher('https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans',{method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify([{Text:text}]),signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw Error('翻译服务暂不可用');const body=await response.text();if(body.length>20000)throw Error('翻译返回异常');translated=JSON.parse(body)?.[0]?.translations?.[0]?.text||'';
      }
      if(!translated||translated.length>Math.max(100,text.length*3)||translated.includes('\n\n'))throw Error('翻译返回异常');
      await db.prepare('INSERT INTO github_translations(text_hash,translated,created_at) VALUES (?,?,?) ON CONFLICT(text_hash) DO UPDATE SET translated=excluded.translated,created_at=excluded.created_at').run(key,translated,now());
      await db.prepare('DELETE FROM github_translations WHERE created_at<?').run(now()-30*86400000);await db.prepare('DELETE FROM github_translation_budget WHERE day<?').run(new Date(now()-7*86400000).toISOString().slice(0,10));
      return {text:translated,source:'machine'};
    })();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
  };
}
module.exports={createGithubTranslation};
