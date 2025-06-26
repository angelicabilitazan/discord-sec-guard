const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

const GRACE_PERIOD_MS = 5 * 60 * 1000;

client.once('ready', () => {
  // console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    const guild = member.guild;
    const voiceChannel = newState.channel;

    console.log(`👂 ${member.user.tag} joined voice: ${voiceChannel.name}`);

    const userStatus = member.presence?.status || 'offline';

    if (userStatus !== 'online') {
      try {
        const afkChannel = guild.afkChannel;
        await member.voice.setChannel(afkChannel || null); 

        // console.log(`⛔ Disconnected ${member.user.tag} immediately for being offline`);

        await member.send(
          `🚫 You were disconnected because you're currently **offline**. Please go online and start an activity before joining a voice channel.`
        );
      } catch (err) {
        // console.warn(`❌ Couldn't disconnect or DM ${member.user.tag}:`, err.message);
      }
      return;
    }

    setTimeout(async () => {
      try {
        const updatedMember = await guild.members.fetch(member.id);
        const stillInVoice = updatedMember.voice.channelId === newState.channelId;

        const status = updatedMember.presence?.status;
        const activities = updatedMember.presence?.activities || [];
        const hasActivity = activities.some(a => a.type !== 4); 

        if (
          stillInVoice &&
          (status === 'offline' || (status !== 'online' && !hasActivity))
        ) {
          const afkChannel = guild.afkChannel;
          await updatedMember.voice.setChannel(afkChannel || null);

          // console.log(`⏱️ Disconnected ${updatedMember.user.tag} after 3 min (offline or idle without activity)`);

          try {
            await updatedMember.send(
              `🚫 You were disconnected after 3 minutes due to no visible activity or offline status. Please stay active to remain in the voice channel.`
            );
          } catch (err) {
            // console.warn(`❌ Couldn't DM ${updatedMember.user.tag}:`, err.message);
          }
        } else {
          // console.log(`✅ ${updatedMember.user.tag} is active or idle with valid activity. All good!`);
        }
      } catch (err) {
        // console.error(`❌ Error during grace period check: ${err}`);
      }
    }, GRACE_PERIOD_MS);
  }
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  const member = newPresence.member;
  const status = newPresence.status;

  if (!member || status !== 'offline') return;

  const voiceChannel = member.voice?.channel;
  if (!voiceChannel) return;

  try {
    await member.voice.setChannel(null);
    // console.log(`⛔ Disconnected ${member.user.tag} for going offline in voice`);

    try {
      await member.send(
        `🚫 You were disconnected because you went **offline** while in a voice channel. Please stay online to remain connected.`
      );
    } catch (err) {
      // console.warn(`❌ Couldn't DM ${member.user.tag}:`, err.message);
    }
  } catch (err) {
    // console.error(`❌ Failed to disconnect ${member.user.tag}:`, err.message);
  }
});

client.login(process.env.BOT_TOKEN);
