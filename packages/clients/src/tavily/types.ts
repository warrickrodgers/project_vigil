export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  rawContent?: string;
  score: number;
  /** ISO date string from Tavily's published_date metadata field, if present. */
  publishedDate?: string;
}

export interface BudgetStatus {
  todayCount: number;
  monthCount: number;
  dailySoftLimit: number;
  monthlyLimit: number;
  remaining: { daily: number; monthly: number };
}

export interface CanSearchResult {
  allowed: boolean;
  warning?: string;
  remaining: { daily: number; monthly: number };
}
