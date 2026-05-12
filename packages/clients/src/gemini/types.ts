import type { z } from 'zod';
import type { ModelTier } from './models.js';

export interface CompleteOptions {
  tier: ModelTier;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  label?: string;
}

export interface CompleteJSONOptions<T> {
  tier: ModelTier;
  systemPrompt?: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxTokens?: number;
  label?: string;
}
