import type { TavilySearchResult } from './types.js';
import type { SearchBudget } from './budget.js';
import { BudgetExhaustedError } from './budget.js';
import type { APICallTracker } from '../telemetry/tracker.js';
import { logger } from '../telemetry/logger.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyRawResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
}

interface TavilyAPIResponse {
  results: TavilyRawResult[];
}

export interface SearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeRawContent?: boolean;
  label?: string;
  /** Max age of results in days. Defaults to 10 to keep intel fresh. */
  days?: number;
}

export class TavilyClient {
  private readonly apiKey: string;
  private readonly tracker: APICallTracker;
  private readonly budget: SearchBudget;

  constructor(apiKey: string, tracker: APICallTracker, budget: SearchBudget) {
    this.apiKey = apiKey;
    this.tracker = tracker;
    this.budget = budget;
  }

  async search(query: string, options?: SearchOptions): Promise<TavilySearchResult[]> {
    const label = options?.label ?? 'tavily-search';

    // Check budget before making the request
    const budgetCheck = this.budget.canSearch();
    if (!budgetCheck.allowed) {
      throw new BudgetExhaustedError(
        `Monthly Tavily search limit exhausted. Remaining: ${budgetCheck.remaining.monthly}`
      );
    }
    if (budgetCheck.warning !== undefined) {
      logger.warn('Tavily budget warning', { warning: budgetCheck.warning, label });
    }

    const startTime = Date.now();
    let success = false;
    let resultCount = 0;
    let error: string | undefined;

    try {
      const body: Record<string, unknown> = {
        api_key: this.apiKey,
        query,
        search_depth: options?.searchDepth ?? 'basic',
        max_results: options?.maxResults ?? 5,
        include_raw_content: options?.includeRawContent ?? false,
        days: options?.days ?? 10,
      };

      const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Tavily API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as TavilyAPIResponse;
      const results: TavilySearchResult[] = data.results.map(r => {
        const result: TavilySearchResult = {
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        };
        if (r.raw_content !== undefined) result.rawContent = r.raw_content;
        return result;
      });

      resultCount = results.length;
      success = true;
      this.budget.recordSearch();

      return results;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const remaining = this.budget.canSearch().remaining;
      this.tracker.record({
        provider: 'tavily',
        model: 'search-basic',
        tier: 'search',
        label,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUSD: 0,
        latencyMs: Date.now() - startTime,
        success,
        retryCount: 0,
        timestamp: new Date(),
        metadata: { query, resultCount, budgetRemaining: remaining },
        ...(error !== undefined ? { error } : {}),
      });
    }
  }
}
