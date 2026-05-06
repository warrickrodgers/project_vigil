import 'dotenv/config';
import { DiscordService, formatStatusEmbed } from '@vigil/discord';
import { APICallTracker, GeminiClient, TavilyClient, SearchBudget, ChromaClient, logger, GEMINI_MODELS } from '@vigil/clients';
import { CollectorAgent, AggregatorAgent, makeVigilDB } from '@vigil/agents';
import type { AggregatorEmitter } from '@vigil/agents';
import { prisma } from '@vigil/db';
import type { Region } from '@vigil/shared';

// ---------------------------------------------------------------------------
// AI client layer
// ---------------------------------------------------------------------------

const tracker = new APICallTracker();
const gemini = new GeminiClient(process.env['GEMINI_API_KEY'] ?? '', tracker);
const budget = new SearchBudget();
const tavily = new TavilyClient(process.env['TAVILY_API_KEY'] ?? '', tracker, budget);
const chroma = new ChromaClient();

chroma.isReachable().then((ok) => {
  if (ok) {
    logger.info('ChromaDB connected — semantic corroboration active', { url: process.env['CHROMA_URL'] ?? 'http://localhost:8000' });
  } else {
    logger.warn('ChromaDB not reachable — collection will run without semantic corroboration. Start ChromaDB to enable vector search.');
  }
}).catch(() => undefined);

const budgetStatus = budget.getStatus();
logger.info('Clients initialized', {
  gemini: {
    fastModel: process.env['GEMINI_FAST_MODEL'] ?? GEMINI_MODELS.fast.id,
    capableModel: process.env['GEMINI_CAPABLE_MODEL'] ?? GEMINI_MODELS.capable.id,
  },
  tavily: {
    monthlyUsed: budgetStatus.monthCount,
    monthlyLimit: budgetStatus.monthlyLimit,
    remainingToday: budgetStatus.remaining.daily,
  },
  tracker: 'active',
});

// ---------------------------------------------------------------------------
// Discord service
// ---------------------------------------------------------------------------

const svc = new DiscordService();

const channelIds: Record<Region, string> = {
  local: process.env['DISCORD_LOCAL_CHANNEL_ID'] ?? '',
  usa: process.env['DISCORD_USA_CHANNEL_ID'] ?? '',
  geopolitical: process.env['DISCORD_GEO_CHANNEL_ID'] ?? '',
};

logger.info('Configured channels', {
  general: process.env['DISCORD_GENERAL_CHANNEL_ID'],
  local: channelIds.local,
  usa: channelIds.usa,
  geopolitical: channelIds.geopolitical,
});

// ---------------------------------------------------------------------------
// Collector agent
// ---------------------------------------------------------------------------

const collector = new CollectorAgent(
  gemini,
  tavily,
  {
    channelIds,
    sendEmbed: (embed, channelId) => svc.sendEmbed(embed, channelId),
    sendMessage: (message, channelId) => svc.sendNotification(message, channelId),
    requestApproval: (request, channelId) => svc.requestApproval(request, channelId),
    requestSkipReview: (request, channelId) => svc.requestSkipReview(request, channelId),
  },
  makeVigilDB(prisma),
  chroma,
);

// ---------------------------------------------------------------------------
// Aggregator agent
// ---------------------------------------------------------------------------

const aggregatorEmitter: AggregatorEmitter = {
  generalChannelId: process.env['DISCORD_GENERAL_CHANNEL_ID'] ?? '',
  sendMessage: (message, channelId) => svc.sendNotification(message, channelId),
  sendEmbeds: async (embeds, channelId) => {
    for (const embed of embeds) {
      await svc.sendEmbed(embed, channelId);
    }
  },
};

const aggregator = new AggregatorAgent(
  gemini,
  aggregatorEmitter,
  makeVigilDB(prisma),
);

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

svc.registerCollectHandler(async (region, options) => {
  await collector.collect(region, options);
});

svc.registerScanHandler(async (region, topic) => {
  await collector.scan(region, topic);
});

svc.registerStatusHandler(async (region) => {
  const status = await collector.getStatus(region);
  const embed = formatStatusEmbed([status]);
  await svc.sendEmbed(embed, channelIds[region]);
});

svc.registerDigestHandler(async (options) => {
  await aggregator.digest(undefined, options);
});

svc.registerFlashHandler(async () => {
  await aggregator.flash();
});

svc.registerBriefingHandler(async () => {
  await aggregator.briefing();
});

svc.registerSourcesHandler(async (region) => {
  const sources = await collector.getSources(region);
  const lines = sources.map(
    (s) => `**${s.canonicalName}** — bias: ${s.biasAnchor.toFixed(2)}, reliability: ${s.reliabilityBase.toFixed(2)}`,
  );
  const message =
    lines.length > 0
      ? `**Outlets for ${region}** (${lines.length})\n${lines.join('\n')}`
      : `No outlets found for ${region}.`;
  await svc.sendNotification(message, channelIds[region]);
});

svc.registerScheduleHandler(async () => {
  // Fixed CT schedule — EventBridge fires at these UTC hours (CDT = UTC-5, CST = UTC-6)
  const runs = [
    { label: '🌅 Morning Collection (all sectors)', ctTime: '05:00 CT', utcHourCdt: 11, utcHourCst: 12 },
    { label: '📰 Newsletter Dispatch', ctTime: '06:00 CT', utcHourCdt: 12, utcHourCst: 13 },
    { label: '⚡ Midday Flash', ctTime: '12:00 CT', utcHourCdt: 18, utcHourCst: 19 },
    { label: '🌆 Evening Collection (all sectors)', ctTime: '18:00 CT', utcHourCdt: 0, utcHourCst: 1 },
  ];

  const now = new Date();
  // CDT is UTC-5 (offset = 300 min), CST is UTC-6
  const isDst = now.getTimezoneOffset() === 300;
  const lines = runs.map(({ label, ctTime, utcHourCdt, utcHourCst }) => {
    const utcHour = isDst ? utcHourCdt : utcHourCst;
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const diffMin = Math.round((next.getTime() - now.getTime()) / 60_000);
    const inStr = diffMin < 60 ? `in ${diffMin}m` : `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
    return `**${label}** (${ctTime})\n   Next run: ${inStr}`;
  });

  await svc.sendNotification(
    `**Project Vigil — Collection Schedule**\n\n${lines.join('\n\n')}`,
    process.env['DISCORD_GENERAL_CHANNEL_ID'],
  );
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down...`);
  try {
    await svc.sendNotification('Project Vigil shutting down.');
  } catch {
    // best-effort
  }
  await tracker.flush();
  tracker.stop();
  await svc.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

logger.info('Connecting to Discord...');
svc
  .connect()
  .then(async () => {
    logger.info('Bot ready. All handlers registered.');
    await svc.sendNotification(
      '**Project Vigil online.**\n\n' +
      '**#vigil-general**\n' +
      '`!digest` · `!flash` · `!briefing` · `!schedule` · `!help`\n\n' +
      '**#vigil-local / #vigil-usa / #vigil-geopolitical**\n' +
      '`!collect` · `!scan <topic>` · `!status` · `!sources` · `!review <id>` · `!flag <id>` · `!help`',
    );
  })
  .catch((err: unknown) => {
    logger.error('Failed to connect to Discord', err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  });
