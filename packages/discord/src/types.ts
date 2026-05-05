import type { Region } from '@vigil/shared';

// ---------------------------------------------------------------------------
// Skip review
// ---------------------------------------------------------------------------

export type SkipReason = 'unknown_outlet' | 'low_trust' | 'single_source_high_bias';

export interface SkipReviewRequest {
  id: string;
  reason: SkipReason;
  /** Human-readable explanation shown to the operator */
  reasonDetail: string;
  /** Raw outlet name detected by AI / domain fallback */
  outletName: string;
  domain: string;
  /** Agent's computed values — preserved regardless of operator decision */
  agentTrustRating: number;
  agentBiasScore: number;
  region: Region;
  article: {
    title: string;
    url: string;
    summary: string;
  };
  requestedAt: Date;
}

export interface SkipReviewResult {
  /** true = operator overrides skip and wants the article saved */
  keep: boolean;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export interface CommandOptions {
  /** When true, flagged articles require operator approval before saving/publishing */
  review?: boolean;
}

export type CollectHandler = (region: Region, options?: CommandOptions) => Promise<void>;
export type ScanHandler = (region: Region, topic: string) => Promise<void>;
export type StatusHandler = (region: Region) => Promise<void>;
export type SourcesHandler = (region: Region) => Promise<void>;
export type DigestHandler = (options?: CommandOptions) => Promise<void>;
export type FlashHandler = () => Promise<void>;
export type BriefingHandler = () => Promise<void>;
export type ScheduleHandler = () => Promise<void>;
export type ReviewHandler = (articleId: string) => Promise<void>;
export type FlagHandler = (articleId: string) => Promise<void>;

export interface VigilApprovalRequest {
  id: string;
  type: 'bias_review' | 'single_source' | 'manual_flag';
  article: {
    id: string;
    title: string;
    summary: string;
    outlet: string;
    biasScore: number;
    trustRating: number;
    region: Region;
    url: string;
  };
  reason: string;
  requestedAt: Date;
}

export interface ApprovalResult {
  approved: boolean;
  action: 'approve' | 'reject' | 'edit';
  note?: string;
}

export interface ArticleForEmbed {
  id: string;
  title: string;
  summary: string;
  outlet: string;
  biasScore: number;
  trustRating: number;
  region: Region;
  url: string;
  collectedAt: Date;
  actionableIntel?: string;
  vettingFlag?: string;
}

export interface DigestSections {
  local: ArticleForEmbed[];
  usa: ArticleForEmbed[];
  geopolitical: ArticleForEmbed[];
}

export interface RegionStatus {
  region: Region;
  lastCollectionTime: Date | null;
  articlesCollected: number;
  nextScheduledRun: Date | null;
  outletCount: number;
}
