import { createWidget } from 'l2d-widget';
const tell = petStatus => parent.postMessage({ petStatus }, location.origin);
const loading = document.getElementById('loading');
let widget, finished = false;
function fail() { if (finished) return; finished = true; loading.textContent = '模型未加载，请稍后重新唤醒。'; tell('error'); widget?.destroy().catch(() => {}); }
const timeout = setTimeout(fail, 25000);
try {
  widget = createWidget({
    model: { path: 'https://raw.githubusercontent.com/hacxy/live2d-models/main/models/cat-black/model.json', volume: 0, tips: { welcomeMessage: ['欢迎来到 mowu 的小站 ✦'], messages: ['记得伸伸懒腰，喝口水～', '今天也有值得记录的小事。'], interval: 20000, duration: 4000 } },
    size: { width: 230, height: 270 }, position: 'bottom-left', primaryColor: 'rgba(107,143,113,.94)', transitionType: 'fade', transitionDuration: 300,
    menus: { items: [{ label: '打个招呼', onClick: () => { loading.textContent = '喵，今天也要开心！'; } }] },
  });
  widget.l2d.on('loaded', () => { if (finished) return; finished = true; clearTimeout(timeout); loading.remove(); tell('ready'); });
  widget.l2d.on('error', fail);
} catch { clearTimeout(timeout); fail(); }
window.addEventListener('pagehide', () => { clearTimeout(timeout); });
