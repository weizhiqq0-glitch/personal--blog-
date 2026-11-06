const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createApp } = require('./app');
const app = createApp();
const port = process.env.PORT || 3000;
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log('博客后端已启动：http://127.0.0.1:' + port));
server.on('error', error => { console.error('后端启动失败：' + error.message); process.exit(1); });
function shutdown() { server.close(() => { app.locals.db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
