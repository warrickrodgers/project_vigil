import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Hoist mocks so they're available inside vi.mock factory
const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn((_config: unknown) => ({ generateContent: mockGenerateContent }));
  return { mockGenerateContent, mockGetGenerativeModel };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

import { GeminiClient } from '../gemini/client.js';
import { APICallTracker } from '../telemetry/tracker.js';
import { GEMINI_MODELS } from '../gemini/models.js';

function makeSuccessResponse(text: string, inputTokens = 10, outputTokens = 5) {
  return {
    response: {
      text: () => text,
      usageMetadata: {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: inputTokens + outputTokens,
      },
    },
  };
}

function makeHttpError(status: number, message = 'API Error'): Error {
  return Object.assign(new Error(message), { status });
}

describe('GeminiClient', () => {
  let tracker: APICallTracker;
  let client: GeminiClient;

  beforeEach(() => {
    tracker = new APICallTracker({ telemetryDir: '/tmp/vigil-gemini-test' });
    // Zero backoffs so retry tests don't need fake timers
    client = new GeminiClient('test-api-key', tracker, { backoffMs: [0, 0, 0] });
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it('complete() returns text and records telemetry', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeSuccessResponse('hello world'));
    const result = await client.complete('say hello', { tier: 'fast', label: 'test' });
    expect(result).toBe('hello world');
    const summary = tracker.getSummary();
    expect(summary.totalCalls).toBe(1);
    expect(summary.byLabel['test']?.calls).toBe(1);
  });

  it('completeJSON() parses valid JSON and validates schema', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeSuccessResponse(JSON.stringify({ name: 'Alice', age: 30 })));
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = await client.completeJSON('return user', { tier: 'fast', schema, label: 'test-json' });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('completeJSON() retries once on invalid JSON response', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeSuccessResponse('not json at all'))
      .mockResolvedValueOnce(makeSuccessResponse(JSON.stringify({ value: 42 })));
    const schema = z.object({ value: z.number() });
    const result = await client.completeJSON('return value', { tier: 'fast', schema });
    expect(result).toEqual({ value: 42 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('4xx errors (non-429) throw immediately without retry', async () => {
    mockGenerateContent.mockRejectedValue(makeHttpError(400, 'Bad Request'));
    await expect(client.complete('prompt', { tier: 'fast' })).rejects.toThrow('Bad Request');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('retry logic retries up to MAX_RETRIES on 5xx then throws', async () => {
    // backoffMs is [0,0,0] so no fake timers needed
    mockGenerateContent.mockRejectedValue(makeHttpError(503, 'Service Unavailable'));
    await expect(client.complete('prompt', { tier: 'fast' })).rejects.toThrow('Service Unavailable');
    expect(mockGenerateContent).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('capable tier falls back to gemini-2.5-flash on persistent 5xx', async () => {
    const capableGenerate = vi.fn().mockRejectedValue(makeHttpError(503, 'Overloaded'));
    const fallbackGenerate = vi.fn().mockResolvedValue(makeSuccessResponse('fallback text'));

    mockGetGenerativeModel.mockImplementation((config: unknown) => {
      const { model } = config as { model: string };
      return { generateContent: model === GEMINI_MODELS.capable.id ? capableGenerate : fallbackGenerate };
    });

    const result = await client.complete('prompt', { tier: 'capable', label: 'capable-test' });
    expect(result).toBe('fallback text');
    expect(capableGenerate).toHaveBeenCalledTimes(4); // 1 + 3 retries
    expect(fallbackGenerate).toHaveBeenCalledTimes(1);
  });

  it('telemetry records failure event on non-retryable error', async () => {
    mockGenerateContent.mockRejectedValue(makeHttpError(401, 'Unauthorized'));
    await expect(client.complete('prompt', { tier: 'fast', label: 'auth-fail' })).rejects.toThrow();
    const summary = tracker.getSummary();
    expect(summary.errorRate).toBe(1);
  });
});
