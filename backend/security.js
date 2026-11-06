const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = await derive(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
function validateCredentials(username, password) {
  return typeof username === 'string' && /^[\p{L}\p{N}_-]{2,32}$/u.test(username)
    && typeof password === 'string' && password.length >= 6 && password.length <= 14;
}
module.exports = { hashPassword, verifyPassword, tokenHash, validateCredentials };
