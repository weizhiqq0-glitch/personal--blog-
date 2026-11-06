import { useEffect, useState } from 'react';
import { api } from './api';

export function OwnerReportNotice({ user, route }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (user?.role !== 'owner' || !localStorage.getItem('mowu-owner-device')) return;
    const state = { active: true };
    const key = 'mowu-report-seen-' + user.id;
    async function check() {
      if (document.hidden) return;
      try {
        const status = await api('/management/device-status');
        if (!status.trusted || !state.active) return;
        const reports = await api('/management/login-reports');
        if (!state.active) return;
        if (route === '/security' || route === '/admin/security') {
          if (reports.length) localStorage.setItem(key, String(reports[0].time));
          setCount(0);
        } else setCount(reports.filter(report => report.time > Number(localStorage.getItem(key) || 0)).length);
      } catch { /* The report page provides connection errors and manual retry. */ }
    }
    check(); const timer = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => { state.active = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [user?.id, user?.role, route]);
  return user?.role === 'owner' && route !== '/security' && route !== '/admin/security' && count > 0 ? <div className="notice" role="status">有 {count} 条其他设备的站主登录报备。<a href="#/admin/security">查看报备 →</a></div> : null;
}
