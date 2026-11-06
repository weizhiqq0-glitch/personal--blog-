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
