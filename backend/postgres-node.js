const { createPostgresDatabase } = require('./postgres');
function openPostgres(connectionString) {
  const { Pool } = require('pg');
  const url = new URL(connectionString);
  // Neon requires TLS. Verify certificates instead of disabling verification.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const sslMode = url.searchParams.get('sslmode');
  if (!local && sslMode === 'disable') throw Error('公网数据库必须使用 TLS 连接');
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.delete('sslrootcert');
  const pool = new Pool({ connectionString: url.toString(), max: 4,
    connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000,
    ssl: local && (!sslMode || sslMode === 'disable') ? false : { rejectUnauthorized: true },
  });
  pool.on('error', () => console.error('数据库连接中断，后续请求将尝试重新连接。'));
  return createPostgresDatabase(pool);
}

module.exports = { openPostgres };
