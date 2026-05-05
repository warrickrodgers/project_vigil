import { describe, it, expect } from 'vitest';
import { rankArticles, computeNewsletterStats } from '../aggregator/ranker.js';
import type { ArticleRow } from '../aggregator/types.js';

function makeArticle(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: 'art-1',
    title: 'Test headline',
    summary: 'Test summary.',
    url: 'https://example.com/article',
    biasScore: 0.0,
    trustRating: 0.7,
    region: 'local',
    sectorTags: '["policy"]',
    collectedAt: new Date(),
    publishedAt: new Date(),
    corroboratedById: null,
    vettingFlag: null,
    outletName: 'Test Outlet',
    outletReliabilityBase: 0.8,
    ...overrides,
  };
}

describe('rankArticles()', () => {
  it('filters articles below MIN_TRUST_THRESHOLD (0.2)', () => {
    const articles = [
      makeArticle({ id: 'a1', trustRating: 0.19 }),
      makeArticle({ id: 'a2', trustRating: 0.2 }),
      makeArticle({ id: 'a3', trustRating: 0.8 }),
    ];
    const ranked = rankArticles(articles, Date.now());
    expect(ranked.map((a) => a.id)).not.toContain('a1');
    expect(ranked).toHaveLength(2);
  });

  it('sorts by descending rankScore', () => {
    const now = Date.now();
    const articles = [
      makeArticle({ id: 'low', trustRating: 0.5, collectedAt: new Date(now - 20 * 3600 * 1000) }),
      makeArticle({ id: 'high', trustRating: 0.9, collectedAt: new Date(now - 1 * 3600 * 1000) }),
      makeArticle({ id: 'mid', trustRating: 0.7, collectedAt: new Date(now - 6 * 3600 * 1000) }),
    ];
    const ranked = rankArticles(articles, now);
    expect(ranked[0]!.id).toBe('high');
    expect(ranked[ranked.length - 1]!.id).toBe('low');
  });

  it('applies corroboration bonus', () => {
    const now = Date.now();
    const base = makeArticle({ trustRating: 0.6, collectedAt: new Date(now) });
    const corroborated = makeArticle({
      id: 'corroborated',
      trustRating: 0.6,
      collectedAt: new Date(now),
      corroboratedById: 'some-other-id',
    });
    const ranked = rankArticles([base, corroborated], now);
    const corrobRanked = ranked.find((a) => a.id === 'corroborated')!;
    const baseRanked = ranked.find((a) => a.id !== 'corroborated')!;
    expect(corrobRanked.rankScore).toBeGreaterThan(baseRanked.rankScore);
    expect(corrobRanked.isCorroborated).toBe(true);
    expect(baseRanked.isCorroborated).toBe(false);
  });

  it('penalizes old articles via recency decay', () => {
    const now = Date.now();
    const fresh = makeArticle({ id: 'fresh', trustRating: 0.7, collectedAt: new Date(now) });
    const stale = makeArticle({
      id: 'stale',
      trustRating: 0.7,
      collectedAt: new Date(now - 48 * 3600 * 1000),
    });
    const ranked = rankArticles([fresh, stale], now);
    const freshScore = ranked.find((a) => a.id === 'fresh')!.rankScore;
    const staleScore = ranked.find((a) => a.id === 'stale')!.rankScore;
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('returns empty array when no articles pass threshold', () => {
    const ranked = rankArticles([makeArticle({ trustRating: 0.1 })], Date.now());
    expect(ranked).toHaveLength(0);
  });
});

describe('computeNewsletterStats()', () => {
  it('returns zero stats for empty array', () => {
    const stats = computeNewsletterStats([]);
    expect(stats.totalArticles).toBe(0);
    expect(stats.corroborationRate).toBe(0);
    expect(stats.avgTrustRating).toBe(0);
    expect(stats.avgBiasScore).toBe(0);
  });

  it('computes correct totals and averages', () => {
    const articles = [
      makeArticle({ trustRating: 0.8, biasScore: 0.2, region: 'local', corroboratedById: 'x' }),
      makeArticle({ id: 'a2', trustRating: 0.6, biasScore: -0.2, region: 'usa', corroboratedById: null }),
      makeArticle({ id: 'a3', trustRating: 0.7, biasScore: 0.0, region: 'geopolitical', corroboratedById: null }),
    ];
    const stats = computeNewsletterStats(articles);
    expect(stats.totalArticles).toBe(3);
    expect(stats.corroborationRate).toBeCloseTo(1 / 3);
    expect(stats.avgTrustRating).toBeCloseTo(0.7);
    expect(stats.avgBiasScore).toBe(0);
    expect(stats.sectorCounts.local).toBe(1);
    expect(stats.sectorCounts.usa).toBe(1);
    expect(stats.sectorCounts.geopolitical).toBe(1);
  });
});
