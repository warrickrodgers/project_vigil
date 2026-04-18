import type { Region } from '@vigil/shared';

export type CollectHandler = (region: Region) => Promise<void>;
export type ScanHandler = (region: Region, topic: string) => Promise<void>;
export type StatusHandler = (region: Region) => Promise<void>;
export type SourcesHandler = (region: Region) => Promise<void>;
export type DigestHandler = () => Promise<void>;
export type FlashHandler = () => Promise<void>;
export type BriefingHandler = () => Promise<void>;
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
