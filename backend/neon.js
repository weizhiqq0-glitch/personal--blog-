const { neon } = require('@neondatabase/serverless');
const { createPostgresDatabase } = require('./postgres');

function openNeon(connectionString, { initialize = false } = {}) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')) {
    throw Error('请使用 Neon 提供的 PostgreSQL 连接串');
  }
  const sql = neon(connectionString, { fullResults: true });
  return createPostgresDatabase({
    query(text, values) { return sql.query(text, values); },
    async end() {}, // HTTP queries do not keep a TCP connection open.
  }, { initialize });
}
module.exports = { openNeon };
