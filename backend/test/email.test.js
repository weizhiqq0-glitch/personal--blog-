const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEmailSender } = require('../email');

test('EmailJS 后端请求映射收件人与验证码，并要求私钥及完整配置', async t => {
  const config = {
    EMAIL_PROVIDER: 'emailjs', EMAILJS_SERVICE_ID: 'service_test',
    EMAILJS_TEMPLATE_ID: 'template_test', EMAILJS_PUBLIC_KEY: 'public_test',
    EMAILJS_PRIVATE_KEY: 'private_test',
  };
  for (const field of ['EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY']) {
    assert.equal(createEmailSender({ ...config, [field]: '' }).available, false);
  }
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.emailjs.com/api/v1.0/email/send');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      service_id: 'service_test', template_id: 'template_test',
      user_id: 'public_test', accessToken: 'private_test',
      template_params: {
        to_email: 'recipient@example.com', code: '012345', subject: '你的小站验证码',
        message: '你的验证码是：012345。5分钟内有效。若非本人操作，请忽略此邮件。',
      },
    });
    return new Response('OK');
  });
  await createEmailSender(config).send({ to: 'recipient@example.com', code: '012345' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('发信服务额度/授权失败或网络异常不能返回成功或泄露第三方响应', async t => {
  const config = {
    EMAIL_PROVIDER: 'emailjs', EMAILJS_SERVICE_ID: 'service_test',
    EMAILJS_TEMPLATE_ID: 'template_test', EMAILJS_PUBLIC_KEY: 'public_test', EMAILJS_PRIVATE_KEY: 'private_test',
  };
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('private provider detail', { status: 429 }));
  const check = error => error.status === 502 && !error.message.includes('private provider detail');
  await assert.rejects(createEmailSender(config).send({ to: 'a@example.com', code: '123456' }), check);
  fetch.mock.mockImplementation(async () => { throw Error('private provider detail'); });
  await assert.rejects(createEmailSender(config).send({ to: 'a@example.com', code: '123456' }), check);
});


test('EmailJS 拒绝原因分类为固定提示，不回显密钥、邮箱或验证码', async t => {
  const config = {
    EMAIL_PROVIDER: 'emailjs', EMAILJS_SERVICE_ID: 'service_test', EMAILJS_TEMPLATE_ID: 'template_test',
    EMAILJS_PUBLIC_KEY: 'public_test', EMAILJS_PRIVATE_KEY: 'private_test',
  };
  const cases = [
    ['API calls are disabled for non-browser applications', '未允许后端请求'],
    ['The Private Key is invalid', '私钥校验失败'],
    ['The Public Key is invalid', '公钥或账号校验失败'],
    ['Template ID not found', '模板校验失败'],
    ['Service ID not found', '服务编号校验失败'],
    ['Origin is not allowed', '来源限制'],
    ['Monthly quota exceeded', '发送额度或频率受限'],
    ['The recipients address is corrupted', '收件人设置无效'],
    ['SMTP authentication failed', '连接发件邮箱失败'],
    ['Unexpected failure', '发信服务拒绝请求'],
  ];
  let detail = '';
  t.mock.method(globalThis, 'fetch', async () => new Response(detail + ' secret-credential recipient@example.com 123456', { status: 403 }));
  for (const [body, expected] of cases) {
    detail = body;
    await assert.rejects(createEmailSender(config).send({ to: 'recipient@example.com', code: '123456' }), error =>
      error.status === 502 && error.message.includes(expected) && error.message.includes('HTTP 403') &&
      !/secret-credential|recipient@example.com|123456/.test(error.message));
  }
});
