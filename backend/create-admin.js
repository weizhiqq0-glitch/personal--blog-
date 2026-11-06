const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { openDatabase } = require('./database');
const security = require('./security');
const { normalizeContact } = require('./verification');
const { provisionOwner } = require('./owner');
async function main() {
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  let db;
  const remote = process.argv.includes('--remote');
  try {
    if (remote) {
      process.stdout.write('粘贴 Neon 数据库连接串（输入不显示，按回车确认）：');
      hidden = true;
      const connection = (await rl.question('')).trim();
      hidden = false; process.stdout.write('\n');
      if (!/^postgres(?:ql)?:\/\//.test(connection)) throw Error('需要 postgresql:// 开头的连接串，不要包含 psql 命令和外层引号');
      process.env.DATABASE_URL = connection;
    }
    let username;
    do { username = (await rl.question('站主用户名（2—32位）：')).trim(); if (!security.validateCredentials(username, 'check123')) console.log('用户名格式不正确，请重新输入。'); } while (!security.validateCredentials(username, 'check123'));
    let email;
    do { email = normalizeContact('email', await rl.question('站主邮箱（上线后需收验证码激活）：')); if (!email) console.log('邮箱格式不正确，请重新输入。'); } while (!email);
    let password;
    while (true) {
      process.stdout.write('站主密码（6—14位，输入不显示）：'); hidden = true;
      password = await rl.question(''); process.stdout.write('\n再次输入密码：');
      const confirm = await rl.question(''); hidden = false; process.stdout.write('\n');
      if (!security.validateCredentials(username, password)) { console.log('密码长度必须是6—14位，请重新输入密码。'); continue; }
      if (password !== confirm) { console.log('两次密码不一致，请重新输入密码。'); continue; }
      break;
    }
    db = remote ? require('./neon').openNeon(process.env.DATABASE_URL, { initialize: true }) : openDatabase();
    await db.ready;
    if (remote) await db.prepare('CREATE EXTENSION IF NOT EXISTS pgcrypto').run();
    const passwords = remote ? require('./online-security').createOnlinePasswords(db, { legacyVerify: security.verifyPassword }) : security;
    const result = await provisionOwner(db, { username, password, email, passwords });
    console.log(result.pending ? '站主已预创建。配置发信服务并上线后，登录网页验证预留邮箱，站主权限才会激活。' : '已认领为站主，请在网页登录。');
  } finally { hidden = false; rl.close(); await db?.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
