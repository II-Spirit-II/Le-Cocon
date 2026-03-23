import type { DrizzleDB } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { children } from '$lib/server/db/schema';
import type { AIQueryInput, AIQueryResult, AIResponse } from './types';
import { detectIntent, intentLabels } from './intent';
import { retrieveSources, verifyChildAccess } from './retrieval';
import { SYSTEM_PROMPT, buildUserPrompt, parseAIResponse, generateNoSourcesResponse } from './prompt';
import { chatCompletion, isAIEnabled, OllamaError } from './ollama';

export async function executeAIPipeline(
  db: DrizzleDB,
  input: AIQueryInput
): Promise<AIQueryResult> {
  const { childId, question, timeframeDays = 90 } = input;

  if (!isAIEnabled()) {
    return { success: false, error: "L'assistant IA est actuellement désactivé." };
  }

  const hasAccess = await verifyChildAccess(db, childId);
  if (!hasAccess) {
    return { success: false, error: "Vous n'avez pas accès aux données de cet enfant." };
  }

  let childName = "l'enfant";
  try {
    const [childRecord] = await db.select({
      firstName: children.firstName,
      lastName: children.lastName,
    }).from(children).where(eq(children.id, childId)).limit(1);
    if (childRecord) {
      childName = `${childRecord.firstName} ${childRecord.lastName}`;
    }
  } catch {
    // fallback to generic name
  }

  const intent = detectIntent(question);
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) console.log(`[AI Pipeline] Intent: ${intent} (${intentLabels[intent]})`);

  const sources = await retrieveSources(db, childId, intent, timeframeDays);
  if (isDev) console.log(`[AI Pipeline] Sources:`, {
    dailyLogs: sources.dailyLogs.length,
    news: sources.news.length,
    parentNotes: sources.parentNotes.length
  });

  const hasAnySources =
    sources.dailyLogs.length > 0 ||
    sources.news.length > 0 ||
    sources.parentNotes.length > 0;

  if (!hasAnySources) {
    return { success: true, response: generateNoSourcesResponse(intent), intent };
  }

  const userPrompt = buildUserPrompt(question, sources, intent, childName);

  try {
    const rawResponse = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]);

    const parsed = parseAIResponse(rawResponse);

    if (!parsed) {
      return {
        success: true,
        response: { answer: rawResponse.substring(0, 500), highlights: [], usedSources: [] },
        intent
      };
    }

    const enrichedSources = enrichSourcesFromRetrieved(parsed.usedSources, sources);
    const response: AIResponse = {
      answer: parsed.answer,
      highlights: parsed.highlights,
      usedSources: enrichedSources
    };

    return { success: true, response, intent };
  } catch (error) {
    if (error instanceof OllamaError) {
      return { success: false, error: error.message, intent };
    }
    if (isDev) console.error('[AI Pipeline] Unexpected error:', error);
    return { success: false, error: "Une erreur inattendue s'est produite.", intent };
  }
}

// Maps LLM-cited source dates back to real DB record IDs
function enrichSourcesFromRetrieved(
  llmSources: AIResponse['usedSources'],
  retrieved: RetrievedSources
): AIResponse['usedSources'] {
  const enriched: AIResponse['usedSources'] = [];

  const dailyLogsByDate = new Map(retrieved.dailyLogs.map((dl) => [dl.date, dl]));
  const newsByDate = new Map(retrieved.news.map((n) => [n.createdAt.split('T')[0], n]));
  const notesByDate = new Map(retrieved.parentNotes.map((pn) => [pn.startDate || pn.createdAt.split('T')[0], pn]));

  for (const src of llmSources) {
    const enrichedSrc = { ...src };
    if (src.type === 'daily_log') {
      const match = dailyLogsByDate.get(src.date);
      if (match) enrichedSrc.id = match.id;
    } else if (src.type === 'news') {
      const match = newsByDate.get(src.date);
      if (match) enrichedSrc.id = match.id;
    } else if (src.type === 'parent_note') {
      const match = notesByDate.get(src.date);
      if (match) enrichedSrc.id = match.id;
    }
    enriched.push(enrichedSrc);
  }

  // Fallback: populate with recent records if LLM cited nothing
  if (enriched.length === 0) {
    for (const dl of retrieved.dailyLogs.slice(0, 3)) {
      enriched.push({ type: 'daily_log', id: dl.id, date: dl.date, label: 'Journal quotidien' });
    }
    for (const n of retrieved.news.slice(0, 3)) {
      enriched.push({ type: 'news', id: n.id, date: n.createdAt.split('T')[0], label: n.content.substring(0, 50) + (n.content.length > 50 ? '...' : '') });
    }
    for (const pn of retrieved.parentNotes.slice(0, 3)) {
      enriched.push({ type: 'parent_note', id: pn.id, date: pn.startDate || pn.createdAt.split('T')[0], label: `${pn.kind}: ${pn.content.substring(0, 30)}...` });
    }
  }

  return enriched.slice(0, 10);
}

type RetrievedSources = Awaited<ReturnType<typeof retrieveSources>>;
