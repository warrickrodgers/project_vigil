export { CollectorAgent } from './collector/pipeline.js';
export { REGION_CONFIGS } from './collector/config.js';
export type { CollectionResult, CollectorEmitter, OutletRecord, VigilDB } from './collector/types.js';

export { AggregatorAgent } from './aggregator/index.js';
export type { AggregatorEmitter, Newsletter, DigestSection, NewsletterStats } from './aggregator/types.js';
export { renderHtmlEmail, renderPlainText } from './aggregator/template.js';
