const crypto = require('crypto');
const db = require('../db');

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function createToken(discordId, guildId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  db.prepare(
    'INSERT INTO tokens (token, discord_id, guild_id, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, discordId, guildId, expiresAt);
  return token;
}

function consumeToken(token) {
  const row = db.prepare('SELECT * FROM tokens WHERE token = ? AND used = 0').get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) return null;
  db.prepare('UPDATE tokens SET used = 1 WHERE token = ?').run(token);
  return row;
}

module.exports = { createToken, consumeToken };
