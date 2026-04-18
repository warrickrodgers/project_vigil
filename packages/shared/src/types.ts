// ---------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------

export type Region = 'local' | 'usa' | 'geopolitical';

const VALID_REGIONS: readonly Region[] = ['local', 'usa', 'geopolitical'] as const;

export function isRegion(x: unknown): x is Region {
  return typeof x === 'string' && (VALID_REGIONS as readonly string[]).includes(x);
}

// ---------------------------------------------------------------------------
// SectorTag
// ---------------------------------------------------------------------------

export type SectorTag =
  | 'policy'
  | 'economy'
  | 'conflict'
  | 'tech'
  | 'health'
  | 'environment'
  | 'legal';

const VALID_SECTOR_TAGS: readonly SectorTag[] = [
  'policy',
  'economy',
  'conflict',
  'tech',
  'health',
  'environment',
  'legal',
] as const;

export function isSectorTag(x: unknown): x is SectorTag {
  return typeof x === 'string' && (VALID_SECTOR_TAGS as readonly string[]).includes(x);
}

// ---------------------------------------------------------------------------
// SQLite array helpers
// ---------------------------------------------------------------------------

export function parseSectorTags(json: string): SectorTag[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`parseSectorTags: expected JSON array, got ${typeof parsed}`);
  }
  return parsed.filter(isSectorTag);
}

export function serializeSectorTags(tags: SectorTag[]): string {
  return JSON.stringify(tags);
}
