import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { UserSettings } from './UserSettings';

function SettingsOverlay({ onClose, ...settings }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className="settings-overlay" aria-label="用户设置" onCancel={onClose} onClick={event => {
    if (event.target === event.currentTarget || event.target.closest('a[href]')) onClose();
  }}><div className="settings-overlay-bar"><span>我的设置</span><button autoFocus onClick={onClose} aria-label="收起用户设置">×</button></div><UserSettings {...settings} /></dialog>;
}

export function SettingsDock(props) {
  const [open, setOpen] = useState(false);
  return <><button className="settings-dock-toggle" aria-label="展开用户设置" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="settings" size={19} /></button>{open && <SettingsOverlay {...props} onClose={() => setOpen(false)} onSaved={text => { setOpen(false); props.onSaved(text); }} />}</>;
}
