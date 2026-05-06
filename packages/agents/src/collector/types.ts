import type { Region } from '@vigil/shared';
import type { EmbedBuilder } from 'discord.js';
import type {
  VigilApprovalRequest,
  ApprovalResult,
  SkipReviewRequest,
  SkipReviewResult,
} from '@vigil/discord';

export interface CollectionOptions {
  /** When true, flagged articles are held for operator approval before saving */
  review?: boolean;
}

export interface CollectionResult {
  region: Region;
  articlesFound: number;
  articlesSaved: number;
  articlesSkipped: number;
  durationMs: number;
  errors: string[];
}

/** Minimal interface for Discord channel posting — avoids coupling to DiscordService directly */
export interface CollectorEmitter {
  channelIds: Record<Region, string>;
  sendEmbed: (embed: EmbedBuilder, channelId: string) => Promise<void>;
  sendMessage: (message: string, channelId?: string) => Promise<void>;
  requestApproval: (
    request: VigilApprovalRequest,
    channelId?: string,
  ) => Promise<ApprovalResult>;
  requestSkipReview: (
    request: SkipReviewRequest,
    channelId?: string,
  ) => Promise<SkipReviewResult>;
}

/** Mirrors the Prisma Outlet model — avoids importing generated Prisma types */
export interface OutletRecord {
  id: string;
  canonicalName: string;
  aliases: string;
  biasAnchor: number;
  reliabilityBase: number;
  region: string | null;
}

/** Mirrors the Prisma Article model fields we use post-create */
export interface SavedArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  biasScore: number;
  trustRating: number;
  region: string;
  vettingFlag: string | null;
  collectedAt: Date;
}

/**
 * Minimal DB interface injected into CollectorAgent and AggregatorAgent.
 * The real Prisma client satisfies this after `npm run db:generate`.
 * Using injection avoids a static import of `@vigil/db` which Vite can't
 * resolve without the generated Prisma client.
 */
export interface VigilDB {
  outlet: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findFirst: (args?: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
  article: {
    findMany: (args?: unknown) => Promise<unknown[]>;
    findFirst: (args?: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    count: (args?: unknown) => Promise<number>;
    /** Returns true if an article with this URL was collected within the given window. */
    hasRecentArticle: (url: string, withinHours: number) => Promise<boolean>;
  };
}
