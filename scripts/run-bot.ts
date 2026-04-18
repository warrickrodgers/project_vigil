import 'dotenv/config';
import { DiscordService } from '@vigil/discord';

const svc = new DiscordService();

// Log configured channel IDs for verification
const env = process.env;
console.log('Configured channels:');
console.log('  General:      ', env['DISCORD_GENERAL_CHANNEL_ID']);
console.log('  Local:        ', env['DISCORD_LOCAL_CHANNEL_ID']);
console.log('  USA:          ', env['DISCORD_USA_CHANNEL_ID']);
console.log('  Geopolitical: ', env['DISCORD_GEO_CHANNEL_ID']);

async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal} — shutting down...`);
  try {
    await svc.sendNotification('🔴 Project Vigil shutting down.');
  } catch {
    // best-effort
  }
  await svc.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('Connecting to Discord...');
svc.connect()
  .then(async () => {
    console.log('Bot ready.');
    await svc.sendNotification('🟢 Project Vigil online. Agents initializing...');
  })
  .catch((err: unknown) => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
