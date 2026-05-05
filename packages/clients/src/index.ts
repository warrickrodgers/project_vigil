export { GeminiClient } from './gemini/client.js';
export { GEMINI_MODELS } from './gemini/models.js';
export type { ModelTier } from './gemini/models.js';
export type { CompleteOptions, CompleteJSONOptions } from './gemini/types.js';

export { TavilyClient } from './tavily/client.js';
export type { SearchOptions } from './tavily/client.js';
export { SearchBudget, BudgetExhaustedError } from './tavily/budget.js';
export type { ExternalBudgetState } from './tavily/budget.js';
export type { TavilySearchResult, BudgetStatus, CanSearchResult } from './tavily/types.js';

export { APICallTracker } from './telemetry/tracker.js';
export { logger } from './telemetry/logger.js';
export type { APICallEvent } from './telemetry/types.js';

export { ChromaClient } from './chroma/client.js';
export type { SimilarArticle, ArticleMetadata } from './chroma/client.js';
