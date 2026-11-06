import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../src/request.js';
test('read retries once after network failure', async () => {
  let calls = 0;
  const expected = new Response('{}');
  const actual = await request('https://example.test/api/auth/options', {}, async () => { if (++calls === 1) throw new TypeError('network'); return expected; });
  assert.equal(actual, expected); assert.equal(calls, 2);
});
test('registration and mail requests are never replayed automatically', async () => {
  let calls = 0;
  await assert.rejects(request('https://example.test/api/auth/register', { method: 'POST' }, async () => { calls++; throw new TypeError('network'); }), error => error.code === 'NETWORK_ERROR');
  assert.equal(calls, 1);
});
test('application errors are not retried', async () => {
  let calls = 0;
  const response = await request('https://example.test/api/auth/options', {}, async () => { calls++; return new Response('{}', { status: 429 }); });
  assert.equal(calls, 1); assert.equal(response.status, 429);
});