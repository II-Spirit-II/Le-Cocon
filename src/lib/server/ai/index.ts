/**
 * AI Module - Barrel Export
 *
 * Assistant IA SQL-first pour Le Cocon.
 */

// Types
export type {
  AIIntent,
  AISourceItem,
  AIResponse,
  AIQueryInput,
  AIQueryResult
} from './types';

// Intent detection
export { detectIntent, intentLabels } from './intent';

// Pipeline principal
export { executeAIPipeline } from './pipeline';

// Client IA (Scaleway)
export { isAIEnabled, healthCheck, OllamaError } from './ollama';

// Retrieval (pour usage direct si besoin)
export { verifyChildAccess } from './retrieval';
