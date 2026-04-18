const db = require('../db');
const { hash } = require('./crypto');

function recordAndMatch(discordId, guildId, ip, fingerprint, userAgent) {
  const ipHash = hash(ip);
  const fpHash = hash(fingerprint);

  // Find any other Discord accounts in this guild that share IP or fingerprint
  const matches = db.prepare(`
    SELECT DISTINCT discord_id
    FROM verifications
    WHERE guild_id = ?
      AND discord_id != ?
      AND (ip_hash = ? OR fingerprint_hash = ?)
  `).all(guildId, discordId, ipHash, fpHash);

  // Always record this verification, even on a match — useful for the alt graph
  db.prepare(`
    INSERT INTO verifications (discord_id, guild_id, ip_hash, fingerprint_hash, user_agent, verified_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(discordId, guildId, ipHash, fpHash, userAgent, Date.now());

  return matches.map(m => m.discord_id);
}

module.exports = { recordAndMatch };
