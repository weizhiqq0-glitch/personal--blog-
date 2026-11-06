const { createApi } = require('./api');
const { openDatabase } = require('./database');

function createApp(options = {}) {
  const database = options.database || (options.dbPath === undefined ? openDatabase() : openDatabase(options.dbPath));
  // A regular Node server can also read online bcrypt hashes after migration.
  if (!options.database && options.dbPath === undefined && process.env.DATABASE_URL) {
    const { createOnlinePasswords } = require('./online-security');
    const { verifyPassword } = require('./security');
    const initialized = database.ready;
    database.ready = Promise.resolve(initialized).then(() => database.prepare('CREATE EXTENSION IF NOT EXISTS pgcrypto').run());
    return createApi({ ...options, database, passwords: createOnlinePasswords(database, { legacyVerify: verifyPassword }) });
  }
  return createApi({ ...options, database });
}
module.exports = { createApp };
