const crypto = require('crypto');

const SALT = process.env.HASH_SALT || 'change-me-in-production';

function hash(value) {
  return crypto.createHash('sha256').update(SALT + String(value)).digest('hex');
}

module.exports = { hash };
