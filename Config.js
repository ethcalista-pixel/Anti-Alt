const db = require('../db');

function getGuildConfig(guildId) {
  let row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  }
  return row;
}

const ALLOWED_KEYS = ['verified_role_id', 'log_channel_id', 'punishment'];

function setGuildConfig(guildId, key, value) {
  if (!ALLOWED_KEYS.includes(key)) throw new Error('Invalid config key');
  getGuildConfig(guildId); // ensure row exists
  db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}

function isBypass(guildId, userId) {
  return !!db.prepare('SELECT 1 FROM bypass WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function addBypass(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO bypass (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
}

function removeBypass(guildId, userId) {
  db.prepare('DELETE FROM bypass WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

module.exports = { getGuildConfig, setGuildConfig, isBypass, addBypass, removeBypass };
