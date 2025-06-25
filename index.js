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

// CONFIG
const TEXT_CHANNEL_ID = '943823554175176784'; // replace with your channel ID
const GRACE_PERIOD_MS = 1 * 60 * 1000; // 3 minutes in milliseconds

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    const guild = member.guild;
    const voiceChannel = newState.channel;

    console.log(`👂 ${member.user.tag} joined voice: ${voiceChannel.name}`);

    const textChannel = guild.channels.cache.get(TEXT_CHANNEL_ID);
    const userStatus = member.presence?.status || 'offline';

    // If user joins while offline, send an immediate warning
    if (userStatus !== 'online') {
      if (textChannel && textChannel.isTextBased()) {
        try {
            await member.send(`⚠️ You are currently **offline**. Please go online and start an activity to remain in the voice channel. You have 3 minutes.`);
        } catch (err) {
            console.warn(`❌ Couldn't DM ${member.user.tag}:`, err.message);
        }
      }
    }

    // Begin 3-minute grace timer
    setTimeout(async () => {
      try {
        const updatedMember = await guild.members.fetch(member.id);
        const updatedStatus = updatedMember.presence?.status || 'offline';
        const updatedActivity = updatedMember.presence?.activities?.[0]?.name || null;

        const stillInVoice = updatedMember.voice.channelId === newState.channelId;

        // If still in the same voice channel AND still no activity
        if (stillInVoice && (!updatedActivity || updatedActivity === 'Custom Status')) {
          const afkChannel = guild.afkChannel;
          await updatedMember.voice.setChannel(afkChannel || null);

          console.log(`⛔ Disconnected ${updatedMember.user.tag} after 3 min of no activity.`);

          if (textChannel && textChannel.isTextBased()) {
            await textChannel.send(
              `🚫 ${updatedMember.user} was disconnected after 3 minutes due to no visible activity. Please start an activity next time!`
            );
          }
        } else {
          console.log(`✅ ${updatedMember.user.tag} is fine. Activity detected: ${updatedActivity}`);
        }
      } catch (err) {
        console.error(`❌ Error during grace period check: ${err}`);
      }
    }, GRACE_PERIOD_MS);
  }
});

client.login(process.env.BOT_TOKEN);
