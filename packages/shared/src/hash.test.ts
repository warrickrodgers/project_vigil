import { describe, it, expect } from 'vitest';
import { computeArticleHash } from './hash.js';

describe('computeArticleHash', () => {
  it('produces identical hashes for identical title + content', () => {
    const h1 = computeArticleHash('Fed holds rates steady', 'The Fed voted unanimously...');
    const h2 = computeArticleHash('Fed holds rates steady', 'The Fed voted unanimously...');
    expect(h1).toBe(h2);
  });

  it('normalises whitespace — leading/trailing/internal spaces are equivalent', () => {
    const clean = computeArticleHash('Fed holds rates steady', 'The Fed voted.');
    const spaced = computeArticleHash('  Fed  holds  rates  steady  ', '  The  Fed  voted.  ');
    expect(clean).toBe(spaced);
  });

  it('normalises case — uppercase and lowercase produce the same hash', () => {
    const lower = computeArticleHash('fed holds rates steady', 'the fed voted.');
    const upper = computeArticleHash('FED HOLDS RATES STEADY', 'THE FED VOTED.');
    expect(lower).toBe(upper);
  });

  it('produces different hashes for different content', () => {
    const h1 = computeArticleHash('Story A', 'Content about topic A');
    const h2 = computeArticleHash('Story B', 'Content about topic B');
    expect(h1).not.toBe(h2);
  });

  it('produces different hashes when only the title differs', () => {
    const h1 = computeArticleHash('Title One', 'Same body text');
    const h2 = computeArticleHash('Title Two', 'Same body text');
    expect(h1).not.toBe(h2);
  });

  it('handles empty rawContent (fetch-failed case) without throwing', () => {
    const h = computeArticleHash('Some headline', '');
    expect(typeof h).toBe('string');
    expect(h).toHaveLength(64); // sha256 hex is always 64 chars
  });

  it('empty rawContent hashes are stable across calls', () => {
    const h1 = computeArticleHash('Headline', '');
    const h2 = computeArticleHash('Headline', '');
    expect(h1).toBe(h2);
  });

  it('returns a 64-character hex string', () => {
    const h = computeArticleHash('title', 'content');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
