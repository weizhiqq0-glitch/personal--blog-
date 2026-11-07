import { useEffect, useRef, useState } from 'react';
const destinations = [['/', '首页'], ['/search', '搜索'], ['/github', 'GitHub'], ['/tools', '工具箱'], ['/projects', '项目'], ['/archive', '归档'], ['/photos', '照片墙'], ['/music', '音乐'], ['/moments', '说说'], ['/chatter', '碎碎念'], ['/friends', '友链'], ['/about', '关于'], ['/members', '站员']];
function NavigationWheel({ route, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  return <dialog className="wheel-dialog" ref={dialog} aria-label="圆盘导航" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="navigation-wheel"><div className="wheel-center"><button autoFocus onClick={onClose} aria-label="关闭圆盘导航">×</button></div>{destinations.map(([path, label], index) => {
    const angle = index * Math.PI * 2 / destinations.length - Math.PI / 2;
    return <a href={'#' + path} key={path} onClick={onClose} aria-current={route === path ? 'page' : undefined} style={{ left: 50 + Math.cos(angle) * 36 + '%', top: 50 + Math.sin(angle) * 36 + '%' }}>{label}</a>;
  })}</div><p className="wheel-caption">选一站，去看看。<span>Esc 或点击圆心关闭</span></p></dialog>;
}
export function RadialNav({ route }) {
  const [open, setOpen] = useState(false);
  return <><button className="wheel-launcher" onClick={() => setOpen(true)} aria-label="打开圆盘导航" aria-haspopup="dialog" aria-expanded={open}>⌘<span>导航</span></button>{open && <NavigationWheel route={route} onClose={() => setOpen(false)} />}</>;
}
