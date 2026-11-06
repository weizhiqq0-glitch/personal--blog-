import { useEffect, useRef, useState } from 'react';
export const SITE_STARTED_AT = '2026-11-06T13:18:45+08:00';
const weatherName = code => code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '有雾' : code <= 67 ? '有雨' : code <= 77 ? '有雪' : code <= 82 ? '阵雨' : code <= 86 ? '阵雪' : '雷雨';
export function SiteStatus() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(0);
  useEffect(() => {
    const requestCounter = pending;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(timer); requestCounter.current++; };
  }, []);
  function clearWeather() { pending.current++; setWeather(null); setMessage('已关闭本次天气显示，刷新页面也不会自动定位。'); setBusy(false); }
  function locate() {
    if (!navigator.geolocation) { setMessage('此浏览器不支持定位。'); return; }
    const request = ++pending.current;
    setBusy(true); setMessage('正在等待定位授权…');
    navigator.geolocation.getCurrentPosition(async position => {
      if (request !== pending.current) return;
      // Approximate to 0.1 degree before contacting the weather provider. Never send to blog API.
      const latitude = Number(position.coords.latitude.toFixed(1)), longitude = Number(position.coords.longitude.toFixed(1));
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`, { signal: AbortSignal.timeout(12000), referrerPolicy: 'no-referrer', credentials: 'omit' });
        if (!response.ok) throw Error('天气服务暂不可用');
        const data = await response.json();
        if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw Error('天气数据暂不可用');
        if (request === pending.current) { setWeather({ latitude, longitude, temperature: data.current.temperature_2m, description: weatherName(data.current.weather_code), time: new Date() }); setMessage(''); }
      } catch (e) { if (request === pending.current) setMessage(e.name === 'TimeoutError' ? '天气查询超时，请稍后重试。' : '天气查询失败，请稍后重试。'); }
      finally { if (request === pending.current) setBusy(false); }
    }, error => {
      if (request !== pending.current) return;
      setBusy(false); setMessage(error.code === 1 ? '未获得定位授权，天气保持关闭。' : '无法获取位置，请检查系统定位设置或稍后重试。');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  }
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(SITE_STARTED_AT)) / 1000));
  return <section className="site-status" aria-label="小站时光与天气"><div><p className="eyebrow">小站时光</p><strong>{now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</strong><p>已相伴 {Math.floor(seconds / 86400)} 天 {Math.floor(seconds / 3600) % 24} 时 {Math.floor(seconds / 60) % 60} 分 {seconds % 60} 秒</p></div><div className="weather-widget"><p className="eyebrow">你的此刻</p>
    {weather ? <><strong>{weather.description} · {weather.temperature}°C</strong><p>所在区域：纬度 {weather.latitude}°，经度 {weather.longitude}°（约略位置）</p><p className="muted">更新于 {weather.time.toLocaleTimeString('zh-CN')} · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据 Open-Meteo</a></p><button disabled={busy} onClick={locate}>更新天气</button> <button onClick={clearWeather}>关闭天气</button></> : <><p>允许后，仅向你显示本地天气。查询会向 Open-Meteo 发送约略位置。</p><details><summary>定位与天气说明</summary><p className="muted">点击下方按钮表示同意获取位置，并将取整到0.1°的经纬度发送至 Open-Meteo 查询天气。天气服务也会接收你的网络 IP。博客服务器不接收或保存定位，其他用户和站主看不到你的天气。关闭后可在浏览器设置中撤销定位权限。</p></details><button disabled={busy} onClick={locate}>{busy ? '正在查询…' : '同意定位并显示本地天气'}</button></>}
    {message && <p role="status">{message}</p>}
  </div></section>;
}
