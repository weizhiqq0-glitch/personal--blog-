import { nightPeriod } from './pet-clock';
import { createWidget } from 'l2d-widget';
import './pet-interactions.css';
const tell = petStatus => parent.postMessage({ petStatus }, location.origin);
const loading = document.getElementById('loading');
const bubble = document.createElement('p');
bubble.className = 'cat-bubble'; bubble.setAttribute('role','status'); bubble.setAttribute('aria-live','polite'); bubble.hidden = true;
const panel = document.createElement('div'); panel.className = 'cat-controls';
const toggle = document.createElement('button'); toggle.className = 'cat-menu-toggle'; toggle.textContent = '互动 ♡'; toggle.setAttribute('aria-expanded','false');
const menu = document.createElement('div'); menu.className = 'cat-menu'; menu.hidden = true; menu.id='cat-interactions'; toggle.setAttribute('aria-controls',menu.id);
panel.append(menu,toggle); document.body.append(bubble,panel);
let widget, ready = false, disposed = false, sleeping = false, lastAction = 0, hideBubble, idle;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const pick = items => items[Math.floor(Math.random()*items.length)];
function say(text) {
  clearTimeout(hideBubble); bubble.textContent=text; bubble.hidden=false;
  hideBubble=setTimeout(()=>{bubble.hidden=true;},5000);
}
function motion(index) {
  if (!ready || sleeping || reduce.matches || document.hidden) return;
  try { widget.l2d.playMotion('',index ?? Math.floor(Math.random()*8),3); } catch { /* Dialogue still works if a motion is unavailable. */ }
}
function interact(action) {
  if (!ready) { say('我还在赶来，等我一下喵～'); return; }
  if (Date.now()-lastAction<800) return; lastAction=Date.now();
  if (action==='sleep') {
    setSleep(!sleeping);
    if(currentNight){if(!sleeping)sessionStorage.setItem('mowu-cat-awake',currentNight);else sessionStorage.removeItem('mowu-cat-awake');}
    say(sleeping?'呼噜…我在这里陪你安静一会儿。':'睡醒啦！又是元气满满的小猫。');
    if(!sleeping)motion(0); return;
  }
  if(sleeping){say('呼噜…点「叫醒小猫」，再一起玩吧。');return;}
  if(action==='search'){parent.postMessage({petAction:'search'},location.origin);say('想找什么？我带你去搜索小站！');menu.hidden=true;toggle.setAttribute('aria-expanded','false');return;}
  const replies={
    pet:['呼噜呼噜…这个力度刚刚好。','耳朵也想被摸摸，喵～','摸摸头，烦恼都跑掉。'],
    feed:['小鱼干收到！今天你就是我最喜欢的人。','啊呜…吃完这条，就陪你认真看文章。','谢谢投喂！也记得好好吃饭哦。'],
    play:['抓到啦！再来一次，再来一次！','逗猫棒往这边一点…嘿！','猫猫出击！刚才只是热身。'],
    mood:['今日心情：像晒过太阳的被子一样软。','猫猫签：今天适合完成一件小事。','今日幸运物：一杯水，和一个好好休息的你。','今天也想听你说：我做得不错。'],
    body:['肚肚是猫猫的秘密基地！','被发现啦，我正在偷偷伸懒腰。','喵？你也想和我一起发呆吗？'],
  };
  say(pick(replies[action]||replies.pet)); motion(action==='feed'?2:action==='play'?5:undefined);
}
let sleepButton, clockTimer, currentNight;
function setSleep(value) {
  sleeping=value;
  if(ready)widget.l2d.getCanvas().style.opacity=sleeping?'.45':'1';
  sleepButton.textContent=sleeping?'☀ 叫醒小猫':'☾ 休息一下';
}
function syncClock() {
  const period=nightPeriod();
  if(currentNight===period)return;
  currentNight=period;
  const awake=period && sessionStorage.getItem('mowu-cat-awake')===period;
  setSleep(!!period&&!awake);
  if(ready)say(sleeping?'晚上啦，猫猫先睡了。点我就能叫醒喵～':'喵，我来陪你啦！');
}

for (const [action,label] of [['pet','♡ 摸摸头'],['feed','魚 喂小鱼'],['play','✧ 逗猫玩'],['mood','☁ 今日心情'],['search','⌕ 帮我搜索'],['sleep','☾ 休息一下']]) {
  const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>interact(action));menu.append(button);if(action==='sleep')sleepButton=button;
}
toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});
function fail() { if(ready||disposed)return; clearTimeout(timeout);loading.textContent='模型暂时未加载，请收起后重新唤醒。';tell('error'); }
const timeout=setTimeout(fail,25000);
try {
  widget=createWidget({
    model:{path:'https://raw.githubusercontent.com/hacxy/live2d-models/main/models/cat-black/model.json',volume:0,tips:false},
    size:{width:Math.min(230,innerWidth),height:Math.min(270,innerHeight-44)},position:'bottom-left',primaryColor:'rgba(107,143,113,.94)',transitionType:'fade',transitionDuration:300,
    menus:{items:[]},
  });
  widget.l2d.on('loaded',()=>{
    if(disposed)return; ready=true; clearTimeout(timeout); loading.remove();tell('ready');
    const canvas=widget.l2d.getCanvas();canvas.style.transition='opacity .2s';
    canvas.addEventListener('pointerup',event=>{
      if(event.button!==0)return; const box=canvas.getBoundingClientRect();const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
      // This model has no named hit areas: use the visible central silhouette.
      if(x<.17||x>.83||y<.18||y>.94)return;
      interact(sleeping?'sleep':y<.52?'pet':'body');
    });
    syncClock(); clockTimer=setInterval(syncClock,15000); document.addEventListener('visibilitychange',syncClock);
    idle=setInterval(()=>{if(document.hidden||sleeping||!menu.hidden||Date.now()-lastAction<20000)return;motion();say(pick(['伸个懒腰～你也活动一下肩膀吧。','我在呢，慢慢看，不着急。','记得喝口水，猫猫提醒！']));},45000);
  });
  widget.l2d.on('error',fail);
} catch {fail();}
window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timeout);clearTimeout(hideBubble);clearInterval(idle);clearInterval(clockTimer);document.removeEventListener('visibilitychange',syncClock);widget?.destroy().catch(()=>{});},{once:true});
