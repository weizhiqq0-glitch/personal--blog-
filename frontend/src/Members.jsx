import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';

export function Members({ user }) {
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/members').then(result => { if (active) { setMembers(result.members); setMore(result.hasMore); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function loadMore() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = members.length ? page + 1 : 1;
      const result = await api('/members?page=' + next);
      setMembers(current => [...new Map([...current, ...result.members].map(member => [member.id, member])).values()]);
      setPage(next); setMore(result.hasMore);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="article-card panel members-page"><p className="eyebrow">OUR LITTLE COMMUNITY</p><h1>站员</h1><p className="muted">在这里相遇，一起留下故事。</p>
    {error && <p className="notice error" role="alert">{error}<button disabled={busy} onClick={loadMore}>重试</button></p>}
    {[['owner', '站主'], ['admin', '管理员'], ['user', '用户']].map(([role, label]) => <section className={'member-group member-' + role} key={role}><h2>{label}</h2><div className="member-grid">{members.filter(member => member.role === role).map(member => <article className="member-card" key={member.id}><Avatar id={member.id} name={member.username} version={member.id === user?.id ? user.avatarVersion : 0} size={role === 'owner' ? 72 : 48} /><div><strong>{member.username}</strong><span>{label}</span></div></article>)}</div>{!busy && !error && !more && !members.some(member => member.role === role) && <p className="muted">暂无{label}。</p>}</section>)}
    {busy && <p role="status">正在加载站员…</p>}{more && <button disabled={busy} onClick={loadMore}>查看更多站员</button>}
  </section>;
}
