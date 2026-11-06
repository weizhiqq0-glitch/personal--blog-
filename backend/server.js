const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createApp } = require('./app');
async function main() {
  if (process.env.REQUIRE_POSTGRES === 'true' && !process.env.DATABASE_URL) throw Error('缺少 DATABASE_URL，停止启动以避免使用临时数据库');
  const app = createApp();
  await app.locals.db.ready;
  const port = process.env.PORT || 3000;
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log('博客后端已启动，端口：' + port));
  server.on('error', () => { console.error('后端监听失败，请检查端口配置'); process.exit(1); });
  function shutdown() {
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => { await app.locals.db.close(); process.exit(0); });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(() => { console.error('后端启动失败，请检查数据库连接、网络和环境变量配置（连接密码不会输出）。'); process.exit(1); });
