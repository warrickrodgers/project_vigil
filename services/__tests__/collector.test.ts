import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const mockCollect = vi.hoisted(() => vi.fn());
const mockFlush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetState = vi.hoisted(() =>
  vi.fn().mockReturnValue({ monthKey: '2026-05', monthCount: 5, dayKey: '2026-05-06', dayCount: 2 }),
);
const MockSearchBudget = vi.hoisted(() => vi.fn(() => ({ getState: mockGetState })));
const MockCollectorAgent = vi.hoisted(() => vi.fn(() => ({ collect: mockCollect })));
const mockLoadBudgetState = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockSaveBudgetState = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@vigil/db', () => ({
  prisma: { budgetState: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

vi.mock('@vigil/clients', () => ({
  GeminiClient: vi.fn(),
  TavilyClient: vi.fn(),
  SearchBudget: MockSearchBudget,
  ChromaClient: vi.fn(),
  APICallTracker: vi.fn(() => ({ flush: mockFlush })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@vigil/agents', () => ({
  CollectorAgent: MockCollectorAgent,
  makeVigilDB: vi.fn().mockReturnValue({}),
}));

vi.mock('../lib/lambda-emitter.js', () => ({
  createLambdaEmitter: vi.fn().mockReturnValue({}),
}));

vi.mock('../lib/db-budget.js', () => ({
  loadBudgetState: mockLoadBudgetState,
  saveBudgetState: mockSaveBudgetState,
}));

// ---------------------------------------------------------------------------
// Import after mocks are hoisted
// ---------------------------------------------------------------------------

import { handler } from '../collector.js';
import { prisma } from '@vigil/db';
import { createLambdaEmitter } from '../lib/lambda-emitter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResult = (region: string) => ({
  region,
  articlesFound: 3,
  articlesSaved: 2,
  articlesSkipped: 1,
  durationMs: 500,
  errors: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collector Lambda handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollect.mockResolvedValue(makeResult('local'));
  });

  // -------------------------------------------------------------------------
  describe('region routing', () => {
    it('runs all three regions when no region is specified', async () => {
      mockCollect
        .mockResolvedValueOnce(makeResult('local'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      const result = await handler({});

      expect(result.regions).toEqual(['local', 'usa', 'geopolitical']);
      expect(result.results).toHaveLength(3);
      expect(mockCollect).toHaveBeenCalledTimes(3);
    });

    it('runs only the specified region', async () => {
      const result = await handler({ region: 'local' });

      expect(result.regions).toEqual(['local']);
      expect(result.results).toHaveLength(1);
      expect(mockCollect).toHaveBeenCalledTimes(1);
      expect(mockCollect).toHaveBeenCalledWith('local', {});
    });

    it('creates one CollectorAgent and emitter per region', async () => {
      mockCollect
        .mockResolvedValueOnce(makeResult('local'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      await handler({});

      expect(MockCollectorAgent).toHaveBeenCalledTimes(3);
      expect(createLambdaEmitter).toHaveBeenCalledWith('local');
      expect(createLambdaEmitter).toHaveBeenCalledWith('usa');
      expect(createLambdaEmitter).toHaveBeenCalledWith('geopolitical');
    });
  });

  // -------------------------------------------------------------------------
  describe('collect options', () => {
    it('passes review: true when event.review is true', async () => {
      await handler({ region: 'local', review: true });

      expect(mockCollect).toHaveBeenCalledWith('local', { review: true });
    });

    it('passes review: false when event.review is false', async () => {
      await handler({ region: 'local', review: false });

      expect(mockCollect).toHaveBeenCalledWith('local', { review: false });
    });

    it('omits review from options when event.review is undefined', async () => {
      await handler({ region: 'local' });

      expect(mockCollect).toHaveBeenCalledWith('local', {});
    });
  });

  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('captures an error for the failing region and continues', async () => {
      mockCollect
        .mockRejectedValueOnce(new Error('Tavily rate limit'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      const result = await handler({});

      expect(result.results).toHaveLength(3);
      expect(result.results[0]!.errors).toContain('Error: Tavily rate limit');
      expect(result.results[0]!.articlesFound).toBe(0);
      expect(result.results[1]!.errors).toHaveLength(0);
      expect(result.results[2]!.errors).toHaveLength(0);
    });

    it('resolves without throwing when all regions fail', async () => {
      mockCollect.mockRejectedValue(new Error('API down'));

      await expect(handler({})).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('budget state persistence', () => {
    it('passes stored state to SearchBudget when DB has a record', async () => {
      const stored = { monthKey: '2026-05', monthCount: 42, dayKey: '2026-05-06', dayCount: 7 };
      mockLoadBudgetState.mockResolvedValueOnce(stored);

      await handler({ region: 'local' });

      expect(MockSearchBudget).toHaveBeenCalledWith(
        expect.objectContaining({ initialState: stored, disableFilePersistence: true }),
      );
    });

    it('omits initialState when no budget record exists in DB', async () => {
      mockLoadBudgetState.mockResolvedValueOnce(null);

      await handler({ region: 'local' });

      expect(MockSearchBudget).toHaveBeenCalledWith(
        expect.not.objectContaining({ initialState: expect.anything() }),
      );
      expect(MockSearchBudget).toHaveBeenCalledWith(
        expect.objectContaining({ disableFilePersistence: true }),
      );
    });

    it('saves budget state after all regions complete', async () => {
      const state = { monthKey: '2026-05', monthCount: 5, dayKey: '2026-05-06', dayCount: 2 };
      mockGetState.mockReturnValue(state);
      mockCollect
        .mockResolvedValueOnce(makeResult('local'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      await handler({});

      expect(mockSaveBudgetState).toHaveBeenCalledOnce();
      expect(mockSaveBudgetState).toHaveBeenCalledWith(prisma, state);
    });

    it('saves budget state even when a region errors', async () => {
      mockCollect
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      await handler({});

      expect(mockSaveBudgetState).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  describe('telemetry', () => {
    it('flushes the API call tracker after all regions', async () => {
      mockCollect
        .mockResolvedValueOnce(makeResult('local'))
        .mockResolvedValueOnce(makeResult('usa'))
        .mockResolvedValueOnce(makeResult('geopolitical'));

      await handler({});

      expect(mockFlush).toHaveBeenCalledOnce();
    });

    it('flushes the tracker even when regions fail', async () => {
      mockCollect.mockRejectedValue(new Error('boom'));

      await handler({});

      expect(mockFlush).toHaveBeenCalledOnce();
    });
  });
});
