// This runner deliberately ignores DATABASE_URL and all online configuration.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const privateDir = path.join(root, 'private');
const { openDatabase, hashPassword } = require('../backend/database');

async function main() {
  fs.mkdirSync(privateDir, { recursive: true });
  const database = openDatabase(path.join(privateDir, 'local-preview.sqlite'));
  const owner = database.prepare("SELECT id,username FROM users WHERE role='owner'").get();
  if (!owner) {
    const password = randomBytes(9).toString('base64url');
    database.prepare("INSERT INTO users(username,password_hash,role,contact_type,contact_value,verified_at) VALUES (?,?,'owner','email','owner@local.test',?)").run('mowu', await hashPassword(password), new Date().toISOString());
    fs.writeFileSync(path.join(privateDir, '本地测试账号.txt'), '\uFEFF仅限本地测试，与线上账号独立。请勿分享或提交此文件。\r\n用户名：mowu\r\n密码：' + password + '\r\n邮箱：owner@local.test（测试占位，不会发信）\r\n打开登录窗口，按本地提示登录。\r\n', 'utf8');
  } else if (owner.username !== 'mowu') {
    const duplicate = database.prepare('SELECT id FROM users WHERE username=?').get('mowu');
    if (duplicate && duplicate.id !== owner.id) throw Error('本地用户名 mowu 已被其他用户使用，未覆盖任何账号');
    database.prepare('UPDATE users SET username=? WHERE id=?').run('mowu', owner.id);
  }
  // Entry hash is optional and stored only in an ignored file, never in source.
  const configPath = path.join(privateDir, 'local-preview-config.json');
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  const { createApi } = require('../backend/api');
  const app = createApi({ database, localDeviceEnrollment: true, ownerEntryHash: config.ownerEntryHash, origins: 'http://127.0.0.1:5189' });
  const server = app.listen(3015, '127.0.0.1', () => console.log('本地测试后端：http://127.0.0.1:3015/api/health'));
  server.on('error', error => { console.error(error.message); process.exit(1); });
  const vite = path.join(root, 'frontend/node_modules/vite/bin/vite.js');
  const env = { ...process.env, BLOG_BACKEND_URL: 'http://127.0.0.1:3015', VITE_API_URL: '' };
  // Vite's development-only override prevents .env.local from pointing at a live API.
  const front = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5189', '--strictPort', '--mode', 'localpreview'], { cwd: path.join(root, 'frontend'), env, stdio: 'inherit', windowsHide: true });
  front.on('exit', () => server.close(() => { database.close(); process.exit(); }));
  front.on('error', error => { console.error(error.message); server.close(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { front.kill(); server.close(() => { database.close(); process.exit(); }); });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
