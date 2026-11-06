const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { createMailBudget } = require('./mail-budget');

// Local administrative CLI, never exposed through a public HTTP route.
async function main() {
  let hidden = false, db;
  const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk); done(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  try {
    if (process.argv.includes('--remote')) {
      console.log('仅在自己的电脑上操作。请先暂停发信，并查看 EmailJS 当前实际余额。');
      process.stdout.write('Neon 数据库连接串（隐藏输入）：'); hidden = true;
      const connection = (await rl.question('')).trim(); hidden = false; console.log();
      db = require('./neon').openNeon(connection);
    } else db = require('./database').openDatabase();
    const remaining = Number(await rl.question('EmailJS 当前剩余封数（0—200）：'));
    const resetAt = (await rl.question('下次重置时间（例 2026-12-06T00:00:00+08:00，须包含时区）：')).trim();
    if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(resetAt)) throw Error('请填写带时区的完整时间。');
    const result = await createMailBudget(db).calibrate(remaining, resetAt);
    console.log('已校准：剩余约' + result.remaining + '封。站主验证邮箱后，也能在网页管理页校准。');
  } finally { hidden = false; rl.close(); await db?.close(); }
}
if (require.main === module) main().catch(() => { console.error('校准未完成，请检查输入、数据库连接或权限。连接串不会输出到日志。'); process.exitCode = 1; });
