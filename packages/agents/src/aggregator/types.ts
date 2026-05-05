import type { Region } from '@vigil/shared';
import type { EmbedBuilder } from 'discord.js';

export interface ArticleRow {
  id: string;
  title: string;
  summary: string;
  url: string;
  biasScore: number;
  trustRating: number;
  region: Region;
  sectorTags: string;
  collectedAt: Date;
  publishedAt: Date;
  corroboratedById: string | null;
  vettingFlag: string | null;
  outletName: string; // resolved from outlet relation
  outletReliabilityBase: number; // resolved from outlet relation
}

export interface RankedArticle extends ArticleRow {
  rankScore: number;
  isCorroborated: boolean;
}

export interface DigestSection {
  region: Region;
  label: string;
  articles: RankedArticle[];
  interpretiveSummary: string;
}

export interface NewsletterStats {
  totalArticles: number;
  corroborationRate: number; // 0-1
  avgTrustRating: number;
  avgBiasScore: number;
  sectorCounts: Record<Region, number>;
}

export interface Newsletter {
  sections: DigestSection[];
  crossSectorAnalysis: string;
  stats: NewsletterStats;
  generatedAt: Date;
  lookbackHours: number;
}

export interface DigestState {
  lastDigestAt: string; // ISO 8601
}

/** Minimal emitter interface for the AggregatorAgent — avoids direct DiscordService coupling */
export interface AggregatorEmitter {
  generalChannelId: string;
  sendMessage(content: string, channelId?: string): Promise<void>;
  sendEmbeds(embeds: EmbedBuilder[], channelId: string): Promise<void>;
}
