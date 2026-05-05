import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TavilyClient } from '../tavily/client.js';
import { SearchBudget, BudgetExhaustedError } from '../tavily/budget.js';
import { APICallTracker } from '../telemetry/tracker.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeTavilyResponse(results: Array<{ title: string; url: string; content: string; score: number }>) {
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TavilyClient', () => {
  let tmpDir: string;
  let tracker: APICallTracker;
  let budget: SearchBudget;
  let client: TavilyClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-tavily-'));
    tracker = new APICallTracker({ telemetryDir: path.join(tmpDir, 'telemetry') });
    budget = new SearchBudget({ filePath: path.join(tmpDir, 'budget.json') });
    client = new TavilyClient('test-api-key', tracker, budget);
    mockFetch.mockReset();
  });

  afterEach(() => {
    tracker.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('search() returns parsed results', async () => {
    mockFetch.mockResolvedValueOnce(
      makeTavilyResponse([{ title: 'KC News', url: 'https://kc.example.com', content: 'Local news...', score: 0.9 }])
    );
    const results = await client.search('kansas city news', { label: 'test' });
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('KC News');
    expect(results[0]?.score).toBe(0.9);
  });

  it('search() maps raw_content to rawContent', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ title: 'T', url: 'https://x.com', content: 'c', score: 0.8, raw_content: 'full text' }],
        }),
        { status: 200 }
      )
    );
    const results = await client.search('query');
    expect(results[0]?.rawContent).toBe('full text');
  });

  it('budget check runs before search — fetch not called when budget exhausted', async () => {
    vi.spyOn(budget, 'canSearch').mockReturnValue({
      allowed: false,
      remaining: { daily: 0, monthly: 0 },
    });
    await expect(client.search('query')).rejects.toThrow(BudgetExhaustedError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('BudgetExhaustedError thrown when monthly limit reached', async () => {
    const tinyBudget = new SearchBudget({
      filePath: path.join(tmpDir, 'tiny-budget.json'),
      monthlyLimit: 1,
    });
    tinyBudget.recordSearch(); // exhaust it
    const c = new TavilyClient('key', tracker, tinyBudget);
    await expect(c.search('query')).rejects.toThrow(BudgetExhaustedError);
  });

  it('records telemetry event with budget remaining on success', async () => {
    mockFetch.mockResolvedValueOnce(
      makeTavilyResponse([{ title: 'A', url: 'https://a.com', content: 'text', score: 0.7 }])
    );
    await client.search('query', { label: 'collect-local' });
    const summary = tracker.getSummary();
    expect(summary.totalCalls).toBe(1);
    expect(summary.byProvider['tavily']?.calls).toBe(1);
  });

  it('records telemetry failure event on API error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
    await expect(client.search('query', { label: 'fail-test' })).rejects.toThrow();
    const summary = tracker.getSummary();
    expect(summary.errorRate).toBe(1);
    expect(summary.byLabel['fail-test']?.calls).toBe(1);
  });

  it('sends correct Tavily API request shape', async () => {
    mockFetch.mockResolvedValueOnce(makeTavilyResponse([]));
    await client.search('my query', { searchDepth: 'advanced', maxResults: 10, label: 'shape-test' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/search');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['query']).toBe('my query');
    expect(body['search_depth']).toBe('advanced');
    expect(body['max_results']).toBe(10);
  });
});
