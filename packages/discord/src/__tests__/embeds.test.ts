import { describe, it, expect } from 'vitest';
import { formatIntelEmbed } from '../embeds/intel-card.js';
import { formatBiasAlertEmbed } from '../embeds/bias-alert.js';
import { formatNewsletterDigest } from '../embeds/newsletter.js';
import { formatStatusEmbed } from '../embeds/status.js';
import type { ArticleForEmbed, DigestSections, RegionStatus } from '../types.js';

function makeArticle(overrides: Partial<ArticleForEmbed> = {}): ArticleForEmbed {
  return {
    id: 'art-1',
    title: 'Test Headline',
    summary: 'Short summary.',
    outlet: 'Test Outlet',
    biasScore: 0.0,
    trustRating: 0.8,
    region: 'local',
    url: 'https://example.com/article',
    collectedAt: new Date('2026-04-17T06:00:00Z'),
    ...overrides,
  };
}

describe('formatIntelEmbed', () => {
  it('uses green color (0x2ecc71) for high-trust article', () => {
    const embed = formatIntelEmbed(makeArticle({ trustRating: 0.9 }), 'Reuters');
    expect(embed.data.color).toBe(0x2ecc71);
  });

  it('uses amber color (0xf39c12) for medium-trust article', () => {
    const embed = formatIntelEmbed(makeArticle({ trustRating: 0.5 }), 'Reuters');
    expect(embed.data.color).toBe(0xf39c12);
  });

  it('uses red color (0xe74c3c) for low-trust (high priority) article', () => {
    const embed = formatIntelEmbed(makeArticle({ trustRating: 0.2 }), 'Reuters');
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('includes outlet name in fields', () => {
    const embed = formatIntelEmbed(makeArticle(), 'AP News');
    const outletField = embed.data.fields?.find((f) => f.name === 'Outlet');
    expect(outletField?.value).toContain('AP News');
  });

  it('includes actionable intel field when provided', () => {
    const embed = formatIntelEmbed(
      makeArticle({ actionableIntel: 'Watch this closely.' }),
      'Reuters',
    );
    const field = embed.data.fields?.find((f) => f.name === 'Actionable Intel');
    expect(field?.value).toBe('Watch this closely.');
  });

  it('omits actionable intel field when not provided', () => {
    const embed = formatIntelEmbed(makeArticle(), 'Reuters');
    const field = embed.data.fields?.find((f) => f.name === 'Actionable Intel');
    expect(field).toBeUndefined();
  });
});

describe('formatBiasAlertEmbed', () => {
  it('uses orange warning color', () => {
    const embed = formatBiasAlertEmbed(makeArticle(), 'Outlet X', 'Extreme right bias detected.');
    expect(embed.data.color).toBe(0xe67e22);
  });

  it('has BIAS REVIEW REQUIRED title', () => {
    const embed = formatBiasAlertEmbed(makeArticle(), 'Outlet X', 'reason');
    expect(embed.data.title).toBe('⚠️ BIAS REVIEW REQUIRED');
  });
});

describe('formatNewsletterDigest', () => {
  it('returns three embeds — one per region', () => {
    const sections: DigestSections = {
      local: [makeArticle({ region: 'local' })],
      usa: [makeArticle({ region: 'usa' })],
      geopolitical: [makeArticle({ region: 'geopolitical' })],
    };
    const embeds = formatNewsletterDigest(sections);
    expect(embeds).toHaveLength(3);
  });

  it('shows no-articles message when section is empty', () => {
    const sections: DigestSections = { local: [], usa: [], geopolitical: [] };
    const embeds = formatNewsletterDigest(sections);
    expect(embeds[0]?.data.description).toContain('No articles');
  });
});

describe('formatStatusEmbed', () => {
  it('uses blue info color', () => {
    const statuses: RegionStatus[] = [
      { region: 'local', lastCollectionTime: null, articlesCollected: 0, nextScheduledRun: null, outletCount: 3 },
    ];
    const embed = formatStatusEmbed(statuses);
    expect(embed.data.color).toBe(0x3498db);
  });

  it('includes newsletter dispatch field', () => {
    const embed = formatStatusEmbed([]);
    const field = embed.data.fields?.find((f) => f.name === 'Newsletter');
    expect(field).toBeDefined();
  });
});
