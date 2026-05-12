export const GEMINI_MODELS = {
  fast: {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    inputPricePer1M: 0.0, // TODO: update when GA pricing published
    outputPricePer1M: 0.0, // TODO: update when GA pricing published
    rpdLimit: 500,
    contextWindow: 1048576,
  },
  capable: {
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    inputPricePer1M: 0.0, // TODO: update when GA pricing published
    outputPricePer1M: 0.0, // TODO: update when GA pricing published
    rpdLimit: 500,
    contextWindow: 1048576,
  },
  capableFallback: {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    rpdLimit: 500,
    contextWindow: 1048576,
  },
} as const;

export type ModelTier = 'fast' | 'capable';
