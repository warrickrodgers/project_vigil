import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock discord.js before importing service
vi.mock('discord.js', async () => {
  const { EmbedBuilder } = await vi.importActual<typeof import('discord.js')>('discord.js');
  return {
    EmbedBuilder,
    ActionRowBuilder: vi.fn().mockImplementation(() => ({
      addComponents: vi.fn().mockReturnThis(),
    })),
    ButtonBuilder: vi.fn().mockImplementation(() => ({
      setCustomId: vi.fn().mockReturnThis(),
      setLabel: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis(),
    })),
    ButtonStyle: { Success: 1, Danger: 4, Secondary: 2 },
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 512,
      MessageContent: 32768,
      GuildMessageReactions: 64,
    },
    TextChannel: class TextChannel {},
    Client: vi.fn().mockImplementation(() => ({
      login: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      isReady: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      channels: { fetch: vi.fn() },
    })),
  };
});

const ENV_VARS = {
  DISCORD_BOT_TOKEN: 'tok',
  DISCORD_CLIENT_ID: 'cid',
  DISCORD_GUILD_ID: 'gid',
  DISCORD_GENERAL_CHANNEL_ID: 'ch-gen',
  DISCORD_LOCAL_CHANNEL_ID: 'ch-local',
  DISCORD_USA_CHANNEL_ID: 'ch-usa',
  DISCORD_GEO_CHANNEL_ID: 'ch-geo',
  DISCORD_ADMIN_USER_ID: 'admin',
};

beforeEach(() => {
  Object.assign(process.env, ENV_VARS);
});

describe('DiscordService handler registration', () => {
  it('registers collectHandler and can receive calls', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.registerCollectHandler(handler);
    // Access private field via cast to verify registration
    expect((svc as unknown as { collectHandler: unknown }).collectHandler).toBe(handler);
  });

  it('registers scanHandler', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.registerScanHandler(handler);
    expect((svc as unknown as { scanHandler: unknown }).scanHandler).toBe(handler);
  });

  it('registers digestHandler', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.registerDigestHandler(handler);
    expect((svc as unknown as { digestHandler: unknown }).digestHandler).toBe(handler);
  });

  it('registers flagHandler', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.registerFlagHandler(handler);
    expect((svc as unknown as { flagHandler: unknown }).flagHandler).toBe(handler);
  });

  it('starts with all handlers null', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    const s = svc as unknown as Record<string, unknown>;
    expect(s['collectHandler']).toBeNull();
    expect(s['scanHandler']).toBeNull();
    expect(s['statusHandler']).toBeNull();
    expect(s['sourcesHandler']).toBeNull();
    expect(s['digestHandler']).toBeNull();
    expect(s['flashHandler']).toBeNull();
    expect(s['briefingHandler']).toBeNull();
    expect(s['reviewHandler']).toBeNull();
    expect(s['flagHandler']).toBeNull();
  });

  it('isConnected() returns false before connect()', async () => {
    const { DiscordService } = await import('../service.js');
    const svc = new DiscordService();
    expect(svc.isConnected()).toBe(false);
  });
});
