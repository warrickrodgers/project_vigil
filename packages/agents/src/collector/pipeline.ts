import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  computeArticleHash,
  resolveOutlet,
  serializeSectorTags,
  buildVettingSystemPrompt,
} from '@vigil/shared';
import type { Region, SectorTag } from '@vigil/shared';
import { formatIntelEmbed } from '@vigil/discord';
import type { ArticleForEmbed, RegionStatus } from '@vigil/discord';
import type { GeminiClient, TavilyClient, TavilySearchResult, ChromaClient } from '@vigil/clients';
import { logger } from '@vigil/clients';
import { REGION_CONFIGS } from './config.js';
import { computeVettingResult, FLAG_LABELS } from './vetting.js';
import type {
  CollectionOptions,
  CollectionResult,
  CollectorEmitter,
  OutletRecord,
  SavedArticle,
  VigilDB,
} from './types.js';

// ---------------------------------------------------------------------------
// Primary source detection
// ---------------------------------------------------------------------------

const PRIMARY_SOURCE_TLD = ['.gov', '.mil', '.int'];
const PRIMARY_SOURCE_DOMAINS = new Set([
  'un.org', 'main.un.org', 'news.un.org',
  'nato.int', 'icrc.org',
  'worldbank.org', 'imf.org',
  'federalreserve.gov', 'newyorkfed.org', 'clevelandfed.org', 'chicagofed.org',
  'stlouisfed.org', 'bostonfed.org', 'dallasfed.org', 'kansascityfed.org',
  'minneapolisfed.org', 'richmondfed.org', 'atlantafed.org', 'sanfranciscofed.org',
  'philadelphiafed.org',
  'europa.eu', 'oecd.org',
  'securitycouncilreport.org',
]);

function isPrimarySource(domain: string): boolean {
  if (PRIMARY_SOURCE_DOMAINS.has(domain)) return true;
  return PRIMARY_SOURCE_TLD.some((tld) => domain.endsWith(tld));
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const QueryGenerationSchema = z.object({
  queries: z.array(z.string()).min(1).max(5),
});

const SectorTagEnum = z.enum([
  'policy', 'economy', 'conflict', 'tech', 'health', 'environment', 'legal',
]);

/**
 * Unified vetting schema — single Gemini call per article.
 * Outlet reliability assessment removed (Phase 2b): provisional outlets use
 * a fixed 0.5 reliability; known outlets use their seeded reliabilityBase.
 */
const UnifiedVettingSchema = z.object({
  summary: z.string().max(600),
  actionableIntel: z.string().max(400),
  biasScore: z.number().min(-1).max(1),
  sectorTags: z.array(SectorTagEnum).min(1).max(4),
  outletName: z.string().max(100),
  estimatedPublishDate: z.string(),
});

type UnifiedVettingResult = z.infer<typeof UnifiedVettingSchema>;

// ---------------------------------------------------------------------------
// CollectorAgent
// ---------------------------------------------------------------------------

export class CollectorAgent {
  constructor(
    private readonly gemini: GeminiClient,
    private readonly tavily: TavilyClient,
    private readonly emitter: CollectorEmitter,
    private readonly db: VigilDB,
    private readonly chroma?: ChromaClient,
  ) {}

  // ---------------------------------------------------------------------------
  // Public handler methods
  // ---------------------------------------------------------------------------

  async collect(region: Region, options: CollectionOptions = {}): Promise<CollectionResult> {
    const startTime = Date.now();
    const config = REGION_CONFIGS[region];
    const result: CollectionResult = {
      region, articlesFound: 0, articlesSaved: 0, articlesSkipped: 0, durationMs: 0, errors: [],
    };
    const channelId = this.emitter.channelIds[region];

    try {
      logger.info('Starting collection', { region, review: options.review ?? false });
      await this.emitter.sendMessage(
        `🔍 Starting collection for **${config.displayName}**${options.review ? ' *(review mode)*' : ''}...`,
        channelId,
      );

      const outlets = await this.loadOutlets(region);
      if (outlets.length === 0) {
        await this.emitter.sendMessage(
          `⚠️ No outlets found for ${config.displayName}. Run \`npm run db:seed\` first.`,
          channelId,
        );
        result.durationMs = Date.now() - startTime;
        return result;
      }

      const queries = await this.generateQueries(region);
      logger.info('Generated queries', { region, queries });

      const searchResults = await this.executeSearches(queries, region, 3, 'basic', config.maxAgeDays);
      result.articlesFound = searchResults.length;

      // Build recent-URL set once — avoids N+1 DB queries inside the loop
      const recentArticles = await this.db.article.findMany({
        where: { collectedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
        select: { url: true },
      }) as Array<{ url: string }>;
      const recentUrlSet = new Set(recentArticles.map((a) => a.url));

      for (const sr of searchResults) {
        try {
          const saved = await this.processResult(sr, region, outlets, channelId, options, recentUrlSet);
          if (saved) result.articlesSaved++;
          else result.articlesSkipped++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(msg);
          logger.error('Failed to process result', err instanceof Error ? err : new Error(msg), { url: sr.url });
        }
      }

      await this.emitter.sendMessage(
        `✅ **${config.displayName}** collection complete — ${result.articlesSaved} saved, ${result.articlesSkipped} skipped${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`,
        channelId,
      );
      logger.info('Collection complete', { ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      logger.error('Collection pipeline failed', err instanceof Error ? err : new Error(msg), { region });
      await this.emitter.sendMessage(`❌ Collection failed for ${config.displayName}: ${msg}`, channelId);
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  async scan(region: Region, topic: string): Promise<CollectionResult> {
    const startTime = Date.now();
    const config = REGION_CONFIGS[region];
    const result: CollectionResult = {
      region, articlesFound: 0, articlesSaved: 0, articlesSkipped: 0, durationMs: 0, errors: [],
    };
    const channelId = this.emitter.channelIds[region];

    try {
      logger.info('Starting scan', { region, topic });
      await this.emitter.sendMessage(
        `🔎 Deep scanning: **"${topic}"** in ${config.displayName}...`, channelId,
      );

      const outlets = await this.loadOutlets(region);
      const queries = await this.generateScanQueries(region, topic);
      const searchResults = await this.executeSearches(queries, region, 5, 'advanced', 7);
      result.articlesFound = searchResults.length;

      const recentArticles = await this.db.article.findMany({
        where: { collectedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
        select: { url: true },
      }) as Array<{ url: string }>;
      const recentUrlSet = new Set(recentArticles.map((a) => a.url));

      for (const sr of searchResults) {
        try {
          const saved = await this.processResult(sr, region, outlets, channelId, {}, recentUrlSet);
          if (saved) result.articlesSaved++;
          else result.articlesSkipped++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(msg);
          logger.error('Failed to process scan result', err instanceof Error ? err : new Error(msg), { url: sr.url });
        }
      }

      await this.emitter.sendMessage(
        `✅ Scan for **"${topic}"** complete — ${result.articlesSaved} saved, ${result.articlesSkipped} skipped`,
        channelId,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      logger.error('Scan failed', err instanceof Error ? err : new Error(msg), { region, topic });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  async getStatus(region: Region): Promise<RegionStatus> {
    const outlets = await this.loadOutlets(region);
    const lastArticle = await this.db.article.findFirst({
      where: { region }, orderBy: { collectedAt: 'desc' },
    }) as SavedArticle | null;
    const count = await this.db.article.count({ where: { region } }) as number;

    return {
      region,
      lastCollectionTime: lastArticle?.collectedAt ?? null,
      articlesCollected: count,
      nextScheduledRun: null,
      outletCount: outlets.length,
    };
  }

  async getSources(region: Region): Promise<OutletRecord[]> {
    return this.loadOutlets(region, { orderByName: true });
  }

  // ---------------------------------------------------------------------------
  // Private pipeline steps
  // ---------------------------------------------------------------------------

  private async loadOutlets(region: Region, options?: { orderByName?: boolean }): Promise<OutletRecord[]> {
    const rows = await this.db.outlet.findMany({
      where: { OR: [{ region }, { region: null }] },
      ...(options?.orderByName ? { orderBy: { canonicalName: 'asc' } } : {}),
    });
    return rows as unknown as OutletRecord[];
  }

  private async generateQueries(region: Region): Promise<string[]> {
    const config = REGION_CONFIGS[region];
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const result = await this.gemini.completeJSON(
      `You are an OSINT analyst. Generate exactly 3 Tavily search queries to surface NEW developments from the last 24-48 hours only.

Today is ${today}. Generate queries that will surface news published TODAY or YESTERDAY only.
Do NOT generate queries about ongoing situations unless there is a specific new development today or yesterday.

Region: ${config.displayName}
Context: ${config.contextPrompt}
Key topics: ${config.baseTopics.join(', ')}

Requirements:
- Each query targets RECENT, BREAKING developments — not background on ongoing situations
- Queries must be diverse — different angles, not repetitive
- Include a date hint (e.g. "May 2026" or "this week") in at least one query
- Phrase them as a news researcher searching for TODAY's news

Return JSON: { "queries": ["query1", "query2", "query3"] }`,
      { tier: 'fast', schema: QueryGenerationSchema, label: `generate-queries-${region}` },
    );
    return result.queries;
  }

  private async generateScanQueries(region: Region, topic: string): Promise<string[]> {
    const config = REGION_CONFIGS[region];
    const result = await this.gemini.completeJSON(
      `Generate 3 specific Tavily search queries for a deep-dive OSINT scan.

Topic: "${topic}"
Region: ${config.displayName}
Context: ${config.contextPrompt}

Return JSON: { "queries": ["query1", "query2", "query3"] }`,
      { tier: 'fast', schema: QueryGenerationSchema, label: `generate-scan-queries-${region}` },
    );
    return result.queries;
  }

  private async executeSearches(
    queries: string[],
    region: Region,
    maxResults: number,
    searchDepth: 'basic' | 'advanced' = 'basic',
    days = 10,
  ): Promise<TavilySearchResult[]> {
    const results: TavilySearchResult[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const hits = await this.tavily.search(query, { searchDepth, maxResults, days, label: `collect-${region}` });
        for (const hit of hits) {
          if (!seen.has(hit.url)) {
            seen.add(hit.url);
            results.push(hit);
          }
        }
      } catch (err) {
        logger.warn('Search failed for query, continuing', {
          query,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Single consolidated Gemini call — returns summary, bias, and sector info.
   * Outlet reliability assessment is done in TypeScript using the outlets table
   * (known outlets) or a fixed provisional value of 0.5 (unknown outlets).
   */
  private async callUnifiedVetting(
    sr: TavilySearchResult,
    region: Region,
  ): Promise<UnifiedVettingResult | null> {
    const config = REGION_CONFIGS[region];
    const systemPrompt = buildVettingSystemPrompt();
    try {
      return await this.gemini.completeJSON(
        `${systemPrompt}

---

Analyze this news article for an intelligence brief.

Title: ${sr.title}
URL: ${sr.url}
Content: ${sr.content.slice(0, 2000)}

Context: ${config.contextPrompt}

CRITICAL INSTRUCTIONS FOR SUMMARY FIELD:
- Do NOT describe what the website, publication, or outlet is about
- Do NOT say "This article covers...", "This website reports...", or "The [outlet] discusses..."
- DO extract the specific facts, events, decisions, numbers, and developments from the article content
- DO write as if briefing a senior decision-maker who needs facts, not a description of a publication
- BAD: "The Kansas City Star reports on local government activities"
- GOOD: "Mayor Lucas allocated $200M to BRT corridor expansion on Troost Ave, with Q3 2026 groundbreak and 2028 service target"
- Your summary must contain specific facts. Generic descriptions will be rejected.

Extract the following fields:
- summary: 2-3 sentences of SPECIFIC facts (named actors, numbers, dates, locations). Max 500 chars.
  If the content is an outlet homepage, "About Us" page, category listing, subscription prompt, or
  any page that is NOT a specific news article, return exactly: "NO EXTRACTABLE INTELLIGENCE"
  Also return "NO EXTRACTABLE INTELLIGENCE" if no concrete facts (actors, numbers, dates) can be extracted.
- actionableIntel: 1-2 sentences. Name WHO is affected, WHAT to do or watch, and any TIMELINE. Max 350 chars.
  BAD: "The city council approved a budget."
  GOOD: "OP homeowners face a new millage rate starting Q3; 435 corridor commuters should plan for road work delays through summer."
- biasScore: float -1.0 (hard left) to 1.0 (hard right) based on framing and word choice
- sectorTags: 1-3 tags from exactly: policy, economy, conflict, tech, health, environment, legal
- outletName: the publishing outlet's canonical name (e.g. "Reuters", "Kansas City Star")
- estimatedPublishDate: ISO date YYYY-MM-DD, use today if unknown

Return JSON with all 6 fields.`,
        { tier: 'fast', schema: UnifiedVettingSchema, label: 'unified-vetting' },
      );
    } catch (err) {
      logger.error(
        'Unified vetting call failed',
        err instanceof Error ? err : new Error(String(err)),
        { url: sr.url },
      );
      return null;
    }
  }

  private async processResult(
    sr: TavilySearchResult,
    region: Region,
    outlets: OutletRecord[],
    channelId: string,
    options: CollectionOptions,
    recentUrlSet: Set<string>,
  ): Promise<boolean> {
    // Cross-run URL dedup — O(1) set lookup, set built once before the processing loop
    if (recentUrlSet.has(sr.url)) {
      logger.info('Article skipped — DEDUP: seen in last 48h', { url: sr.url });
      return false;
    }

    // Hash dedup within current batch and across all time
    const rawBody = sr.rawContent ?? sr.content;
    const hash = computeArticleHash(sr.title, rawBody);
    const existing = await this.db.article.findFirst({
      where: { OR: [{ hash }, { url: sr.url }] },
    });
    if (existing) {
      logger.debug('Duplicate article — skipping', { url: sr.url });
      return false;
    }

    // Hard freshness gate using Tavily metadata — saves Gemini tokens on stale results
    const FRESHNESS_GATE_DAYS = 7;
    if (sr.publishedDate) {
      const tavilyDate = new Date(sr.publishedDate);
      if (!isNaN(tavilyDate.getTime())) {
        const ageDays = (Date.now() - tavilyDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > FRESHNESS_GATE_DAYS) {
          logger.info('Article rejected at freshness gate', {
            url: sr.url,
            reason: `STALE: published ${Math.floor(ageDays)} days ago`,
            publishedDate: sr.publishedDate,
          });
          return false;
        }
      }
    }

    // Single consolidated Gemini call
    const geminiResult = await this.callUnifiedVetting(sr, region);
    if (!geminiResult) return false;

    // Reject outlet homepages, about pages, and category listings — Tavily sometimes
    // returns these when it can't cleanly scrape an article body.
    if (geminiResult.summary === 'NO EXTRACTABLE INTELLIGENCE') {
      logger.info('Article skipped — no extractable intelligence (likely non-article page)', { url: sr.url });
      return false;
    }

    // Resolve outlet — AI name first, then domain fallback
    const domain = this.extractDomain(sr.url);
    let outlet =
      resolveOutlet(geminiResult.outletName, outlets) ??
      resolveOutlet(domain, outlets);

    // Auto-provision unknown outlets at 0.5 provisional reliability
    if (!outlet) {
      const reliabilityBase = isPrimarySource(domain) ? 0.72 : 0.5;
      outlet = await this.findOrCreateProvisionalOutlet(
        geminiResult.outletName,
        domain,
        reliabilityBase,
        channelId,
      );
      outlets.push(outlet);
    }

    // Vector corroboration — embed title+summary, query ChromaDB for semantically similar
    // articles from OTHER outlets. Sets isCorroborated before computeVettingResult so the
    // trust score and flag are accurate.
    let isCorroborated = false;
    let corroboratedById: string | null = null;
    let embedding: number[] | null = null;

    if (this.chroma) {
      try {
        embedding = await this.gemini.embed(`${sr.title} ${geminiResult.summary}`);
        const similar = await this.chroma.querySimilar(embedding, outlet.id);
        if (similar.length > 0) {
          isCorroborated = true;
          corroboratedById = similar[0]?.articleId ?? null;
          logger.info('Semantic corroboration found', {
            url: sr.url,
            matchedArticleId: corroboratedById,
            score: similar[0]?.score.toFixed(3),
          });
        }
      } catch (err) {
        logger.warn('ChromaDB embed/query failed — marking uncorroborated', {
          url: sr.url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Compute vetting result (pure TypeScript — no LLM)
    const vetting = computeVettingResult({
      geminiResult,
      outlet,
      outletBiasAnchor: outlet.biasAnchor,
      isCorroborated,
    });

    // --review mode: flagged articles go through operator approval
    if (options.review && !vetting.autoApprove && vetting.flag) {
      const approval = await this.emitter.requestApproval(
        {
          id: randomUUID(),
          type: 'bias_review',
          article: {
            id: 'pending',
            title: sr.title,
            summary: vetting.summary,
            outlet: outlet.canonicalName,
            biasScore: vetting.biasScore,
            trustRating: vetting.trustScore,
            region,
            url: sr.url,
          },
          reason: `${FLAG_LABELS[vetting.flag]} — ${this.flagReason(vetting.flag, vetting)}`,
          requestedAt: new Date(),
        },
        channelId,
      );
      if (!approval.approved) {
        logger.info('Flagged article rejected in review mode', { url: sr.url, flag: vetting.flag });
        return false;
      }
    }

    // Parse publish date — Tavily metadata is primary; Gemini estimate is fallback.
    // Hard-reject anything older than 7 days: this is a second gate for results
    // where Tavily's published_date was absent but Gemini estimated an old date.
    let publishedAt: Date;
    try {
      const dateStr = sr.publishedDate ?? vetting.estimatedPublishDate;
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        publishedAt = new Date();
      } else {
        const ageDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 7) {
          logger.info('Article rejected at post-vetting freshness gate', {
            url: sr.url,
            reason: `STALE: published ${Math.floor(ageDays)} days ago`,
            dateSource: sr.publishedDate ? 'tavily' : 'gemini',
          });
          return false;
        }
        publishedAt = parsed;
      }
    } catch {
      publishedAt = new Date();
    }

    // Persist to DB
    const sectorTags = vetting.sectorTags as SectorTag[];
    const article = await this.db.article.create({
      data: {
        url: sr.url,
        hash,
        title: sr.title,
        summary: vetting.summary,
        rawContent: rawBody,
        outletId: outlet.id,
        biasScore: vetting.biasScore,
        trustRating: vetting.trustScore,
        region,
        sectorTags: serializeSectorTags(sectorTags),
        vettingFlag: vetting.flag ?? null,
        publishedAt,
        ...(corroboratedById ? { corroboratedById } : {}),
      },
    }) as SavedArticle;

    // Upsert embedding to ChromaDB and record embeddingId
    if (this.chroma && embedding) {
      try {
        await this.chroma.upsertArticle(article.id, embedding, {
          outletId: outlet.id,
          region,
          title: sr.title,
        });
        await this.db.article.update({
          where: { id: article.id },
          data: { embeddingId: article.id },
        });
      } catch (err) {
        logger.warn('ChromaDB upsert failed — embedding not stored', {
          articleId: article.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Post intel embed to Discord
    const embedData: ArticleForEmbed = {
      id: article.id,
      title: article.title,
      summary: article.summary,
      outlet: outlet.canonicalName,
      biasScore: article.biasScore,
      trustRating: article.trustRating,
      region,
      url: article.url,
      collectedAt: article.collectedAt,
      actionableIntel: vetting.actionableIntel,
      ...(vetting.flag ? { vettingFlag: vetting.flag } : {}),
    };
    const embed = formatIntelEmbed(embedData, outlet.canonicalName);
    await this.emitter.sendEmbed(embed, channelId);

    logger.info('Article saved', {
      id: article.id,
      outlet: outlet.canonicalName,
      trust: vetting.trustScore.toFixed(2),
      flag: vetting.flag ?? 'none',
      autoApprove: vetting.autoApprove,
      isCorroborated,
      embedded: embedding !== null,
    });
    return true;
  }

  private flagReason(
    flag: import('@vigil/shared').VettingFlag,
    vetting: import('@vigil/shared').ArticleVettingResult,
  ): string {
    switch (flag) {
      case 'UNKNOWN_OUTLET': return `"${vetting.outletName}" not in registry (provisional reliability: 50%)`;
      case 'LOW_TRUST': return `trust score ${(vetting.trustScore * 100).toFixed(0)}% below threshold`;
      case 'BIAS': return `bias score ${vetting.biasScore.toFixed(2)} exceeds ±0.5`;
      case 'UNVERIFIED': return 'single-source, not yet corroborated';
      case 'DUPLICATE': return 'duplicate detected';
    }
  }

  private async findOrCreateProvisionalOutlet(
    name: string,
    domain: string,
    reliabilityBase: number,
    channelId: string,
  ): Promise<OutletRecord> {
    const existing = await this.db.outlet.findFirst({ where: { canonicalName: name } }) as OutletRecord | null;
    if (existing) return existing;

    const created = await this.db.outlet.create({
      data: {
        canonicalName: name,
        aliases: JSON.stringify([domain]),
        biasAnchor: 0.0,
        reliabilityBase,
        region: null,
      },
    }) as OutletRecord;

    logger.info('Provisional outlet created', { name, domain, reliabilityBase });

    // Notify operator of new outlet detection
    await this.emitter.sendMessage(
      `🆕 **New outlet detected:** "${name}" (${domain}) — provisional reliability ${(reliabilityBase * 100).toFixed(0)}%. ` +
      `Review with \`!sources\` and update the outlet registry if needed.`,
      channelId,
    ).catch(() => undefined); // best-effort notification

    return created;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
