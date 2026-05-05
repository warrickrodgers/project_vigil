import { describe, it, expect } from 'vitest';
import { renderHtmlEmail, renderPlainText } from '../aggregator/template.js';
import type { Newsletter, RankedArticle } from '../aggregator/types.js';

function makeRankedArticle(overrides: Partial<RankedArticle> = {}): RankedArticle {
  return {
    id: 'art-1',
    title: 'KC Mayor announces transit expansion',
    summary: 'Mayor Q announced a $200M transit expansion plan.',
    url: 'https://kansascity.com/transit',
    biasScore: 0.05,
    trustRating: 0.72,
    region: 'local',
    sectorTags: '["policy"]',
    collectedAt: new Date('2026-04-22T06:00:00Z'),
    publishedAt: new Date('2026-04-22T05:00:00Z'),
    corroboratedById: null,
    vettingFlag: null,
    outletName: 'Kansas City Star',
    outletReliabilityBase: 0.78,
    rankScore: 0.68,
    isCorroborated: false,
    ...overrides,
  };
}

function makeNewsletter(overrides: Partial<Newsletter> = {}): Newsletter {
  return {
    sections: [
      {
        region: 'local',
        label: '📍 LOCAL INTEL — Kansas City Metro',
        articles: [makeRankedArticle()],
        interpretiveSummary: 'Local transit investment signals continued urban development.',
      },
      {
        region: 'usa',
        label: '🇺🇸 USA INTEL — National',
        articles: [makeRankedArticle({ id: 'art-2', region: 'usa', title: 'Senate infrastructure bill advances', url: 'https://apnews.com/senate', outletName: 'AP' })],
        interpretiveSummary: 'Federal infrastructure momentum continues.',
      },
      {
        region: 'geopolitical',
        label: '🌐 GEOPOLITICAL INTEL — Global',
        articles: [],
        interpretiveSummary: '',
      },
    ],
    crossSectorAnalysis: 'Infrastructure spending trends connect local and national developments.',
    stats: {
      totalArticles: 2,
      corroborationRate: 0.5,
      avgTrustRating: 0.72,
      avgBiasScore: 0.05,
      sectorCounts: { local: 1, usa: 1, geopolitical: 0 },
    },
    generatedAt: new Date('2026-04-22T06:00:00Z'),
    lookbackHours: 24,
  };
}

describe('renderHtmlEmail()', () => {
  it('produces a non-empty HTML string', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toBeTruthy();
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('includes section labels for all three regions', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toContain('LOCAL INTEL');
    expect(html).toContain('USA INTEL');
    expect(html).toContain('GEOPOLITICAL INTEL');
  });

  it('includes article titles and outlet names', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toContain('KC Mayor announces transit expansion');
    expect(html).toContain('KANSAS CITY STAR'); // template renders outlet names toUpperCase()
  });

  it('includes the cross-sector analysis', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toContain('Infrastructure spending trends connect');
  });

  it('includes corroboration badge when article is corroborated', () => {
    const newsletter = makeNewsletter();
    newsletter.sections[0]!.articles[0]!.isCorroborated = true;
    const html = renderHtmlEmail(newsletter);
    expect(html).toContain('✓ Corroborated');
  });

  it('shows "No articles" fallback when section is empty', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toContain('No articles collected for this sector.');
  });

  it('includes unsubscribe link when recipientEmail is provided', () => {
    const html = renderHtmlEmail(makeNewsletter(), 'test@example.com');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('test%40example.com');
  });

  it('omits unsubscribe link when no recipientEmail', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).not.toContain('Unsubscribe');
  });

  it('includes stats block with corroboration rate and avg trust', () => {
    const html = renderHtmlEmail(makeNewsletter());
    expect(html).toContain('Corroboration rate');
    expect(html).toContain('Avg trust rating');
  });

  it('shows temporal label when article was published multiple days before newsletter', () => {
    const newsletter = makeNewsletter();
    // Set generatedAt 3 days after publishedAt
    newsletter.generatedAt = new Date('2026-04-25T06:00:00Z');
    // publishedAt in fixture is 2026-04-22T05:00:00Z → 3 days before
    const html = renderHtmlEmail(newsletter);
    expect(html).toContain('3 days ago');
  });

  it('omits temporal label when article was published less than a day before newsletter', () => {
    const html = renderHtmlEmail(makeNewsletter());
    // generatedAt=2026-04-22T06:00Z, publishedAt=2026-04-22T05:00Z → same day
    expect(html).not.toContain('days ago');
    expect(html).not.toContain('yesterday');
  });
});

describe('renderPlainText()', () => {
  it('produces a non-empty plain-text string', () => {
    const text = renderPlainText(makeNewsletter());
    expect(text).toBeTruthy();
    expect(text).toContain('PROJECT VIGIL');
  });

  it('includes all region section labels', () => {
    const text = renderPlainText(makeNewsletter());
    expect(text).toContain('LOCAL INTEL');
    expect(text).toContain('USA INTEL');
    expect(text).toContain('GEOPOLITICAL INTEL');
  });

  it('includes article titles and outlet names', () => {
    const text = renderPlainText(makeNewsletter());
    expect(text).toContain('KC Mayor announces transit expansion');
    expect(text).toContain('Kansas City Star');
  });

  it('includes cross-sector analysis section', () => {
    const text = renderPlainText(makeNewsletter());
    expect(text).toContain('CROSS-SECTOR ANALYSIS');
    expect(text).toContain('Infrastructure spending trends connect');
  });

  it('includes stats line', () => {
    const text = renderPlainText(makeNewsletter());
    expect(text).toContain('Articles: 2');
    expect(text).toContain('Corroborated:');
  });

  it('shows temporal label in plain text for stale articles', () => {
    const newsletter = makeNewsletter();
    // generatedAt 2 days after fixture publishedAt (2026-04-22T05:00Z)
    newsletter.generatedAt = new Date('2026-04-24T06:00:00Z');
    const text = renderPlainText(newsletter);
    expect(text).toContain('Published 2 days ago');
  });
});
