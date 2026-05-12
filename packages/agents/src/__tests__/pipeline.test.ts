import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollectorEmitter } from '../collector/types.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  outlet: { findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  article: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    count: vi.fn(),
    hasRecentArticle: vi.fn().mockResolvedValue(false), // no 48h dupe by default
  },
};

vi.mock('@vigil/clients', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFormatIntelEmbed = vi.hoisted(() => vi.fn().mockReturnValue({ setColor: vi.fn() }));
vi.mock('@vigil/discord', () => ({
  formatIntelEmbed: mockFormatIntelEmbed,
}));

vi.mock('@vigil/shared', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@vigil/shared')>();
  return {
    ...mod,
    computeArticleHash: vi.fn().mockReturnValue('hash-abc123'),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks are hoisted
// ---------------------------------------------------------------------------

import { CollectorAgent } from '../collector/pipeline.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OUTLET_REUTERS: import('../collector/types.js').OutletRecord = {
  id: 'outlet-1',
  canonicalName: 'Reuters',
  aliases: JSON.stringify(['reuters.com', 'Reuters News']),
  biasAnchor: 0.0,
  reliabilityBase: 0.9,
  region: null,
};

const SEARCH_RESULT = {
  title: 'KC Mayor announces transit expansion',
  url: 'https://reuters.com/article/kc-transit',
  content: 'Mayor Q announced a $200M transit expansion plan on Thursday...',
  score: 0.92,
};

const GEMINI_QUERIES = { queries: ['kansas city transit news', 'KC metro development', 'Missouri infrastructure'] };

/** Unified vetting fixture — 6 fields (no outlet reliability estimate in Phase 2b) */
const GEMINI_UNIFIED = {
  summary: 'Mayor Q announced a $200M transit expansion covering the KC metro.',
  actionableIntel: 'KC transit riders should expect expanded routes by 2027; corridor commuters plan for construction delays.',
  biasScore: 0.1,
  sectorTags: ['policy', 'economy'],
  outletName: 'Reuters',
  // Use today so the 7-day freshness gate never rejects fixture articles
  estimatedPublishDate: new Date().toISOString().slice(0, 10),
};

const SAVED_ARTICLE = {
  id: 'art-1',
  url: SEARCH_RESULT.url,
  title: SEARCH_RESULT.title,
  summary: GEMINI_UNIFIED.summary,
  biasScore: 0.05,
  trustRating: 0.67,
  region: 'local',
  vettingFlag: 'UNVERIFIED',
  collectedAt: new Date(),
};

function makeEmitter(overrides?: Partial<CollectorEmitter>): CollectorEmitter {
  return {
    channelIds: { local: 'ch-local', usa: 'ch-usa', geopolitical: 'ch-geo' },
    sendEmbed: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    requestApproval: vi.fn().mockResolvedValue({ approved: true, action: 'approve' }),
    requestSkipReview: vi.fn().mockResolvedValue({ keep: false }),
    ...overrides,
  };
}

/** Default mock: 1st call = query generation, 2nd call = unified vetting */
function makeGemini(unifiedResult = GEMINI_UNIFIED) {
  return {
    completeJSON: vi.fn()
      .mockResolvedValueOnce(GEMINI_QUERIES)
      .mockResolvedValueOnce(unifiedResult),
    complete: vi.fn(),
    embed: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  };
}

function makeTavily(results = [SEARCH_RESULT]) {
  return { search: vi.fn().mockResolvedValue(results) };
}

function makeChroma(similarArticles: Array<{ articleId: string; outletId: string; region: string; score: number }> = []) {
  return {
    querySimilar: vi.fn().mockResolvedValue(similarArticles),
    upsertArticle: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.outlet.findMany.mockResolvedValue([OUTLET_REUTERS]);
    mockPrisma.article.findFirst.mockResolvedValue(null); // no duplicate
    mockPrisma.article.create.mockResolvedValue(SAVED_ARTICLE);
    mockPrisma.article.count.mockResolvedValue(5);
  });

  describe('collect() — default mode (no --review)', () => {
    it('runs full pipeline with one unified Gemini call and saves article', async () => {
      const gemini = makeGemini();
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local');

      expect(result.articlesSaved).toBe(1);
      expect(result.articlesSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      // Only 2 Gemini calls: query generation + unified vetting (no outlet reliability call)
      expect(gemini.completeJSON).toHaveBeenCalledTimes(2);
      expect(mockPrisma.article.create).toHaveBeenCalledOnce();
      expect(emitter.sendEmbed).toHaveBeenCalledOnce();
    });

    it('deduplicates before vetting — no Gemini call for duplicate URL', async () => {
      mockPrisma.article.findFirst.mockResolvedValue({ id: 'existing-art' });
      const gemini = makeGemini();
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local');

      expect(result.articlesSkipped).toBe(1);
      expect(result.articlesSaved).toBe(0);
      // Only 1 Gemini call (query generation) — unified vetting skipped for duplicates
      expect(gemini.completeJSON).toHaveBeenCalledTimes(1);
      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });

    it('auto-provisions unknown outlet at 0.5 reliability and saves article with UNKNOWN_OUTLET flag', async () => {
      const unknownResult = { ...SEARCH_RESULT, url: 'https://unknownblogxyz.io/article/1' };
      mockPrisma.outlet.findFirst.mockResolvedValue(null);
      const gemini = makeGemini({ ...GEMINI_UNIFIED, outletName: 'UnknownBlogXYZ' });
      mockPrisma.outlet.create.mockResolvedValue({
        id: 'outlet-new', canonicalName: 'UnknownBlogXYZ', aliases: '["unknownblogxyz.io"]',
        biasAnchor: 0.0, reliabilityBase: 0.5, region: null,
      });

      const emitter = makeEmitter();
      const agent = new CollectorAgent(
        gemini as never,
        { search: vi.fn().mockResolvedValue([unknownResult]) } as never,
        emitter,
        mockPrisma,
      );

      const result = await agent.collect('local');

      expect(mockPrisma.outlet.create).toHaveBeenCalledOnce();
      // Provisional outlet always uses 0.5 reliability (not Gemini estimate)
      expect(mockPrisma.outlet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reliabilityBase: 0.5 }) }),
      );
      expect(mockPrisma.article.create).toHaveBeenCalledOnce();
      expect(emitter.requestApproval).not.toHaveBeenCalled();
      expect(emitter.requestSkipReview).not.toHaveBeenCalled();
      expect(result.articlesSkipped).toBe(0);
      // Discord notification sent about new outlet
      expect(emitter.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('New outlet detected'),
        expect.any(String),
      );
    });

    it('saves high-bias article WITHOUT approval prompt (default mode)', async () => {
      const highBiasGemini = makeGemini({ ...GEMINI_UNIFIED, biasScore: 0.8 });
      const emitter = makeEmitter();
      const agent = new CollectorAgent(highBiasGemini as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local');

      expect(result.articlesSaved).toBe(1);
      expect(emitter.requestApproval).not.toHaveBeenCalled();
    });

    it('continues collection when unified vetting call fails for one article', async () => {
      const twoResults = [SEARCH_RESULT, { ...SEARCH_RESULT, url: 'https://reuters.com/article/2', title: 'Second article' }];
      const gemini = {
        completeJSON: vi.fn()
          .mockResolvedValueOnce(GEMINI_QUERIES)
          .mockRejectedValueOnce(new Error('Gemini 503'))
          .mockResolvedValueOnce(GEMINI_UNIFIED),
        complete: vi.fn(),
        embed: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
      };
      mockPrisma.article.findFirst.mockResolvedValue(null);
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily(twoResults) as never, emitter, mockPrisma);

      const result = await agent.collect('local');

      expect(result.articlesSaved + result.articlesSkipped).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('deduplicates across multiple queries (same URL from different searches)', async () => {
      const gemini = makeGemini();
      gemini.completeJSON
        .mockReset()
        .mockResolvedValueOnce({ queries: ['q1', 'q2', 'q3'] })
        .mockResolvedValueOnce(GEMINI_UNIFIED);
      const tavily = {
        search: vi.fn()
          .mockResolvedValueOnce([SEARCH_RESULT])
          .mockResolvedValueOnce([SEARCH_RESULT])
          .mockResolvedValueOnce([]),
      };

      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, tavily as never, emitter, mockPrisma);
      const result = await agent.collect('local');

      expect(result.articlesFound).toBe(1);
      expect(result.articlesSaved).toBe(1);
    });

    it('posts status message when no outlets are seeded', async () => {
      mockPrisma.outlet.findMany.mockResolvedValue([]);
      const emitter = makeEmitter();
      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local');

      expect(result.articlesSaved).toBe(0);
      expect(emitter.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('No outlets found'),
        'ch-local',
      );
    });
  });

  describe('collect() — ChromaDB semantic corroboration', () => {
    it('sets isCorroborated=true and corroboratedById when vector match found', async () => {
      const gemini = makeGemini();
      const chroma = makeChroma([{ articleId: 'art-existing', outletId: 'outlet-2', region: 'local', score: 0.93 }]);
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma, chroma as never);

      await agent.collect('local');

      // Article saved with corroboratedById set
      expect(mockPrisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ corroboratedById: 'art-existing' }),
        }),
      );
      // Embedding upserted and embeddingId updated
      expect(chroma.upsertArticle).toHaveBeenCalledOnce();
      expect(mockPrisma.article.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ embeddingId: SAVED_ARTICLE.id }) }),
      );
    });

    it('saves article without corroboration when ChromaDB returns no matches', async () => {
      const gemini = makeGemini();
      const chroma = makeChroma([]); // no similar articles
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma, chroma as never);

      await agent.collect('local');

      expect(mockPrisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ corroboratedById: expect.anything() }),
        }),
      );
      // Embedding still upserted even without match
      expect(chroma.upsertArticle).toHaveBeenCalledOnce();
    });

    it('falls back gracefully when ChromaDB query fails', async () => {
      const gemini = makeGemini();
      const chroma = {
        querySimilar: vi.fn().mockRejectedValue(new Error('ChromaDB connection refused')),
        upsertArticle: vi.fn().mockResolvedValue(undefined),
      };
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma, chroma as never);

      const result = await agent.collect('local');

      // Article still saved — ChromaDB failure is not fatal
      expect(result.articlesSaved).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('skips embed/query when no chroma client provided (backward compat)', async () => {
      const gemini = makeGemini();
      const emitter = makeEmitter();
      const agent = new CollectorAgent(gemini as never, makeTavily() as never, emitter, mockPrisma);

      await agent.collect('local');

      // embed never called
      expect(gemini.embed).not.toHaveBeenCalled();
    });
  });

  describe('collect() — --review mode', () => {
    it('requests approval for flagged article in review mode', async () => {
      const emitter = makeEmitter();
      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, emitter, mockPrisma);

      // Article will have UNVERIFIED flag (not corroborated) → prompts for approval
      await agent.collect('local', { review: true });

      expect(emitter.requestApproval).toHaveBeenCalledOnce();
    });

    it('saves article when operator approves in review mode', async () => {
      const emitter = makeEmitter({
        requestApproval: vi.fn().mockResolvedValue({ approved: true, action: 'approve' }),
      });
      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local', { review: true });

      expect(result.articlesSaved).toBe(1);
      expect(mockPrisma.article.create).toHaveBeenCalledOnce();
    });

    it('skips article when operator rejects in review mode', async () => {
      const emitter = makeEmitter({
        requestApproval: vi.fn().mockResolvedValue({ approved: false, action: 'reject' }),
      });
      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, emitter, mockPrisma);

      const result = await agent.collect('local', { review: true });

      expect(result.articlesSkipped).toBe(1);
      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });
  });

  describe('scan()', () => {
    it('uses advanced search depth and 5 max results', async () => {
      const tavily = makeTavily();
      const agent = new CollectorAgent(makeGemini() as never, tavily as never, makeEmitter(), mockPrisma);

      await agent.scan('local', 'transit expansion');

      expect(tavily.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ searchDepth: 'advanced', maxResults: 5 }),
      );
    });
  });

  describe('getStatus()', () => {
    it('returns region status with article count and last collection time', async () => {
      mockPrisma.article.findFirst.mockResolvedValue(SAVED_ARTICLE);
      mockPrisma.article.count.mockResolvedValue(42);

      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, makeEmitter(), mockPrisma);
      const status = await agent.getStatus('local');

      expect(status.region).toBe('local');
      expect(status.articlesCollected).toBe(42);
      expect(status.lastCollectionTime).toEqual(SAVED_ARTICLE.collectedAt);
      expect(status.outletCount).toBe(1);
    });
  });

  describe('getSources()', () => {
    it('returns outlets for the region sorted by name', async () => {
      const agent = new CollectorAgent(makeGemini() as never, makeTavily() as never, makeEmitter(), mockPrisma);
      const sources = await agent.getSources('local');

      expect(sources).toHaveLength(1);
      expect(sources[0]?.canonicalName).toBe('Reuters');
    });
  });
});
