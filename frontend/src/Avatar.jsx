import { useState } from 'react';
const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export function Avatar({ id, name = '', version = 0, size = 32 }) {
  return <AvatarImage key={id + ':' + version} id={id} name={name} version={version} size={size} />;
}
function AvatarImage({ id, name, version, size }) {
  const [failed, setFailed] = useState(false);
  return <span className="user-avatar" style={{ width: size, height: size }} aria-label={name + '的头像'}>
    {id && !failed ? <img src={origin + '/api/avatars/' + id + '?v=' + version} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{Array.from(name.trim())[0]?.toUpperCase() || '✦'}</span>}
  </span>;
}
