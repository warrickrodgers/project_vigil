import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '@vigil/clients';
import type { GeminiClient } from '@vigil/clients';
import { formatNewsletterDigest } from '@vigil/discord';
import type { CommandOptions } from '@vigil/discord';
import type { Region } from '@vigil/shared';
import {
  buildAnalystSystemPrompt,
  StructuredAssessmentSchema,
  deriveConfidence,
  sleep,
} from '@vigil/shared';
import type { StructuredAssessment, ConfidenceLevel } from '@vigil/shared';
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
/** Sections where all articles are older than this are rendered as NOMINAL. */
const NOMINAL_STALENESS_HOURS = 18;

// ---------------------------------------------------------------------------
// AggregatorAgent
// ---------------------------------------------------------------------------

export class AggregatorAgent {
  private readonly interSectionDelayMs: number;

  constructor(
    private readonly gemini: GeminiClient,
    private readonly emitter: AggregatorEmitter,
    private readonly db: VigilDB,
    options: { interSectionDelayMs?: number } = {},
  ) {
    this.interSectionDelayMs = options.interSectionDelayMs ?? INTER_SECTION_DELAY_MS;
  }

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

    const baseStats = computeNewsletterStats(articles);

    // Build one section per region — rank, staleness check, then editorialize.
    // Sections are built sequentially (not in parallel) to avoid 503s on the capable
    // tier: geopolitical runs third and was consistently hitting rate limits when all
    // three generateStructuredAssessment calls fired at once.
    const INTER_SECTION_DELAY_MS = 15_000;
    const sections: DigestSection[] = [];
    for (let i = 0; i < REGIONS.length; i++) {
      const region = REGIONS[i]!;

      if (i > 0 && this.interSectionDelayMs > 0) await sleep(this.interSectionDelayMs);

      const regionArticles = articles.filter((a) => a.region === region);
      const ranked = rankArticles(regionArticles, nowMs);
      const top = ranked.slice(0, 4);

      // NOMINAL detection: fewer than 2 fresh articles → silence is more credible than repetition
      const nominalCutoffMs = NOMINAL_STALENESS_HOURS * 60 * 60 * 1000;
      const freshCount = top.filter(
        (a) => nowMs - new Date(a.collectedAt).getTime() <= nominalCutoffMs,
      ).length;
      const isNominal = top.length === 0 || freshCount < 2;

      const lastCollectionAt =
        top.length > 0 ? new Date(top[0]!.collectedAt) : undefined;

      let interpretiveSummary = '';
      let structuredAssessment: StructuredAssessment | undefined;

      if (!isNominal && top.length > 0) {
        structuredAssessment = await this.generateStructuredAssessment(
          region,
          top,
        ).catch((err) => {
          logger.error('Structured assessment failed — falling back to plain summary', err instanceof Error ? err : new Error(String(err)), { region });
          return undefined;
        });
        // Fallback plain summary if structured call fails
        if (!structuredAssessment) {
          interpretiveSummary = await this.generateSectionSummaryFallback(
            region,
            top.map((a) => ({ title: a.title, outletName: a.outletName, summary: a.summary })),
          );
        }
      }

      sections.push({
        region,
        label: SECTION_LABELS[region] ?? region.toUpperCase(),
        articles: ranked,
        interpretiveSummary,
        isNominal,
        ...(structuredAssessment !== undefined ? { structuredAssessment } : {}),
        ...(lastCollectionAt !== undefined ? { lastCollectionAt } : {}),
      });
    }

    const crossSectorAnalysis = await this.generateCrossSectorAnalysis(sections);

    // Compute confidence distribution across non-NOMINAL sections
    const confidenceDistribution = this.computeConfidenceDistribution(sections);
    const stats = { ...baseStats, confidenceDistribution };

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
    return `\nThis is the LOCAL sector for Kansas City metro. Implications MUST name specific neighborhoods, corridors, or employer groups (Overland Park, Crossroads, 435 corridor, Northland, Lee's Summit). Write as if briefing a KC resident: "What does this mean for me this week?"`;
  }

  private async generateStructuredAssessment(
    region: Region,
    articles: import('./types.js').RankedArticle[],
  ): Promise<StructuredAssessment> {
    const articleList = articles
      .map((a, i) =>
        `${i + 1}. "${a.title}" (${a.outletName}, trust: ${(a.trustRating * 100).toFixed(0)}%${a.isCorroborated ? ', corroborated' : ''})\n   ${a.summary}`,
      )
      .join('\n\n');

    const regionLabel = SECTION_LABELS[region] ?? region;
    const localGuidance = region === 'local' ? this.localSectorGuidance() : '';
    const systemPrompt = buildAnalystSystemPrompt();

    const result = await this.gemini.completeJSON(
      `${systemPrompt}

---

You are writing the analyst assessment for the ${regionLabel} section of a classified daily intelligence brief.${localGuidance}

Based on these ${articles.length} article(s), produce a structured assessment following the OUTPUT STRUCTURE above exactly.

Articles:
${articleList}

Return a single JSON object with keys: situation, assessment, confidence, confidenceReasoning, implications, watchList`,
      {
        tier: 'capable',
        schema: StructuredAssessmentSchema,
        label: `structured-assessment-${region}`,
      },
    );

    return result as StructuredAssessment;
  }

  private async generateSectionSummaryFallback(
    region: Region,
    articles: Array<{ title: string; outletName: string; summary: string }>,
  ): Promise<string> {
    const articleList = articles
      .map((a, i) => `${i + 1}. "${a.title}" (${a.outletName})\n   ${a.summary}`)
      .join('\n\n');
    const regionLabel = SECTION_LABELS[region] ?? region;

    try {
      const { z } = await import('zod');
      const FallbackSchema = z.object({ interpretiveSummary: z.string().max(800) });
      const result = await this.gemini.completeJSON(
        `You are a senior OSINT analyst. Write a 3-4 sentence factual summary for the ${regionLabel} section. Extract key facts, patterns, and what readers should watch.

Articles:
${articleList}

Return JSON: { "interpretiveSummary": "..." }`,
        { tier: 'capable', schema: FallbackSchema, label: `section-summary-fallback-${region}` },
      );
      return (result as { interpretiveSummary: string }).interpretiveSummary;
    } catch (err) {
      logger.error('Section summary fallback failed', err instanceof Error ? err : new Error(String(err)), { region });
      return '';
    }
  }

  private async generateCrossSectorAnalysis(sections: DigestSection[]): Promise<string> {
    const systemPrompt = buildAnalystSystemPrompt();

    const sectionSummaries = sections
      .map((s) => {
        const label = SECTION_LABELS[s.region] ?? s.region.toUpperCase();
        if (s.isNominal) return `${label}:\n  NOMINAL — no new developments. Monitoring continues.`;
        const articleLines = s.articles
          .slice(0, 3)
          .map(
            (a) =>
              `  - ${a.title} (${a.outletName}${a.isCorroborated ? ', corroborated' : ''})\n    ${a.summary}`,
          )
          .join('\n');
        const assessment = s.structuredAssessment
          ? `\n  Situation: ${s.structuredAssessment.situation}\n  Assessment: ${s.structuredAssessment.assessment}`
          : s.interpretiveSummary
          ? `\n  Assessment: ${s.interpretiveSummary}`
          : '';
        return `${label}:\n${articleLines || '  (no articles)'}${assessment}`;
      })
      .join('\n\n');

    const nominalSectors = sections.filter((s) => s.isNominal).map((s) => s.region);
    const nominalNote =
      nominalSectors.length > 0
        ? `\n\nNOTE: The following sectors are NOMINAL (no new developments in last 18h): ${nominalSectors.join(', ')}. If relevant, note whether that silence is itself significant.`
        : '';

    try {
      const { z } = await import('zod');
      const CrossSectorSchema = z.object({ crossSectorAnalysis: z.string().max(1500) });
      const result = await this.gemini.completeJSON(
        `${systemPrompt}

---

Synthesize intelligence across all sectors for today's brief.${nominalNote}

Write 4-5 sentences that:
- Identify the single most important theme or pattern connecting developments across active sectors
- Explicitly trace downstream effects (geopolitical → national → KC local where applicable)
- Name the top risk with specific exposure (who, to what, by when)
- Name the top development deserving closer watch
- Close with the single most important indicator to monitor in the next 24-48 hours

Today's sector intelligence:
${sectionSummaries}

Return JSON: { "crossSectorAnalysis": "<4-5 sentence synthesis>" }`,
        { tier: 'capable', schema: CrossSectorSchema, label: 'cross-sector-analysis' },
      );
      return (result as { crossSectorAnalysis: string }).crossSectorAnalysis;
    } catch (err) {
      logger.error(
        'Failed to generate cross-sector analysis',
        err instanceof Error ? err : new Error(String(err)),
      );
      return '';
    }
  }

  private computeConfidenceDistribution(
    sections: DigestSection[],
  ): { high: number; moderate: number; low: number; nominal: number } {
    const dist = { high: 0, moderate: 0, low: 0, nominal: 0 };

    for (const section of sections) {
      if (section.isNominal) {
        dist.nominal++;
        continue;
      }
      if (section.structuredAssessment) {
        const level = section.structuredAssessment.confidence as ConfidenceLevel;
        if (level === 'HIGH') dist.high++;
        else if (level === 'MODERATE') dist.moderate++;
        else dist.low++;
      } else {
        // No structured assessment — derive from section's article aggregate
        const top = section.articles.slice(0, 4);
        if (top.length === 0) continue;
        const avgTrust = top.reduce((s, a) => s + a.trustRating, 0) / top.length;
        const anyCorroborated = top.some((a) => a.isCorroborated);
        const level = deriveConfidence(avgTrust, anyCorroborated, true);
        if (level === 'HIGH') dist.high++;
        else if (level === 'MODERATE') dist.moderate++;
        else dist.low++;
      }
    }

    return dist;
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
        isNominal: true,
      })),
      crossSectorAnalysis: '',
      stats: {
        totalArticles: 0,
        corroborationRate: 0,
        avgTrustRating: 0,
        avgBiasScore: 0,
        sectorCounts: { local: 0, usa: 0, geopolitical: 0 },
        confidenceDistribution: { high: 0, moderate: 0, low: 0, nominal: 3 },
      },
      generatedAt: new Date(),
      lookbackHours,
    };
  }
}
