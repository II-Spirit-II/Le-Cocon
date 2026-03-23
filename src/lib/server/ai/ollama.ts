// Scaleway Generative API client — native fetch, no SDK dependency.
// File name kept as-is to avoid breaking existing imports.

import { env } from '$env/dynamic/private';

function getScalewayBaseUrl(): string {
  const projectId = env.SCALEWAY_PROJECT_ID || '';
  return `https://api.scaleway.ai/${projectId}/v1`;
}
const DEFAULT_MODEL     = 'mistral-small-3.2-24b-instruct-2506';

function getConfig() {
  return {
    apiKey:   env.SCALEWAY_API_KEY || '',
    baseURL:  env.AI_BASE_URL      || getScalewayBaseUrl(),
    model:    env.AI_MODEL         || DEFAULT_MODEL,
    provider: env.AI_PROVIDER      || 'scaleway',
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Kept for compatibility with existing imports. */
export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNREACHABLE' | 'TIMEOUT' | 'PARSE_ERROR' | 'MODEL_ERROR' | 'DISABLED'
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export function isAIEnabled(): boolean {
  const { provider, apiKey } = getConfig();
  return provider !== 'off' && Boolean(apiKey);
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { timeout?: number; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const config = getConfig();

  if (config.provider === 'off') throw new OllamaError("L'assistant IA est désactivé.", 'DISABLED');
  if (!config.apiKey) throw new OllamaError('Clé API manquante (SCALEWAY_API_KEY).', 'DISABLED');

  const timeout = options.timeout ?? 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model:            config.model,
        messages,
        max_tokens:       options.maxTokens ?? 500,
        temperature:      options.temperature ?? 0.15,
        top_p:            1,
        presence_penalty: 0,
        stream:           false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 408 || res.status === 504) {
        throw new OllamaError("Timeout : l'IA met trop de temps à répondre.", 'TIMEOUT');
      }
      throw new OllamaError(`Erreur API (${res.status}) : ${body.slice(0, 200)}`, 'MODEL_ERROR');
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new OllamaError('Réponse vide du modèle.', 'PARSE_ERROR');
    return content;
  } catch (err) {
    if (err instanceof OllamaError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OllamaError("Timeout : l'IA met trop de temps à répondre.", 'TIMEOUT');
    }

    if (process.env.NODE_ENV === 'development') console.error('[AI] Unexpected error:', err);
    throw new OllamaError("Erreur inattendue lors de l'appel à l'IA.", 'MODEL_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

export async function healthCheck(): Promise<boolean> {
  if (!isAIEnabled()) return false;
  try {
    await chatCompletion(
      [{ role: 'user', content: 'ok' }],
      { maxTokens: 5, timeout: 8_000 }
    );
    return true;
  } catch {
    return false;
  }
}
