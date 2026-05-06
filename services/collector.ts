// Minimal Lambda handler type — avoids @types/aws-lambda dep until AWS is bootstrapped.
type LambdaHandler<TEvent, TResult> = (event: TEvent) => Promise<TResult>;

import { prisma } from '@vigil/db';
import { APICallTracker, GeminiClient, TavilyClient, SearchBudget, ChromaClient, logger } from '@vigil/clients';
import { CollectorAgent, makeVigilDB } from '@vigil/agents';
import type { Region } from '@vigil/shared';
import { createLambdaEmitter } from './lib/lambda-emitter.js';
import { loadBudgetState, saveBudgetState } from './lib/db-budget.js';

export interface CollectorEvent {
  /** 'local' | 'usa' | 'geopolitical' — omit to run all three. */
  region?: Region;
  /** When true, flagged articles are skipped rather than auto-approved. */
  review?: boolean;
}

export interface CollectorResult {
  regions: Region[];
  results: Array<{
    region: Region;
    articlesFound: number;
    articlesSaved: number;
    articlesSkipped: number;
    durationMs: number;
    errors: string[];
  }>;
}

export const handler: LambdaHandler<CollectorEvent, CollectorResult> = async (event) => {
  const ALL_REGIONS: Region[] = ['local', 'usa', 'geopolitical'];
  const regions: Region[] = event.region ? [event.region] : ALL_REGIONS;

  // Load budget from DB so state persists across Lambda cold starts.
  const loaded = await loadBudgetState(prisma);
  const budget = new SearchBudget({
    ...(loaded !== null ? { initialState: loaded } : {}),
    disableFilePersistence: true,
  });

  const tracker = new APICallTracker();
  const gemini = new GeminiClient(process.env['GEMINI_API_KEY'] ?? '', tracker);
  const tavily = new TavilyClient(process.env['TAVILY_API_KEY'] ?? '', tracker, budget);
  const chroma = new ChromaClient();

  const results: CollectorResult['results'] = [];

  for (const region of regions) {
    const emitter = createLambdaEmitter(region);
    const agent = new CollectorAgent(
      gemini,
      tavily,
      emitter,
      makeVigilDB(prisma),
      chroma,
    );

    try {
      const result = await agent.collect(region, { ...(event.review !== undefined && { review: event.review }) });
      results.push(result);
    } catch (err) {
      logger.error(`Collector failed for ${region}`, err instanceof Error ? err : new Error(String(err)));
      results.push({ region, articlesFound: 0, articlesSaved: 0, articlesSkipped: 0, durationMs: 0, errors: [String(err)] });
    }
  }

  await saveBudgetState(prisma, budget.getState());
  await tracker.flush();

  return { regions, results };
};
