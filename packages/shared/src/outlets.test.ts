import { describe, it, expect } from 'vitest';
import { resolveOutlet, normalizeOutletName } from './outlets.js';
import type { OutletLike } from './outlets.js';

const outlets: OutletLike[] = [
  {
    canonicalName: 'KC Star',
    aliases: JSON.stringify(['The KC Star', 'kc star', 'Kansas City Star']),
  },
  {
    canonicalName: 'AP News',
    aliases: JSON.stringify(['AP', 'Associated Press', 'the associated press']),
  },
  {
    canonicalName: 'Reuters',
    aliases: JSON.stringify(['reuters.com']),
  },
];

describe('normalizeOutletName', () => {
  it('trims whitespace', () => {
    expect(normalizeOutletName('  Reuters  ')).toBe('reuters');
  });
  it('collapses internal whitespace', () => {
    expect(normalizeOutletName('KC  Star')).toBe('kc star');
  });
  it('lowercases', () => {
    expect(normalizeOutletName('AP News')).toBe('ap news');
  });
});

describe('resolveOutlet', () => {
  it('resolves by exact canonical name (case-insensitive)', () => {
    expect(resolveOutlet('KC Star', outlets)?.canonicalName).toBe('KC Star');
    expect(resolveOutlet('kc star', outlets)?.canonicalName).toBe('KC Star');
    expect(resolveOutlet('KC STAR', outlets)?.canonicalName).toBe('KC Star');
  });

  it('"KC Star", "The KC Star", and "kc star" all resolve to the same outlet', () => {
    const a = resolveOutlet('KC Star', outlets);
    const b = resolveOutlet('The KC Star', outlets);
    const c = resolveOutlet('kc star', outlets);
    expect(a).not.toBeNull();
    expect(a?.canonicalName).toBe(b?.canonicalName);
    expect(b?.canonicalName).toBe(c?.canonicalName);
  });

  it('resolves "Kansas City Star" via alias', () => {
    expect(resolveOutlet('Kansas City Star', outlets)?.canonicalName).toBe('KC Star');
  });

  it('resolves "AP" and "Associated Press" to AP News', () => {
    expect(resolveOutlet('AP', outlets)?.canonicalName).toBe('AP News');
    expect(resolveOutlet('Associated Press', outlets)?.canonicalName).toBe('AP News');
    expect(resolveOutlet('The Associated Press', outlets)?.canonicalName).toBe('AP News');
  });

  it('returns null for an unknown outlet', () => {
    expect(resolveOutlet('Breitbart', outlets)).toBeNull();
    expect(resolveOutlet('', outlets)).toBeNull();
  });

  it('trims whitespace in the raw name before matching', () => {
    expect(resolveOutlet('  Reuters  ', outlets)?.canonicalName).toBe('Reuters');
  });

  it('is generic — preserves the full outlet record type', () => {
    type FullOutlet = OutletLike & { id: string; biasAnchor: number };
    const typed: FullOutlet[] = [
      { canonicalName: 'Reuters', aliases: '[]', id: 'cid_123', biasAnchor: 0.0 },
    ];
    const result = resolveOutlet('Reuters', typed);
    expect(result?.id).toBe('cid_123');
    expect(result?.biasAnchor).toBe(0.0);
  });
});
