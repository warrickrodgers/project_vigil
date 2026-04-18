export { DiscordService } from './service.js';
export { loadConfig } from './config.js';
export type { DiscordConfig } from './config.js';
export type {
  VigilApprovalRequest,
  ApprovalResult,
  ArticleForEmbed,
  DigestSections,
  RegionStatus,
  CollectHandler,
  ScanHandler,
  StatusHandler,
  SourcesHandler,
  DigestHandler,
  FlashHandler,
  BriefingHandler,
  ReviewHandler,
  FlagHandler,
} from './types.js';
export { formatIntelEmbed } from './embeds/intel-card.js';
export { formatNewsletterDigest } from './embeds/newsletter.js';
export { formatBiasAlertEmbed } from './embeds/bias-alert.js';
export { formatStatusEmbed } from './embeds/status.js';
