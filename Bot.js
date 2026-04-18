const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  ActivityType,
} = require('discord.js');
const { createToken } = require('./lib/tokens');
const {
  getGuildConfig,
  setGuildConfig,
  isBypass,
  addBypass,
  removeBypass,
} = require('./lib/config');

const PREFIX = process.env.PREFIX || '!';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`[BOT] Logged in as ${client.user.tag}`);
  client.user.setActivity(`for alts | ${PREFIX}help`, { type: ActivityType.Watching });
});

// ---------- New member join ----------
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  if (isBypass(member.guild.id, member.id)) return;

  const config = getGuildConfig(member.guild.id);
  if (!config.verified_role_id) {
    console.log(`[BOT] Guild ${member.guild.id} has no verified role set, skipping verification`);
    return;
  }

  const token = createToken(member.id, member.guild.id);
  const url = `${PUBLIC_URL}/verify?token=${token}`;

  const embed = new EmbedBuilder()
    .setTitle(`Welcome to ${member.guild.name}`)
    .setDescription(
      `To gain access, please verify by clicking the link below.\n\n` +
      `[**Verify here**](${url})\n\n` +
      `This link expires in 10 minutes.`
    )
    .setColor(0x5865f2);

  try {
    await member.send({ embeds: [embed] });
  } catch {
    // DMs closed - fall back to system channel
    const channel = member.guild.systemChannel;
    if (channel && channel.permissionsFor(member.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
      channel
        .send(`${member}, please verify here: <${url}>\n*(link expires in 10 minutes)*`)
        .catch(() => {});
    } else {
      console.log(`[BOT] Could not deliver verification link to ${member.user.tag}`);
    }
  }
});

// ---------- Commands ----------
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
  const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageGuild);

  try {
    switch (cmd) {
      case 'help':
        return cmdHelp(message);
      case 'config':
        if (!isAdmin) return message.reply('You need the `Manage Server` permission.');
        return cmdConfig(message, args);
      case 'bypass':
        if (!isAdmin) return message.reply('You need the `Manage Server` permission.');
        return cmdBypass(message, args);
      case 'reverify':
        if (!isAdmin) return message.reply('You need the `Manage Server` permission.');
        return cmdReverify(message, args);
    }
  } catch (err) {
    console.error('[CMD ERROR]', err);
    message.reply('Something went wrong running that command.').catch(() => {});
  }
});

function cmdHelp(message) {
  const embed = new EmbedBuilder()
    .setTitle('Alt Detection Bot — Commands')
    .setColor(0x5865f2)
    .addFields(
      { name: `${PREFIX}config role @role`, value: 'Set the role to assign on successful verification.' },
      { name: `${PREFIX}config logs #channel`, value: 'Set the channel where alt detections are logged.' },
      { name: `${PREFIX}config punishment <kick|ban|none>`, value: 'Action to take when an alt is detected.' },
      { name: `${PREFIX}config show`, value: 'Show current configuration.' },
      { name: `${PREFIX}bypass add|remove <user_id>`, value: 'Whitelist a user from verification.' },
      { name: `${PREFIX}reverify <user_id>`, value: 'Send a fresh verification link to a user.' },
    );
  return message.channel.send({ embeds: [embed] });
}

function cmdConfig(message, args) {
  const sub = args[0]?.toLowerCase();
  const config = getGuildConfig(message.guild.id);

  if (sub === 'role') {
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!role) return message.reply('Mention a role or provide a role ID.');
    setGuildConfig(message.guild.id, 'verified_role_id', role.id);
    return message.reply(`Verified role set to **${role.name}**.`);
  }

  if (sub === 'logs') {
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
    if (!channel) return message.reply('Mention a channel or provide a channel ID.');
    setGuildConfig(message.guild.id, 'log_channel_id', channel.id);
    return message.reply(`Log channel set to ${channel}.`);
  }

  if (sub === 'punishment') {
    const p = args[1]?.toLowerCase();
    if (!['kick', 'ban', 'none'].includes(p)) {
      return message.reply('Punishment must be `kick`, `ban`, or `none`.');
    }
    setGuildConfig(message.guild.id, 'punishment', p);
    return message.reply(`Punishment set to **${p}**.`);
  }

  if (sub === 'show') {
    const role = config.verified_role_id ? `<@&${config.verified_role_id}>` : '*Not set*';
    const logs = config.log_channel_id ? `<#${config.log_channel_id}>` : '*Not set*';
    const embed = new EmbedBuilder()
      .setTitle('Current configuration')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Verified role', value: role, inline: true },
        { name: 'Log channel', value: logs, inline: true },
        { name: 'Punishment', value: config.punishment || 'kick', inline: true },
      );
    return message.channel.send({ embeds: [embed] });
  }

  return message.reply('Subcommands: `role`, `logs`, `punishment`, `show`');
}

function cmdBypass(message, args) {
  const action = args[0]?.toLowerCase();
  const userId = args[1];
  if (!['add', 'remove'].includes(action) || !userId) {
    return message.reply(`Usage: \`${PREFIX}bypass <add|remove> <user_id>\``);
  }
  if (action === 'add') {
    addBypass(message.guild.id, userId);
    return message.reply(`Added <@${userId}> to the bypass list.`);
  }
  removeBypass(message.guild.id, userId);
  return message.reply(`Removed <@${userId}> from the bypass list.`);
}

async function cmdReverify(message, args) {
  const userId = args[0];
  if (!userId) return message.reply(`Usage: \`${PREFIX}reverify <user_id>\``);

  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return message.reply('That user is not in this server.');

  const token = createToken(userId, message.guild.id);
  const url = `${PUBLIC_URL}/verify?token=${token}`;
  try {
    await member.send(`Please re-verify in **${message.guild.name}**: ${url}\n*(link expires in 10 minutes)*`);
    return message.reply(`Sent re-verification link to **${member.user.tag}**.`);
  } catch {
    return message.reply(`Could not DM that user. Direct link: <${url}>`);
  }
}

// ---------- Called by the web server when a verification completes ----------
async function handleVerificationResult({ discordId, guildId, alts, action, reason }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: 'Guild not found' };

  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return { ok: false, error: 'Member not found' };

  const config = getGuildConfig(guildId);

  if (action === 'verify') {
    if (config.verified_role_id) {
      await member.roles.add(config.verified_role_id, 'Verification passed').catch((e) => {
        console.error('[BOT] Failed to add verified role:', e.message);
      });
    }
  } else if (action === 'punish') {
    const punishment = config.punishment || 'kick';
    if (punishment === 'kick') {
      await member.kick(reason).catch((e) => console.error('[BOT] Kick failed:', e.message));
    } else if (punishment === 'ban') {
      await member.ban({ reason }).catch((e) => console.error('[BOT] Ban failed:', e.message));
    }
  }

  // Log
  if (config.log_channel_id) {
    const channel = guild.channels.cache.get(config.log_channel_id);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(action === 'verify' ? 'User verified' : 'Alt account detected')
        .setColor(action === 'verify' ? 0x57f287 : 0xed4245)
        .addFields(
          { name: 'User', value: `${member.user.tag} (\`${member.id}\`)` },
          { name: 'Reason', value: reason || 'N/A' },
        )
        .setTimestamp();
      if (alts && alts.length) {
        embed.addFields({
          name: 'Linked accounts',
          value: alts.map((id) => `<@${id}> (\`${id}\`)`).join('\n'),
        });
      }
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return { ok: true };
}

function start(token) {
  return client.login(token);
}

module.exports = { client, start, handleVerificationResult };
