const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    fingerprint_hash TEXT NOT NULL,
    user_agent TEXT,
    verified_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ver_ip ON verifications(ip_hash);
  CREATE INDEX IF NOT EXISTS idx_ver_fp ON verifications(fingerprint_hash);
  CREATE INDEX IF NOT EXISTS idx_ver_guild ON verifications(guild_id);

  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    verified_role_id TEXT,
    log_channel_id TEXT,
    punishment TEXT DEFAULT 'kick'
  );

  CREATE TABLE IF NOT EXISTS bypass (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
`);

// Periodically clean up expired tokens (every hour)
setInterval(() => {
  db.prepare('DELETE FROM tokens WHERE expires_at < ?').run(Date.now());
}, 60 * 60 * 1000);

module.exports = db;
