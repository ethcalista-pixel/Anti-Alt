require('dotenv').config();

const bot = require('./bot');
const server = require('./server');

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = parseInt(process.env.WEB_PORT || '3000', 10);

if (!TOKEN || TOKEN === 'your_bot_token_here') {
  console.error('[ERROR] DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!process.env.PUBLIC_URL || process.env.PUBLIC_URL === 'https://yourdomain.com') {
  console.warn('[WARN] PUBLIC_URL is not set to your real domain. Verification links will not work.');
}

bot.start(TOKEN).catch((err) => {
  console.error('[ERROR] Bot login failed:', err.message);
  process.exit(1);
});

server.start(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Goodbye.');
  process.exit(0);
});
