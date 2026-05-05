import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { logger } from '@vigil/clients';
import type { GeminiClient } from '@vigil/clients';
import { formatNewsletterDigest } from '@vigil/discord';
import type { CommandOptions } from '@vigil/discord';
import type { Region } from '@vigil/shared';
import type { VigilDB } from '../collector/types.js';
import { detectCorroborations } from './corroborator.js';
import { rankArticles, computeNewsletterStats } from './ranker.js';
import { renderHtmlEmail, renderPlainText } from './template.js';
import type {
  ArticleRow,
  AggregatorEmitter,
  DigestSection,
  Newsletter,
} from './types.js';

// ---------------------------------------------------------------------------
// Gemini output schemas
// ---------------------------------------------------------------------------

const SectionSummarySchema = z.object({
  interpretiveSummary: z.string().max(800),
});

const CrossSectorSchema = z.object({
  crossSectorAnalysis: z.string().max(1200),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, string> = {
  local: '📍 LOCAL INTEL — Kansas City Metro',
  usa: '🇺🇸 USA INTEL — National',
  geopolitical: '🌐 GEOPOLITICAL INTEL — Global',
};

const REGIONS: Region[] = ['local', 'usa', 'geopolitical'];

const DEFAULT_LOOKBACK_HOURS = 24;
const FLASH_LOOKBACK_HOURS = 6;
const FLASH_MIN_TRUST = 0.6;
const FLASH_MAX_ITEMS = 5;

// ---------------------------------------------------------------------------
// AggregatorAgent
// ---------------------------------------------------------------------------

export class AggregatorAgent {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly emitter: AggregatorEmitter,
    private readonly db: VigilDB,
  ) {}

  // ---------------------------------------------------------------------------
  // Public handlers
  // ---------------------------------------------------------------------------

  async digest(lookbackHours = DEFAULT_LOOKBACK_HOURS, _options: CommandOptions = {}): Promise<Newsletter> {
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - lookbackHours * 60 * 60 * 1000);

    logger.info('Starting digest generation', { lookbackHours, cutoff: cutoff.toISOString() });
    await this.emitter.sendMessage('📰 Generating intelligence digest...', this.emitter.generalChannelId);

    const rawArticles = await this.fetchArticles(cutoff);

    if (rawArticles.length === 0) {
      await this.emitter.sendMessage(
        `⚠️ No articles collected in the last ${lookbackHours} hours. Run \`!collect\` in each sector channel first.`,
        this.emitter.generalChannelId,
      );
      const empty = this.buildEmptyNewsletter(lookbackHours);
      return empty;
    }

    // Corroborate across the full article set
    const { articles, pairs } = detectCorroborations(rawArticles);
    if (pairs.length > 0) {
      await this.persistCorroborations(pairs);
      logger.info('Corroborations persisted', { count: pairs.length });
    }

    const stats = computeNewsletterStats(articles);

    // Build one section per region — rank, then editorialize
    const sections: DigestSection[] = await Promise.all(
      REGIONS.map(async (region) => {
        const regionArticles = articles.filter((a) => a.region === region);
        const ranked = rankArticles(regionArticles, nowMs);
        const top = ranked.slice(0, 4);
        const interpretiveSummary = top.length > 0
          ? await this.generateSectionSummary(region, top.map((a) => ({
              title: a.title,
              outletName: a.outletName,
              summary: a.summary,
            })))
          : '';
        return {
          region,
          label: SECTION_LABELS[region] ?? region.toUpperCase(),
          articles: ranked,
          interpretiveSummary,
        };
      }),
    );

    const crossSectorAnalysis = await this.generateCrossSectorAnalysis(sections);

    const newsletter: Newsletter = {
      sections,
      crossSectorAnalysis,
      stats,
      generatedAt: new Date(),
      lookbackHours,
    };

    // Dry-run SES dispatch — renders HTML/plain-text to data/newsletters/
    await this.logEmailDryRun(newsletter);

    // Post Discord newsletter embeds
    await this.postToDiscord(newsletter);

    logger.info('Digest complete', {
      totalArticles: stats.totalArticles,
      corroborationRate: stats.corroborationRate,
    });

    return newsletter;
  }

  async flash(): Promise<void> {
    const cutoff = new Date(Date.now() - FLASH_LOOKBACK_HOURS * 60 * 60 * 1000);
    const articles = await this.fetchArticles(cutoff);

    const highTrust = articles
      .filter((a) => a.trustRating >= FLASH_MIN_TRUST)
      .sort((a, b) => b.trustRating - a.trustRating)
      .slice(0, FLASH_MAX_ITEMS);

    if (highTrust.length === 0) {
      await this.emitter.sendMessage(
        `⚡ No high-trust flash items in the last ${FLASH_LOOKBACK_HOURS} hours.`,
        this.emitter.generalChannelId,
      );
      return;
    }

    const ranked = rankArticles(highTrust, Date.now());
    const lines = ranked
      .map(
        (a, i) =>
          `${i + 1}. **${a.title}**\n   ${a.outletName} · Trust: ${(a.trustRating * 100).toFixed(0)}%${a.isCorroborated ? ' · ✓ Corroborated' : ''}\n   ${a.url}`,
      )
      .join('\n\n');

    await this.emitter.sendMessage(
      `⚡ **FLASH INTEL — Last ${FLASH_LOOKBACK_HOURS} Hours**\n\n${lines}`,
      this.emitter.generalChannelId,
    );
  }

  async briefing(): Promise<void> {
    const cutoff = new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000);

    const regionStats = await Promise.all(
      REGIONS.map(async (region) => {
        const articles = (await this.db.article.findMany({
          where: {
            region,
            collectedAt: { gte: cutoff },
          },
          orderBy: { collectedAt: 'desc' },
        })) as ArticleRow[];

        const last = articles[0];
        const lastTime = last
          ? new Date(last.collectedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Chicago',
              timeZoneName: 'short',
            })
          : null;

        const avgTrust = articles.length > 0
          ? (articles.reduce((s, a) => s + a.trustRating, 0) / articles.length * 100).toFixed(0)
          : 'N/A';

        const label = SECTION_LABELS[region] ?? region.toUpperCase();
        return `**${label}**\n  ${articles.length} article(s) · Avg trust: ${avgTrust}%${lastTime ? ` · Last collected: ${lastTime}` : ''}`;
      }),
    );

    const msg = [
      '📋 **OPERATIONAL BRIEFING — Last 24 Hours**',
      '',
      ...regionStats,
    ].join('\n');

    await this.emitter.sendMessage(msg, this.emitter.generalChannelId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchArticles(cutoff: Date, region?: Region): Promise<ArticleRow[]> {
    const rows = await this.db.article.findMany({
      where: {
        ...(region ? { region } : {}),
        collectedAt: { gte: cutoff },
      },
      include: { outlet: true },
      orderBy: { collectedAt: 'desc' },
    });

    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'] as string,
      title: r['title'] as string,
      summary: r['summary'] as string,
      url: r['url'] as string,
      biasScore: r['biasScore'] as number,
      trustRating: r['trustRating'] as number,
      region: r['region'] as Region,
      sectorTags: r['sectorTags'] as string,
      collectedAt: r['collectedAt'] as Date,
      publishedAt: r['publishedAt'] as Date,
      corroboratedById: r['corroboratedById'] as string | null,
      vettingFlag: (r['vettingFlag'] as string | null | undefined) ?? null,
      outletName: ((r['outlet'] as Record<string, unknown> | null)?.['canonicalName'] as string | undefined) ?? 'Unknown',
      outletReliabilityBase: ((r['outlet'] as Record<string, unknown> | null)?.['reliabilityBase'] as number | undefined) ?? 0.5,
    }));
  }

  private async persistCorroborations(
    pairs: Array<{ primaryId: string; secondaryId: string; similarity: number }>,
  ): Promise<void> {
    await Promise.all(
      pairs.map(({ secondaryId, primaryId }) =>
        this.db.article.update({
          where: { id: secondaryId },
          data: { corroboratedById: primaryId },
        }),
      ),
    );
  }

  private localSectorGuidance(): string {
    return `\n\nThis is the LOCAL sector for Kansas City metro. Your assessment MUST be the most actionable of all sections — KC residents read this to know how these developments affect their daily lives:
- Name specific neighborhoods, suburbs, or corridors (Overland Park, Westport, Crossroads, 435 corridor, Northland, Lee's Summit, etc.) when relevant
- If a policy or budget change: who pays more, who benefits, and when does it take effect?
- If infrastructure or transit news: which routes or areas are impacted and for how long?
- If economic news: which local employers, industries, or job seekers should pay attention?
- Write as if you're briefing a KC resident who asks: "What does this actually mean for me this week?"`;
  }

  private async generateSectionSummary(
    region: Region,
    articles: Array<{ title: string; outletName: string; summary: string }>,
  ): Promise<string> {
    const articleList = articles
      .map((a, i) => `${i + 1}. "${a.title}" (${a.outletName})\n   ${a.summary}`)
      .join('\n\n');

    const regionLabel = SECTION_LABELS[region] ?? region;
    const regionGuidance = region === 'local' ? this.localSectorGuidance() : '';

    try {
      const result = await this.gemini.completeJSON(
        `You are a senior OSINT analyst writing the interpretive summary for the ${regionLabel} section of a daily intelligence brief.

Based on these ${articles.length} article(s), write a concise 3-4 sentence analyst assessment:
- What is the key development or pattern across these stories?
- What does this mean for stakeholders in this region?
- What should readers watch for in the coming days?${regionGuidance}

Keep the tone factual, intelligence-brief style. No filler phrases like "In summary" or "It is worth noting."

Articles:
${articleList}

Return JSON: { "interpretiveSummary": "<3-4 sentence analysis>" }`,
        {
          tier: 'capable',
          schema: SectionSummarySchema,
          label: `section-summary-${region}`,
        },
      );
      return result.interpretiveSummary;
    } catch (err) {
      logger.error(
        'Failed to generate section summary',
        err instanceof Error ? err : new Error(String(err)),
        { region },
      );
      return '';
    }
  }

  private async generateCrossSectorAnalysis(sections: DigestSection[]): Promise<string> {
    const sectionSummaries = sections
      .map((s) => {
        const label = SECTION_LABELS[s.region] ?? s.region.toUpperCase();
        const articles = s.articles
          .slice(0, 3)
          .map((a) => `  - ${a.title} (${a.outletName}${a.isCorroborated ? ', corroborated' : ''})\n    ${a.summary}`)
          .join('\n');
        return `${label}:\n${articles || '  (no articles)'}${s.interpretiveSummary ? `\n  Analyst assessment: ${s.interpretiveSummary}` : ''}`;
      })
      .join('\n\n');

    try {
      const result = await this.gemini.completeJSON(
        `You are a senior OSINT analyst synthesizing intelligence across three sectors for a daily brief.

Write a 4-5 sentence cross-sector analysis that:
- Identifies the single most important theme or pattern connecting Local, National, and Geopolitical developments today
- Explicitly traces any downstream effects: how do geopolitical or national events ripple into local KC metro conditions?
- Names the top risk emerging from the combined picture (be specific — who is exposed and to what)
- Names the top opportunity or development that deserves a closer watch
- Closes with what to monitor most closely in the next 24-48 hours

Tone: intelligence-brief style. Factual, direct, specific. No hedging filler. Treat readers as capable adults who want the unvarnished picture.

Today's intelligence across sectors:
${sectionSummaries}

Return JSON: { "crossSectorAnalysis": "<4-5 sentence synthesis>" }`,
        {
          tier: 'capable',
          schema: CrossSectorSchema,
          label: 'cross-sector-analysis',
        },
      );
      return result.crossSectorAnalysis;
    } catch (err) {
      logger.error(
        'Failed to generate cross-sector analysis',
        err instanceof Error ? err : new Error(String(err)),
      );
      return '';
    }
  }

  private async logEmailDryRun(newsletter: Newsletter): Promise<void> {
    const html = renderHtmlEmail(newsletter);
    const plain = renderPlainText(newsletter);
    const subject = `Project Vigil — Daily Intelligence Brief ${newsletter.generatedAt.toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}`;

    // Write rendered output to data/newsletters/ for local inspection
    try {
      const ts = newsletter.generatedAt
        .toISOString()
        .replace(/:/g, '-')
        .slice(0, 16); // YYYY-MM-DDTHH-MM
      const dataRoot = process.env['AWS_LAMBDA_FUNCTION_NAME'] ? '/tmp' : process.cwd();
      const dir = join(dataRoot, 'data', 'newsletters');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${ts}.html`), html, 'utf8');
      await writeFile(join(dir, `${ts}.txt`), plain, 'utf8');
      logger.info('SES dry-run — email written to disk (not sent)', {
        path: `data/newsletters/${ts}.html`,
        htmlBytes: html.length,
        plainBytes: plain.length,
        subject,
      });
    } catch (err) {
      logger.warn('SES dry-run — could not write newsletter to disk', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async postToDiscord(newsletter: Newsletter): Promise<void> {
    const digestSections = {
      local: newsletter.sections
        .find((s) => s.region === 'local')
        ?.articles.slice(0, 4)
        .map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          outlet: a.outletName,
          biasScore: a.biasScore,
          trustRating: a.trustRating,
          region: a.region,
          url: a.url,
          collectedAt: a.collectedAt,
        })) ?? [],
      usa: newsletter.sections
        .find((s) => s.region === 'usa')
        ?.articles.slice(0, 4)
        .map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          outlet: a.outletName,
          biasScore: a.biasScore,
          trustRating: a.trustRating,
          region: a.region,
          url: a.url,
          collectedAt: a.collectedAt,
        })) ?? [],
      geopolitical: newsletter.sections
        .find((s) => s.region === 'geopolitical')
        ?.articles.slice(0, 4)
        .map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          outlet: a.outletName,
          biasScore: a.biasScore,
          trustRating: a.trustRating,
          region: a.region,
          url: a.url,
          collectedAt: a.collectedAt,
        })) ?? [],
    };

    const embeds = formatNewsletterDigest(digestSections);
    await this.emitter.sendEmbeds(embeds, this.emitter.generalChannelId);
  }

  private buildEmptyNewsletter(lookbackHours: number): Newsletter {
    return {
      sections: REGIONS.map((region) => ({
        region,
        label: SECTION_LABELS[region] ?? region.toUpperCase(),
        articles: [],
        interpretiveSummary: '',
      })),
      crossSectorAnalysis: '',
      stats: {
        totalArticles: 0,
        corroborationRate: 0,
        avgTrustRating: 0,
        avgBiasScore: 0,
        sectorCounts: { local: 0, usa: 0, geopolitical: 0 },
      },
      generatedAt: new Date(),
      lookbackHours,
    };
  }
}
