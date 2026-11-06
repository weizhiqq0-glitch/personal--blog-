// Retry reads only: repeating a registration or email request can cause side effects.
export async function request(url, options = {}, fetcher = fetch) {
  const readOnly = ['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase());
  for (let attempt = 0; attempt < (readOnly ? 2 : 1); attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), readOnly ? 12000 : 30000);
    try {
      return await fetcher(url, { ...options, signal: options.signal || controller.signal });
    } catch (cause) {
      if (readOnly && attempt === 0 && !options.signal?.aborted) continue;
      const message = readOnly
        ? '连接后端失败或超时。请切换 Wi-Fi／移动网络后点击重新连接；若持续失败，请联系站主检查后端访问地址。'
        : '未能确认服务器处理结果，请勿连续提交。验证码请先检查邮箱；注册请先尝试登录，仍失败再重新连接。';
      const error = new Error(message, { cause });
      error.code = 'NETWORK_ERROR';
      throw error;
    } finally { clearTimeout(timer); }
  }
}
