# Alt Detection Discord Bot

A self-hosted Discord bot that detects alt accounts using browser fingerprinting and IP matching — similar to DoubleCounter, but you own the data.

## How it works

1. User joins your Discord server
2. Bot DMs them a verification link to your website
3. Your website collects their IP address and a browser fingerprint
4. If the data matches an existing verified user in the same server, the new account is flagged as an alt and kicked or banned
5. Otherwise, the user is granted the verified role

## Requirements

- Node.js 18 or newer
- A Discord bot token ([create one here](https://discord.com/developers/applications))
- A domain pointing to your server, ideally with HTTPS (Cloudflare in front works fine)

## Setup

Install dependencies:

```bash
npm install
```

Copy the env template and fill it in:

```bash
cp .env.example .env
```

Edit `.env`:

- `DISCORD_TOKEN` — your bot's token
- `PUBLIC_URL` — the public URL your verification page will be served from (e.g. `https://verify.yourdomain.com`)
- `HASH_SALT` — a long random string used to hash IPs and fingerprints before storage
- `PREFIX` — command prefix (default `!`)
- `WEB_PORT` — port the Express server listens on (default `3000`)

In the Discord Developer Portal, enable these privileged intents on your bot:

- Server Members Intent
- Message Content Intent

Invite the bot with these permissions:

- Manage Roles
- Kick Members
- Ban Members
- Send Messages
- Embed Links

Run it:

```bash
npm start
```

In your Discord server (as someone with `Manage Server` permission):

```
!config role @Verified
!config logs #alt-logs
!config punishment kick
!config show
```

Make sure the bot's role is **above** the Verified role in your role list, otherwise it can't assign it.

## Hosting the verification page

The web server listens on `WEB_PORT` (default 3000). You'll want to put a reverse proxy in front so it's reachable at `PUBLIC_URL` over HTTPS.

Example Caddyfile:

```
verify.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Example nginx:

```nginx
server {
    listen 443 ssl;
    server_name verify.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The bot calls `app.set('trust proxy', true)` so it picks up the real client IP from `X-Forwarded-For`.

## Commands

| Command | Description |
|---|---|
| `!help` | Show command list |
| `!config role @role` | Set the role to assign on verification |
| `!config logs #channel` | Set the log channel |
| `!config punishment <kick\|ban\|none>` | Action to take on detected alts |
| `!config show` | Show current configuration |
| `!bypass add <user_id>` | Whitelist a user from verification |
| `!bypass remove <user_id>` | Remove from whitelist |
| `!reverify <user_id>` | Send a fresh verification link to a user |

## File layout

```
alt-detection-bot/
├── index.js           # Boots bot + server
├── bot.js             # Discord client, commands, join handler
├── server.js          # Express verification endpoints
├── db.js              # SQLite schema & connection
├── lib/
│   ├── crypto.js      # Salted SHA-256 hashing
│   ├── tokens.js      # Verification token issue + consume
│   ├── matcher.js     # Alt detection logic
│   └── config.js      # Per-guild config + bypass list
├── public/
│   └── verify.html    # Verification page
├── package.json
├── .env.example
└── README.md
```

## Privacy

- IPs and fingerprints are stored as **salted SHA-256 hashes** — never as raw values. Set a long random `HASH_SALT` in `.env` and don't change it afterward (existing records would no longer match).
- The verification page tells users their IP and browser fingerprint will be collected. You're responsible for any additional disclosure your jurisdiction requires (GDPR, etc.).
- Verifications are scoped per-guild — fingerprints are not compared across servers you run.

## Caveats

- **VPN users** sharing exit nodes will look like alts to each other. Consider blocking known VPN IPs separately, or just accept some false positives.
- **Shared networks** (family, school, office) will collide. Use the bypass list for known cases, or only match on fingerprint (edit `lib/matcher.js` to remove the `ip_hash = ?` clause).
- **Browser fingerprints** are defeated by spoofing extensions, different browsers, and incognito modes — but the average alt-maker won't bother.
- **Stricter matching**: to require BOTH IP and fingerprint to match before flagging (fewer false positives), change `OR` to `AND` in `lib/matcher.js`.

## Tweaks you might want

- Lower `TOKEN_TTL_MS` in `lib/tokens.js` if 10 minutes feels too long
- Add an account-age check in `bot.js`'s `guildMemberAdd` handler to combine fingerprint matching with the original Anti Alt approach
- Style `public/verify.html` to match your brand
- Add slash commands instead of prefix commands (this codebase uses prefix for simplicity)
