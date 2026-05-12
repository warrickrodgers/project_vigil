import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_MODELS } from './models.js';
import type { CompleteOptions, CompleteJSONOptions } from './types.js';
import type { APICallTracker } from '../telemetry/tracker.js';
import { logger } from '../telemetry/logger.js';

const EMBEDDING_MODEL = process.env['GEMINI_EMBEDDING_MODEL'] ?? 'gemini-embedding-2';

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_JSON_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 3000, 9000] as const;
// Capable tier (Gemini Flash) hits 503s under sustained load; minimum 12s between retries
// matches Gemini's observed retry-after header for 429/503 responses.
const CAPABLE_BACKOFF_MS = [4000, 12000, 24000] as const;

// Gemini occasionally wraps JSON in markdown fences despite being told not to.
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHttpStatus(err: unknown): number | undefined {
  if (err !== null && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

function isRetryable(err: unknown): boolean {
  const status = getHttpStatus(err);
  if (status === undefined) return true; // network error, retry
  if (status === 429) return true;
  if (status >= 500) return true;
  return false; // 4xx (except 429) — don't retry
}

function computeCost(modelId: string, inputTokens: number, outputTokens: number): number {
  for (const config of Object.values(GEMINI_MODELS)) {
    if (config.id === modelId) {
      return (
        (inputTokens / 1_000_000) * config.inputPricePer1M +
        (outputTokens / 1_000_000) * config.outputPricePer1M
      );
    }
  }
  return 0;
}

export class GeminiClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly tracker: APICallTracker;
  private readonly backoffMs: readonly number[];

  constructor(apiKey: string, tracker: APICallTracker, options?: { backoffMs?: readonly number[] }) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.tracker = tracker;
    this.backoffMs = options?.backoffMs ?? BACKOFF_MS;
  }

  private getModelId(tier: 'fast' | 'capable'): string {
    const override =
      tier === 'fast'
        ? process.env['GEMINI_FAST_MODEL']
        : process.env['GEMINI_CAPABLE_MODEL'];
    return override ?? (tier === 'fast' ? GEMINI_MODELS.fast.id : GEMINI_MODELS.capable.id);
  }

  private async callModel(
    modelId: string,
    prompt: string,
    systemPrompt: string | undefined,
    temperature: number,
    maxTokens: number
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const modelConfig: Parameters<typeof this.genAI.getGenerativeModel>[0] = { model: modelId };
    if (systemPrompt !== undefined) modelConfig.systemInstruction = systemPrompt;

    const model = this.genAI.getGenerativeModel(modelConfig);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });

    const text = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      text,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  }

  private async callWithRetry(
    modelId: string,
    prompt: string,
    systemPrompt: string | undefined,
    temperature: number,
    maxTokens: number,
    backoffOverride?: readonly number[],
  ): Promise<{ text: string; inputTokens: number; outputTokens: number; retryCount: number }> {
    const backoff = backoffOverride ?? this.backoffMs;
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.callModel(modelId, prompt, systemPrompt, temperature, maxTokens);
        return { ...result, retryCount: attempt };
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        if (attempt < MAX_RETRIES) {
          const delay = backoff[attempt] ?? backoff[backoff.length - 1] ?? 9000;
          logger.warn('Gemini API error, retrying', {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            delayMs: delay,
            status: getHttpStatus(err),
          });
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  async complete(prompt: string, options: CompleteOptions): Promise<string> {
    const primaryModelId = this.getModelId(options.tier);
    const label = options.label ?? 'complete';
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

    const startTime = Date.now();
    let modelId = primaryModelId;
    let usedFallback = false;

    // Use CAPABLE_BACKOFF_MS for capable tier when the default backoff is in use.
    // If a custom backoffMs was injected (e.g. [0,0,0] in tests), honour it for all tiers.
    const usingDefaultBackoff = this.backoffMs === BACKOFF_MS;
    const tierBackoff = options.tier === 'capable' && usingDefaultBackoff ? CAPABLE_BACKOFF_MS : this.backoffMs;
    const tryPrimary = async () =>
      this.callWithRetry(primaryModelId, prompt, options.systemPrompt, temperature, maxTokens, tierBackoff);

    let result: { text: string; inputTokens: number; outputTokens: number; retryCount: number };

    try {
      result = await tryPrimary();
    } catch (err) {
      if (options.tier !== 'capable') {
        this.recordEvent({
          modelId: primaryModelId,
          tier: options.tier,
          label,
          startTime,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          retryCount: MAX_RETRIES,
        });
        throw err;
      }

      // Capable tier: record primary failure, try fallback
      this.recordEvent({
        modelId: primaryModelId,
        tier: 'capable',
        label,
        startTime,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        retryCount: MAX_RETRIES,
      });

      logger.warn('Capable tier exhausted, falling back to gemini-2.5-flash', { label });
      modelId = GEMINI_MODELS.capableFallback.id;
      usedFallback = true;
      result = await this.callWithRetry(modelId, prompt, options.systemPrompt, temperature, maxTokens, tierBackoff);
    }

    this.recordEvent({
      modelId,
      tier: usedFallback ? 'capable' : options.tier,
      label,
      startTime,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      success: true,
      retryCount: result.retryCount,
    });

    return result.text;
  }

  async embed(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async completeJSON<T>(prompt: string, options: CompleteJSONOptions<T>): Promise<T> {
    const temperature = options.temperature ?? DEFAULT_JSON_TEMPERATURE;
    const jsonPrompt = `${prompt}\n\nRespond with ONLY valid JSON matching the required schema. No markdown fences, no explanation.`;
    const label = options.label ?? 'completeJSON';

    const baseOpts = {
      tier: options.tier,
      temperature,
      label,
      ...(options.systemPrompt !== undefined ? { systemPrompt: options.systemPrompt } : {}),
    } satisfies CompleteOptions;

    const raw = await this.complete(jsonPrompt, baseOpts);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      // Retry once with correction prompt
      logger.warn('completeJSON: invalid JSON response, retrying with correction', { label, raw: raw.slice(0, 200) });
      const corrected = await this.complete(
        `Your previous response was not valid JSON. Here was your response:\n${raw}\n\nFix it and return ONLY valid JSON with no extra text.`,
        { ...baseOpts, label: `${label}-correction` }
      );
      parsed = JSON.parse(stripFences(corrected));
    }

    return options.schema.parse(parsed) as T;
  }

  private recordEvent(params: {
    modelId: string;
    tier: 'fast' | 'capable';
    label: string;
    startTime: number;
    inputTokens: number;
    outputTokens: number;
    success: boolean;
    error?: string;
    retryCount: number;
  }): void {
    const latencyMs = Date.now() - params.startTime;
    const estimatedCostUSD = computeCost(params.modelId, params.inputTokens, params.outputTokens);
    const event = {
      provider: 'gemini' as const,
      model: params.modelId,
      tier: params.tier,
      label: params.label,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      estimatedCostUSD,
      latencyMs,
      success: params.success,
      retryCount: params.retryCount,
      timestamp: new Date(),
      ...(params.error !== undefined ? { error: params.error } : {}),
    };
    this.tracker.record(event);
  }
}
