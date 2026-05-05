import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../config.js';

const REQUIRED_VARS = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'DISCORD_GENERAL_CHANNEL_ID',
  'DISCORD_LOCAL_CHANNEL_ID',
  'DISCORD_USA_CHANNEL_ID',
  'DISCORD_GEO_CHANNEL_ID',
  'DISCORD_ADMIN_USER_ID',
] as const;

const FULL_ENV: Record<string, string> = {
  DISCORD_BOT_TOKEN: 'token-abc',
  DISCORD_CLIENT_ID: 'client-123',
  DISCORD_GUILD_ID: 'guild-456',
  DISCORD_GENERAL_CHANNEL_ID: 'ch-general',
  DISCORD_LOCAL_CHANNEL_ID: 'ch-local',
  DISCORD_USA_CHANNEL_ID: 'ch-usa',
  DISCORD_GEO_CHANNEL_ID: 'ch-geo',
  DISCORD_ADMIN_USER_ID: 'admin-789',
};

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of REQUIRED_VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of REQUIRED_VARS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('loadConfig', () => {
  it('returns typed config when all env vars are present', () => {
    Object.assign(process.env, FULL_ENV);
    const cfg = loadConfig();
    expect(cfg.discord.botToken).toBe('token-abc');
    expect(cfg.discord.generalChannelId).toBe('ch-general');
    expect(cfg.discord.localChannelId).toBe('ch-local');
    expect(cfg.discord.usaChannelId).toBe('ch-usa');
    expect(cfg.discord.geoChannelId).toBe('ch-geo');
    expect(cfg.discord.adminUserId).toBe('admin-789');
  });

  it.each(REQUIRED_VARS)('throws when %s is missing', (missing) => {
    const partial = { ...FULL_ENV };
    delete partial[missing];
    Object.assign(process.env, partial);
    expect(() => loadConfig()).toThrow('Discord config validation failed');
  });

  it('throws when a required var is an empty string', () => {
    Object.assign(process.env, { ...FULL_ENV, DISCORD_BOT_TOKEN: '' });
    expect(() => loadConfig()).toThrow('Discord config validation failed');
  });
});
