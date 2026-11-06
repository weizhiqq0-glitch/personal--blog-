function createEmailSender(config = process.env) {
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
      if (!response.ok) { const error = Error('验证码邮件发送失败，请站主检查发信服务配置'); error.status = 502; throw error; }
    },
  };
}
module.exports = { createEmailSender };
