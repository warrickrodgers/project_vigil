export interface APICallEvent {
  provider: 'gemini' | 'tavily';
  model: string;
  tier: 'fast' | 'capable' | 'search';
  label: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  retryCount: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
