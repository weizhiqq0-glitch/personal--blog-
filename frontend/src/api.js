const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, { token, ...options } = {}) {
  if (!import.meta.env.DEV && !origin) throw Error('网站尚未连接后端，请联系站长完成部署。');
  const response = await fetch(origin + '/api' + path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers },
  }).catch(() => { throw Error('暂时无法连接服务器，请稍后再试。'); });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => { throw Error('服务器返回异常，请检查后端地址。'); });
  if (!response.ok) { const error = Error(data.error || '请求失败'); error.status = response.status; throw error; }
  return data;
}
