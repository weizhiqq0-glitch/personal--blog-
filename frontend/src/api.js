import { request } from './request';
const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, { token = sessionStorage.getItem('blog-token'), ...options } = {}) {
  if (!import.meta.env.DEV && !origin) throw Error('网站尚未连接后端，请联系站长完成部署。');
  let visitor = localStorage.getItem('blog-visitor');
  if (!/^[a-f0-9]{64}$/.test(visitor || '')) { visitor = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''); localStorage.setItem('blog-visitor', visitor); }
  const response = await request(origin + '/api' + path, {
    ...options,
    headers: { 'X-Visitor-Token': visitor, ...(localStorage.getItem('mowu-owner-device') ? { 'X-Owner-Device': localStorage.getItem('mowu-owner-device') } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => { throw Error('服务器返回异常，请检查后端地址。'); });
  if (!response.ok) { const error = Error(data.error || '请求失败'); error.status = response.status; throw error; }
  return data;
}

export const apiMediaUrl = path => origin + '/api' + path;
export const resolveMediaUrl = value => value?.startsWith('/api/content-media/') ? apiMediaUrl(value.slice(4)) : value;
