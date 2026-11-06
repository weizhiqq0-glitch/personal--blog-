import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
const roles = { owner: '站主', admin: '管理员', user: '用户' };

export function AdminMembers() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    function load() {
      if (document.hidden) return;
      api('/management/members?page=' + page).then(value => { if (active) { setResult({ ...value, page }); setError(''); } }).catch(e => { if (active) setError(e.message); });
    }
    load(); const timer = setInterval(load, 30000);
    document.addEventListener('visibilitychange', load);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [page, refresh]);
  const current = result?.page === page ? result : null;
  return <><div className="admin-section-heading"><h2>成员列表</h2><button onClick={() => setRefresh(value => value + 1)}>刷新状态</button></div><p className="muted">最近2分钟内，已登录账号的网页处于前台并成功报告活动时显示在线。每30秒刷新；关闭或切到后台后，最多约2分30秒转为离线。退出登录后下次刷新转为离线。</p>
    {error && <p className="notice error" role="alert">状态更新失败，请刷新重试；下方不显示过期的在线判断。{error}</p>}
    {!current ? <p>正在加载成员…</p> : <div className="admin-table-wrap"><table><thead><tr><th>成员</th><th>身份</th><th>在线状态</th><th>最近活动</th></tr></thead><tbody>{current.members.map(member => <tr key={member.id}><td><span className="admin-member-name"><Avatar id={member.id} name={member.username} />{member.username}</span></td><td>{roles[member.role]}</td><td><span className={'presence-badge ' + (member.online && !error ? 'online' : '')}>{member.banned ? '已封禁' : error ? '待更新' : member.online ? '在线' : '离线'}</span></td><td>{member.lastActive ? new Date(member.lastActive).toLocaleString('zh-CN') : '暂无活动记录'}</td></tr>)}</tbody></table></div>}
    <div className="actions"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page} 页</span><button disabled={!current?.hasMore} onClick={() => setPage(value => value + 1)}>下一页</button></div>
  </>;
}
