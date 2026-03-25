// Intent-based SQL retrieval + LLM generation (no vector RAG)

export type AIIntent =
  | 'meals_recent'
  | 'nap_recent'
  | 'health_last'
  | 'absences'
  | 'recap_week'
  | 'news_recent'
  | 'fallback_unknown';

export interface AISourceItem {
  type: 'daily_log' | 'news' | 'parent_note';
  id: string;
  date: string;
  label: string;
  excerpt?: string;
}

export interface AIResponse {
  answer: string;
  highlights: string[];
  usedSources: AISourceItem[];
}

export interface AIQueryInput {
  childId: string;
  question: string;
  timeframeDays?: number;
  /** Pre-classified query type from unified classifier — skips regex intent detection */
  queryType?: 'meals_recent' | 'nap_recent' | 'health_last' | 'absences' | 'recap_week' | 'news_recent' | 'general';
}

export interface AIQueryResult {
  success: boolean;
  response?: AIResponse;
  intent?: AIIntent;
  error?: string;
}

export interface MenuRef {
  mealType: string;
  description: string;
}

export interface RawDailyLogSource {
  id: string;
  date: string;
  meals: unknown;
  nap: unknown;
  mood: string;
  health: unknown;
  changes: number;
  notes: string;
  menuRef?: MenuRef | null;
}

export interface RawNewsSource {
  id: string;
  createdAt: string;
  content: string;
  emoji: string | null;
}

export interface RawParentNoteSource {
  id: string;
  kind: string;
  content: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface RetrievedSources {
  dailyLogs: RawDailyLogSource[];
  news: RawNewsSource[];
  parentNotes: RawParentNoteSource[];
}
