const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { openDatabase, hashPassword, validateCredentials } = require('./database');
async function main() {
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  let db;
  try {
    const username = (await rl.question('管理员用户名（2—32位）：')).trim();
    process.stdout.write('管理员密码（10—128位，输入不显示）：'); hidden = true;
    const password = await rl.question('');
    process.stdout.write('\n再次输入密码：');
    const confirm = await rl.question(''); hidden = false; process.stdout.write('\n');
    if (!validateCredentials(username, password)) throw Error('用户名或密码格式不符合要求');
    if (password !== confirm) throw Error('两次密码不一致');
    db = openDatabase();
    if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) throw Error('此用户名已存在，请使用新管理员用户名，已有账号不会被覆盖');
    db.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'admin')").run(username, await hashPassword(password));
    console.log('管理员创建成功，请在网页中使用此账号登录。');
  } finally { hidden = false; rl.close(); db?.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
