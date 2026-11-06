const { validateCredentials } = require('./security');
const { normalizeContact } = require('./verification');
async function provisionOwner(db, { username, password, email, passwords }) {
  if (!validateCredentials(username, password)) throw Error('用户名须为2—32位，密码须为6—14位');
  const contact = normalizeContact('email', email);
  if (!contact) throw Error('请输入有效的站主邮箱');
  await db.ready;
  if (await db.prepare("SELECT id FROM users WHERE role='owner'").get()) throw Error('站主已存在，不会创建第二个站主。请在网页使用邮箱验证码找回密码。');
  const existing = await db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (existing) {
    if (existing.banned || (existing.contact_value && existing.contact_value !== contact) || !await passwords.verifyPassword(password, existing.password_hash)) throw Error('此用户名已存在。认领为站主需使用该账号原密码和预留邮箱，或使用新用户名。');
    await db.prepare("UPDATE users SET role='owner',contact_type='email',contact_value=?,permissions='{}' WHERE id=?").run(contact, existing.id);
    return { pending: !existing.verified_at };
  }
  const hash = await passwords.hashPassword(password);
  if (!await passwords.verifyPassword(password, hash)) throw Error('密码保存前校验未通过，站主尚未创建');
  await db.prepare("INSERT INTO users(username,password_hash,role,contact_type,contact_value) VALUES (?,?,'owner','email',?)").run(username, hash, contact);
  return { pending: true };
}
module.exports = { provisionOwner };
