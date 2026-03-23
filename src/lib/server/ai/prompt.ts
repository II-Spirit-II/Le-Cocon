import type {
  AIIntent,
  RetrievedSources,
  AISourceItem,
  RawDailyLogSource,
  RawNewsSource,
  RawParentNoteSource,
  MenuRef
} from './types';
import type { MealEntry, NapEntry, HealthEntry } from '$lib/types';

export const SYSTEM_PROMPT = `Tu es l'assistant IA de Le Cocon, une application pour assistantes maternelles et parents.

REGLES STRICTES:
1. Reponds UNIQUEMENT en te basant sur les SOURCES fournies ci-dessous.
2. Si tu n'as pas d'information pertinente dans les sources, dis-le clairement: "Je ne trouve pas d'information a ce sujet dans les donnees disponibles."
3. Ne fais JAMAIS de conseil medical. Si la question concerne la sante, precise que tu ne peux que rapporter les informations enregistrees et conseille de consulter un professionnel.
4. Sois concis, chaleureux et factuel.
5. Cite les dates des sources quand c'est pertinent.
6. Reponds en francais.
7. N'utilise JAMAIS de markdown, d'asterisques, de diezes, de guillemets doubles ou de formatage special dans la valeur "answer".

FORMAT DE REPONSE OBLIGATOIRE:
- Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres.
- N'utilise PAS de retours a la ligne dans les valeurs de texte.
- N'utilise PAS de guillemets non echappes dans les textes.
- N'utilise PAS de code fences ou markdown.
- Exemple format:
{"answer":"Ta reponse ici sans retour a la ligne","highlights":["point 1","point 2"],"used_sources":[{"type":"daily_log","id":"","date":"2025-01-15","label":"journal"}]}

Ne reponds RIEN d'autre que ce JSON sur une seule ligne.`;

// Falls back to global menu when individual meal entries are empty
function formatMeals(meals: unknown, menuRef?: MenuRef | null): string {
  const hasIndividualMeals = Array.isArray(meals) && (meals as MealEntry[]).length > 0;
  let result = '';

  if (hasIndividualMeals) {
    const mealEntries = meals as MealEntry[];
    result = mealEntries
      .map((m) => `${m.type}: ${m.description || '(menu du jour)'} (${m.quantity})`)
      .join(', ');
  }

  if (menuRef && menuRef.description) {
    const menuLine = `Menu global (${menuRef.mealType}): ${menuRef.description}`;
    result = result ? `${result} | ${menuLine}` : menuLine;
  }

  return result || 'Pas de repas enregistre';
}

function formatNap(nap: unknown): string {
  if (!nap || typeof nap !== 'object') return 'Pas de sieste enregistree';
  const napEntry = nap as NapEntry;
  if (!napEntry.startTime) return 'Pas de sieste enregistree';
  const duration = napEntry.endTime && napEntry.startTime
    ? `de ${napEntry.startTime} a ${napEntry.endTime}`
    : `a partir de ${napEntry.startTime}`;
  return `Sieste ${duration} (${napEntry.quality || 'normale'})`;
}

function formatHealth(health: unknown): string | null {
  if (!health || typeof health !== 'object') return null;
  const h = health as HealthEntry;
  const parts: string[] = [];
  if (h.temperature) parts.push(`Temperature: ${h.temperature}C`);
  if (h.symptoms) parts.push(`Symptomes: ${h.symptoms}`);
  if (h.medication) parts.push(`Medicament: ${h.medication}`);
  if (h.notes) parts.push(`Notes: ${h.notes}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

// Only includes fields relevant to the detected intent to keep context concise
function formatDailyLogs(logs: RawDailyLogSource[], intent: AIIntent): string {
  if (logs.length === 0) return '';
  const lines: string[] = ['=== JOURNAUX QUOTIDIENS ==='];

  for (const log of logs) {
    lines.push(`\n[${log.date}]`);

    if (intent === 'meals_recent' || intent === 'recap_week' || intent === 'fallback_unknown') {
      lines.push(`Repas: ${formatMeals(log.meals, log.menuRef)}`);
    }
    if (intent === 'nap_recent' || intent === 'recap_week' || intent === 'fallback_unknown') {
      lines.push(`Sieste: ${formatNap(log.nap)}`);
    }
    if (intent === 'recap_week' || intent === 'fallback_unknown') {
      lines.push(`Humeur: ${log.mood}`);
      if (log.changes > 0) lines.push(`Changes: ${log.changes}`);
    }
    if (intent === 'health_last' || intent === 'recap_week' || intent === 'fallback_unknown') {
      const healthStr = formatHealth(log.health);
      if (healthStr) lines.push(`Sante: ${healthStr}`);
    }
    if (log.notes && log.notes.trim()) lines.push(`Notes: ${log.notes}`);
  }

  return lines.join('\n');
}

function formatNews(news: RawNewsSource[]): string {
  if (news.length === 0) return '';
  const lines: string[] = ['=== NEWS ==='];
  for (const n of news) {
    const date = n.createdAt.split('T')[0];
    const emoji = n.emoji ? `${n.emoji} ` : '';
    lines.push(`\n[${date}] ${emoji}${n.content}`);
  }
  return lines.join('\n');
}

function formatParentNotes(notes: RawParentNoteSource[]): string {
  if (notes.length === 0) return '';
  const lines: string[] = ['=== NOTES DES PARENTS ==='];
  for (const note of notes) {
    const dateInfo = note.startDate
      ? note.endDate && note.endDate !== note.startDate
        ? `du ${note.startDate} au ${note.endDate}`
        : `le ${note.startDate}`
      : `(${note.createdAt.split('T')[0]})`;
    lines.push(`\n[${note.kind.toUpperCase()}] ${dateInfo}`);
    lines.push(note.content);
  }
  return lines.join('\n');
}

export function buildUserPrompt(
  question: string,
  sources: RetrievedSources,
  intent: AIIntent,
  childName: string
): string {
  const parts: string[] = [];
  parts.push(`Question concernant l'enfant: ${childName}`);
  parts.push('');

  const dailyLogsStr = formatDailyLogs(sources.dailyLogs, intent);
  const newsStr = formatNews(sources.news);
  const notesStr = formatParentNotes(sources.parentNotes);

  if (dailyLogsStr) parts.push(dailyLogsStr);
  if (newsStr) parts.push(newsStr);
  if (notesStr) parts.push(notesStr);

  if (!dailyLogsStr && !newsStr && !notesStr) {
    parts.push('=== SOURCES ===');
    parts.push('Aucune donnee disponible pour cette question.');
  }

  parts.push('');
  parts.push('=== QUESTION ===');
  parts.push(question);

  return parts.join('\n');
}

// Strips control characters that are invalid inside JSON strings
function sanitizeJsonString(str: string): string {
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

// Extracts the outermost JSON object, handling markdown code fences
function extractJsonBlock(str: string): string | null {
  const cleaned = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const startIndex = cleaned.indexOf('{');
  if (startIndex === -1) return null;

  let depth = 0, endIndex = -1, inString = false, escapeNext = false;
  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') { depth--; if (depth === 0) { endIndex = i; break; } }
    }
  }

  if (endIndex === -1) return null;
  return cleaned.substring(startIndex, endIndex + 1);
}

function attemptJsonRepair(str: string): string {
  return str.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ');
}

// Three-strategy parser: direct → repair → regex extraction
export function parseAIResponse(rawResponse: string): {
  answer: string;
  highlights: string[];
  usedSources: AISourceItem[];
} | null {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const jsonBlock = extractJsonBlock(sanitizeJsonString(rawResponse));
    if (jsonBlock) {
      const parsed = JSON.parse(jsonBlock);
      if (typeof parsed.answer === 'string') {
        if (isDev) console.log('[AI Prompt] Parsed with strategy 1 (direct)');
        return normalizeResponse(parsed);
      }
    }
  } catch { /* try next */ }

  try {
    const jsonBlock = extractJsonBlock(sanitizeJsonString(rawResponse));
    if (jsonBlock) {
      const parsed = JSON.parse(attemptJsonRepair(jsonBlock));
      if (typeof parsed.answer === 'string') {
        if (isDev) console.log('[AI Prompt] Parsed with strategy 2 (repaired)');
        return normalizeResponse(parsed);
      }
    }
  } catch { /* try next */ }

  try {
    const answerMatch = rawResponse.match(/"answer"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);
    if (answerMatch) {
      const answer = answerMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
      const highlights: string[] = [];
      const highlightsMatch = rawResponse.match(/"highlights"\s*:\s*\[(.*?)\]/);
      if (highlightsMatch) {
        const items = highlightsMatch[1].match(/"([^"]+)"/g);
        if (items) highlights.push(...items.map(s => s.replace(/"/g, '')).slice(0, 3));
      }
      if (isDev) console.log('[AI Prompt] Parsed with strategy 3 (regex)');
      return { answer, highlights, usedSources: [] };
    }
  } catch { /* all failed */ }

  if (isDev) console.error('[AI Prompt] All parsing strategies failed:', rawResponse.substring(0, 300));
  return null;
}

function normalizeResponse(parsed: Record<string, unknown>): {
  answer: string;
  highlights: string[];
  usedSources: AISourceItem[];
} {
  const answer = String(parsed.answer || '');
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.filter((h: unknown) => typeof h === 'string').slice(0, 3)
    : [];

  const usedSources: AISourceItem[] = [];
  if (Array.isArray(parsed.used_sources)) {
    for (const src of parsed.used_sources.slice(0, 10)) {
      if (src && typeof src === 'object' && 'type' in src && 'date' in src) {
        const s = src as Record<string, unknown>;
        usedSources.push({
          type: String(s.type) as AISourceItem['type'],
          id: String(s.id || ''),
          date: String(s.date),
          label: String(s.label || '')
        });
      }
    }
  }

  return { answer, highlights, usedSources };
}

export function generateNoSourcesResponse(intent: AIIntent): {
  answer: string;
  highlights: string[];
  usedSources: AISourceItem[];
} {
  const messages: Record<AIIntent, string> = {
    meals_recent: 'Je ne trouve pas d\'informations sur les repas recents. Aucun journal n\'a ete enregistre recemment.',
    nap_recent: 'Je ne trouve pas d\'informations sur les siestes recentes. Aucun journal n\'a ete enregistre recemment.',
    health_last: 'Je ne trouve pas d\'informations de sante dans les donnees disponibles. Si vous avez des inquietudes, n\'hesitez pas a consulter un professionnel.',
    absences: 'Je ne trouve pas d\'absences ou retards enregistres pour cette periode.',
    recap_week: 'Je ne dispose pas de donnees suffisantes pour faire un resume de la semaine.',
    news_recent: 'Aucune news n\'a ete publiee recemment.',
    fallback_unknown: 'Je n\'ai pas trouve d\'informations pertinentes pour repondre a cette question.'
  };
  return { answer: messages[intent], highlights: [], usedSources: [] };
}
