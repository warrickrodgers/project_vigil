import { z } from 'zod';

const discordEnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_GENERAL_CHANNEL_ID: z.string().min(1),
  DISCORD_LOCAL_CHANNEL_ID: z.string().min(1),
  DISCORD_USA_CHANNEL_ID: z.string().min(1),
  DISCORD_GEO_CHANNEL_ID: z.string().min(1),
  DISCORD_ADMIN_USER_ID: z.string().min(1),
});

function loadConfig() {
  const result = discordEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.errors.map((e) => e.path.join('.')).join(', ');
    throw new Error(`Discord config validation failed. Missing/invalid: ${missing}`);
  }
  const env = result.data;
  return {
    discord: {
      botToken: env.DISCORD_BOT_TOKEN,
      clientId: env.DISCORD_CLIENT_ID,
      guildId: env.DISCORD_GUILD_ID,
      generalChannelId: env.DISCORD_GENERAL_CHANNEL_ID,
      localChannelId: env.DISCORD_LOCAL_CHANNEL_ID,
      usaChannelId: env.DISCORD_USA_CHANNEL_ID,
      geoChannelId: env.DISCORD_GEO_CHANNEL_ID,
      adminUserId: env.DISCORD_ADMIN_USER_ID,
    },
  };
}

export type DiscordConfig = ReturnType<typeof loadConfig>;

export { loadConfig };
