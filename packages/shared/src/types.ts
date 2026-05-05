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

// ---------------------------------------------------------------------------
// AI / provider types (shared across packages/clients and agents)
// ---------------------------------------------------------------------------

export type ModelTier = 'fast' | 'capable';
export type AIProvider = 'gemini' | 'tavily';

// ---------------------------------------------------------------------------
// Article vetting
// ---------------------------------------------------------------------------

export type VettingFlag =
  | 'BIAS'          // |biasScore| > 0.5
  | 'UNVERIFIED'    // single-source, not corroborated
  | 'DUPLICATE'     // hash or URL collision
  | 'LOW_TRUST'     // trustScore < 0.25
  | 'UNKNOWN_OUTLET'; // outlet not in registry

export interface ArticleVettingResult {
  // From single Gemini call:
  summary: string;
  actionableIntel: string;
  biasScore: number;
  sectorTags: SectorTag[];
  outletName: string;
  estimatedPublishDate: string;

  // Computed in TypeScript post-call:
  trustScore: number;
  isCorroborated: boolean;
  outletKnown: boolean;
  autoApprove: boolean;
  flag: VettingFlag | null;
}
