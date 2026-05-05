import { describe, it, expect } from 'vitest';
import { detectCorroborations } from '../aggregator/corroborator.js';
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

describe('detectCorroborations()', () => {
  it('returns empty pairs when all titles are unrelated', () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Kansas City mayor proposes transit expansion budget' }),
      makeArticle({ id: 'a2', title: 'Federal reserve raises interest rates quarter point' }),
    ];
    const { pairs } = detectCorroborations(articles);
    expect(pairs).toHaveLength(0);
  });

  it('detects corroboration between nearly identical titles in same region', () => {
    const articles = [
      makeArticle({
        id: 'primary',
        title: 'Kansas City mayor announces major transit expansion plan funding',
        trustRating: 0.85,
        region: 'local',
      }),
      makeArticle({
        id: 'secondary',
        title: 'Kansas City mayor announces transit expansion plan billion dollars',
        trustRating: 0.65,
        region: 'local',
      }),
    ];
    const { pairs } = detectCorroborations(articles);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.primaryId).toBe('primary');
    expect(pairs[0]!.secondaryId).toBe('secondary');
  });

  it('does NOT corroborate articles from different regions', () => {
    const articles = [
      makeArticle({
        id: 'a1',
        title: 'Kansas City mayor announces transit expansion plan funding approved',
        region: 'local',
      }),
      makeArticle({
        id: 'a2',
        title: 'Kansas City mayor announces transit expansion plan funding approved',
        region: 'usa',
      }),
    ];
    const { pairs } = detectCorroborations(articles);
    expect(pairs).toHaveLength(0);
  });

  it('designates higher-trust article as primary', () => {
    const articles = [
      makeArticle({ id: 'low', trustRating: 0.5, title: 'Senate passes infrastructure bill bipartisan vote measure', region: 'usa' }),
      makeArticle({ id: 'high', trustRating: 0.9, title: 'Senate passes infrastructure bill bipartisan vote measure', region: 'usa' }),
    ];
    const { pairs } = detectCorroborations(articles);
    expect(pairs[0]!.primaryId).toBe('high');
    expect(pairs[0]!.secondaryId).toBe('low');
  });

  it('applies trust boost to the corroborated (secondary) article', () => {
    const articles = [
      makeArticle({ id: 'primary', trustRating: 0.85, title: 'Senate passes infrastructure bill bipartisan vote approved', region: 'usa' }),
      makeArticle({ id: 'secondary', trustRating: 0.6, title: 'Senate passes infrastructure bill bipartisan vote approved', region: 'usa' }),
    ];
    const { articles: updated } = detectCorroborations(articles);
    const secondary = updated.find((a) => a.id === 'secondary')!;
    expect(secondary.trustRating).toBeCloseTo(0.6 + 0.12); // TRUST_BOOST = 0.12
    expect(secondary.corroboratedById).toBe('primary');
  });

  it('caps trust boost at 1.0', () => {
    const articles = [
      makeArticle({ id: 'a', trustRating: 0.95, title: 'Senate passes infrastructure bill bipartisan vote approved', region: 'usa' }),
      makeArticle({ id: 'b', trustRating: 0.95, title: 'Senate passes infrastructure bill bipartisan vote approved', region: 'usa' }),
    ];
    const { articles: updated } = detectCorroborations(articles);
    for (const a of updated) {
      expect(a.trustRating).toBeLessThanOrEqual(1.0);
    }
  });

  it('returns original articles unchanged when no corroboration found', () => {
    const articles = [
      makeArticle({ id: 'a1', title: 'Unrelated story one local community event news' }),
      makeArticle({ id: 'a2', title: 'Federal reserve monetary policy interest rate decision' }),
    ];
    const { articles: updated } = detectCorroborations(articles);
    expect(updated[0]!.corroboratedById).toBeNull();
    expect(updated[1]!.corroboratedById).toBeNull();
  });
});
