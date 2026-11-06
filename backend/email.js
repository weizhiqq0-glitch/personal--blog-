function createEmailSender(config = process.env) {
  config = Object.fromEntries(Object.entries(config).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value]));
  const provider = config.EMAIL_PROVIDER || 'emailjs';
  const from = config.EMAIL_FROM;
  const key = provider === 'resend' ? config.RESEND_API_KEY : config.BREVO_API_KEY;
  const available = provider === 'emailjs'
    ? !!(config.EMAILJS_SERVICE_ID && config.EMAILJS_TEMPLATE_ID && config.EMAILJS_PUBLIC_KEY && config.EMAILJS_PRIVATE_KEY)
    : !!(from && key && ['brevo', 'resend'].includes(provider));
  return {
    available,
    async send({ to, code }) {
      if (!available) { const error = Error('邮箱验证码服务尚未配置，暂时无法注册或绑定'); error.status = 503; throw error; }
      const subject = '你的小站验证码';
      const text = `你的验证码是：${code}。5分钟内有效。若非本人操作，请忽略此邮件。`;
      const request = provider === 'emailjs'
        ? { url: 'https://api.emailjs.com/api/v1.0/email/send', headers: {}, body: {
          service_id: config.EMAILJS_SERVICE_ID, template_id: config.EMAILJS_TEMPLATE_ID,
          user_id: config.EMAILJS_PUBLIC_KEY, accessToken: config.EMAILJS_PRIVATE_KEY,
          template_params: { to_email: to, code, subject, message: text },
        } }
        : provider === 'brevo'
        ? { url: 'https://api.brevo.com/v3/smtp/email', headers: { 'api-key': key }, body: { sender: { email: from, name: config.EMAIL_FROM_NAME || '我的小站' }, to: [{ email: to }], subject, textContent: text } }
        : { url: 'https://api.resend.com/emails', headers: { Authorization: 'Bearer ' + key }, body: { from, to: [to], subject, text } };
      let response;
      try { response = await fetch(request.url, { method: 'POST', headers: { ...request.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(15000) }); }
      catch { const error = Error('验证码邮件暂时发送失败，请稍后重试'); error.status = 502; throw error; }
      if (!response.ok) {
        // Only return fixed diagnostic labels, never the provider's raw response:
        // it may contain credentials, email addresses, or template parameters.
        let reason = '发信服务拒绝请求';
        if (provider === 'emailjs') {
          const detail = (await response.text().catch(() => '')).slice(0, 8000);
          if (/non.browser|browser.*only|API.*disabled/i.test(detail)) reason = 'EmailJS 未允许后端请求，请检查 Account → Security';
          else if (/private.?key|access.?token/i.test(detail)) reason = 'EmailJS 私钥校验失败，请检查 Private Key';
          else if (/public.?key|user.?id|account.*not.*found/i.test(detail)) reason = 'EmailJS 公钥或账号校验失败，请检查 Public Key';
          else if (/template/i.test(detail)) reason = 'EmailJS 模板校验失败，请检查 Template ID 和模板设置';
          else if (/service.?id|service.*not.*found|service.*invalid/i.test(detail)) reason = 'EmailJS 服务编号校验失败，请检查 Service ID';
          else if (/origin|domain|whitelist|allowlist/i.test(detail)) reason = 'EmailJS 来源限制拒绝请求，请检查 Security 的 Domains 设置';
          else if (/quota|limit|too many/i.test(detail) || response.status === 429) reason = 'EmailJS 发送额度或频率受限';
          else if (/(?:recipient|address).*(?:invalid|corrupt|missing|empty|required)|(?:invalid|missing|empty).*recipient/i.test(detail)) reason = 'EmailJS 收件人设置无效，请检查模板 To Email';
          else if (/smtp|authentication|credentials/i.test(detail)) reason = 'EmailJS 连接发件邮箱失败，请检查邮箱服务授权';
        }
        const error = Error(`${reason}（发信接口 HTTP ${response.status}）`);
        error.status = 502;
        throw error;
      }
    },
  };
}
module.exports = { createEmailSender };
