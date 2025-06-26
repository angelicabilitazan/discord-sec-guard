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

        const status = updatedMember.presence?.status || 'offline';
        const activities = updatedMember.presence?.activities || [];
        const hasRealActivity = activities.some(a => a.type !== 4); 

        // console.log(`🟡 ${updatedMember.user.tag} status after 3min: ${status}`);
        // console.log(`🎮 Activities:`, activities.map(a => a.name).join(', ') || 'None');

        if (stillInVoice && (
            status === 'offline' ||
            (!hasRealActivity))) {
          const afkChannel = guild.afkChannel;
          await updatedMember.voice.setChannel(afkChannel || null);

          // console.log(`⏱️ Disconnected ${updatedMember.user.tag} after 3 min (offline or inactive)`);

          try {
            await updatedMember.send(
              `🚫 You were disconnected after 3 minutes due to no visible activity. Please stay active to remain in the voice channel.`
            );
          } catch (err) {
            // console.warn(`❌ Couldn't DM ${updatedMember.user.tag}:`, err.message);
          }
        } else {
          // console.log(`✅ ${updatedMember.user.tag} is good to go — active or acceptable status.`);
        }

        if (stillInVoice && hasRealActivity) {
          const channelMembers = updatedMember.voice.channel?.members;

          if (channelMembers && channelMembers.size > 1) {
            const allGameActivities = [];

            channelMembers.forEach(m => {
              const games = m.presence?.activities?.filter(a => a.type === 0).map(a => a.name);
              if (games && games.length > 0) {
                allGameActivities.push({ id: m.id, game: games[0] });
              }
            });

            const userGame = allGameActivities.find(entry => entry.id === updatedMember.id)?.game;
            const otherGames = allGameActivities
              .filter(entry => entry.id !== updatedMember.id)
              .map(entry => entry.game);

            const everyoneElseHasSameGame = otherGames.length > 0 && otherGames.every(g => g === otherGames[0]);
            const isOutlier = userGame && everyoneElseHasSameGame && userGame !== otherGames[0];

            if (isOutlier) {
              const afkChannel = guild.afkChannel;
              await updatedMember.voice.setChannel(afkChannel || null);

              // console.log(`🎮 Game mismatch! Disconnected ${updatedMember.user.tag} for playing a different game: ${userGame}`);

              try {
                await updatedMember.send(
                  `🚫 You were disconnected because you're playing **${userGame}**, which doesn't match the current group vibe (**${otherGames[0]}**). Please join again when you’re synced up!`
                );
              } catch (err) {
                // console.warn(`❌ Couldn't DM ${updatedMember.user.tag}:`, err.message);
              }
              return;
            }
          }
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
