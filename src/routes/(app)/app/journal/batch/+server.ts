/**
 * POST /app/journal/batch
 *
 * Génère des notes de journée personnalisées pour chaque enfant
 * à partir de l'état DIRECT du tableau (données non encore sauvegardées).
 *
 * Stratégie : un seul appel LLM, prompt minimaliste avec données structurées
 * ligne par ligne, double fallback de parsing (JSON → liste numérotée).
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chatCompletion, isAIEnabled, OllamaError } from '$lib/server/ai/ollama';
import type { MealEntry, NapEntry, MoodLevel } from '$lib/types';

interface BatchChild {
  childId:   string;
  childName: string;
  meals:     MealEntry[];
  nap:       NapEntry | null;
  mood:      MoodLevel;
  health:    string;
  changes:   number;
}

interface BatchNoteRequest {
  children: BatchChild[];
}

// ── Labels ────────────────────────────────────────────────────────────────

const MOOD_FR: Record<MoodLevel, string> = {
  grognon: 'grognon(ne)',
  calme:   'calme',
  joyeux:  'joyeux(se)'
};

const NAP_QUALITY_FR: Record<string, string> = {
  agitee:   'agitée',
  normale:  'normale',
  paisible: 'paisible'
};

const MEAL_TYPE_FR: Record<string, string> = {
  'petit-dejeuner': 'petit-déjeuner',
  'dejeuner':       'déjeuner',
  'gouter':         'goûter',
  'diner':          'dîner'
};

const MEAL_QTY_FR: Record<string, string> = {
  'non-mange': "n'a pas mangé",
  'peu':       'a peu mangé',
  'bien':      'a bien mangé',
  'tres-bien': 'a très bien mangé'
};

// ── Formatage d'un enfant ─────────────────────────────────────────────────

function formatChild(c: BatchChild, n: number): string {
  const lines: string[] = [`${n}. ${c.childName}`];

  lines.push(`   humeur: ${MOOD_FR[c.mood] ?? c.mood}`);

  if (c.nap) {
    lines.push(`   sieste: ${NAP_QUALITY_FR[c.nap.quality] ?? c.nap.quality} (${c.nap.startTime}–${c.nap.endTime})`);
  } else {
    lines.push(`   sieste: non`);
  }

  if (c.meals.length > 0) {
    for (const m of c.meals) {
      const type = MEAL_TYPE_FR[m.type] ?? m.type;
      const qty  = MEAL_QTY_FR[m.quantity] ?? m.quantity;
      const desc = m.description ? ` (${m.description})` : '';
      lines.push(`   ${type}: ${qty}${desc}`);
    }
  } else {
    lines.push(`   repas: non renseignés`);
  }

  if (c.health)    lines.push(`   santé: ${c.health}`);
  if (c.changes > 0) lines.push(`   changes: ${c.changes}`);

  return lines.join('\n');
}

function buildPrompt(children: BatchChild[]): string {
  const list = children.map((c, i) => formatChild(c, i + 1)).join('\n\n');

  // Example output shape — helps smaller models stay on format
  const exampleJson = children.slice(0, 2)
    .map((_, i) => `"${i + 1}":"note ici"`)
    .join(', ');

  return `Données observées aujourd'hui — s'appuyer UNIQUEMENT sur ces faits, ne rien inventer :

${list}

Génère une note de journée courte (2 phrases max) pour chaque enfant, à la 3ème personne (il/elle).
Règles : ton factuel et bienveillant, comme un compte-rendu destiné aux parents. Ne jamais s'adresser à l'enfant.
IMPORTANT : si une note santé est présente, elle DOIT apparaître dans la note.

JSON (clés = numéros, AUCUN autre texte) :
{${exampleJson}}`;
}

/** Recursively extracts all sentence-like strings from an arbitrary JSON object */
function extractLeafStrings(v: unknown): string[] {
  if (typeof v === 'string' && v.trim().length > 10 && v.includes(' ')) return [v.trim()];
  if (Array.isArray(v)) return v.flatMap(extractLeafStrings);
  if (typeof v === 'object' && v !== null)
    return Object.values(v as Record<string, unknown>).flatMap(extractLeafStrings);
  return [];
}

function parseResponse(raw: string, children: BatchChild[]): Record<string, string> {
  const result: Record<string, string> = {};

  // Strip markdown code fences
  const clean = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Strategy 1: JSON from first { to last } (more robust than non-greedy regex)
  const jStart = clean.indexOf('{');
  const jEnd   = clean.lastIndexOf('}');
  if (jStart !== -1 && jEnd > jStart) {
    try {
      const parsed = JSON.parse(clean.slice(jStart, jEnd + 1)) as Record<string, unknown>;
      for (const [key, val] of Object.entries(parsed)) {
        const idx = parseInt(key, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < children.length
            && typeof val === 'string' && val.trim().length > 3) {
          result[children[idx].childId] = val.trim();
        }
      }
      if (Object.keys(result).length > 0) return result;
    } catch { /* fallback */ }
  }

  // Strategy 2: numbered lines — "1. text" / "1: text" / "1) text"
  for (const line of clean.split('\n')) {
    const m = line.match(/^(\d+)[.):\s]+(.{6,})/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < children.length) {
        const note = m[2].replace(/^["']|["']$/g, '').trim();
        if (note) result[children[idx].childId] = note;
      }
    }
  }
  if (Object.keys(result).length > 0) return result;

  // Strategy 3: single child — extract sentences from any JSON structure
  if (children.length === 1) {
    const jS = clean.indexOf('{');
    const jE = clean.lastIndexOf('}');
    if (jS !== -1 && jE > jS) {
      try {
        const obj = JSON.parse(clean.slice(jS, jE + 1)) as unknown;
        const phrases = extractLeafStrings(obj);
        if (phrases.length > 0) {
          result[children[0].childId] = phrases.join(' ');
          return result;
        }
      } catch { /* continue */ }
    }
    // Last resort: strip numeric JSON wrapper and use raw text
    let note = clean;
    note = note.replace(/^\s*\{?\s*"?\d+"?\s*:\s*"?/, '');
    note = note.replace(/"?\s*\}?\s*$/, '');
    note = note.replace(/^["'`]|["'`]$/g, '').trim();
    if (note.length > 3) result[children[0].childId] = note;
  }

  return result;
}

// ── Handler ───────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Non authentifié');
  if (locals.user.role !== 'assistante') throw error(403, 'Accès réservé aux assistantes');

  if (!isAIEnabled()) {
    return json({ success: false, error: "L'assistant IA est désactivé (AI_PROVIDER=off)." }, { status: 503 });
  }

  let body: BatchNoteRequest;
  try { body = await request.json(); }
  catch { throw error(400, 'Corps de requête invalide'); }

  if (!Array.isArray(body?.children) || body.children.length === 0) {
    throw error(400, 'Aucun enfant fourni');
  }

  const children = body.children.slice(0, 30);
  const prompt   = buildPrompt(children);

  try {
    const raw = await chatCompletion(
      [
        {
          role:    'system',
          content: 'Tu génères des notes de journée pour une application de suivi petite enfance. Tu réponds UNIQUEMENT en JSON valide sans aucun texte autour. Les clés sont des entiers entre guillemets ("1", "2"…). Tu écris à la 3ème personne (il/elle), jamais à la 2ème personne. Tu ne dois jamais inventer de faits absents des données fournies. Si une note santé est présente, elle est prioritaire et doit apparaître dans ta réponse.'
        },
        { role: 'user', content: prompt }
      ],
      { timeout: 90000 }
    );

    const notes = parseResponse(raw, children);

    if (Object.keys(notes).length === 0) {
      if (process.env.NODE_ENV === 'development') console.error('[BatchNotes] Réponse non exploitable:', raw.substring(0, 300));
      return json({
        success: false,
        error:   "L'IA n'a pas pu générer les notes. Vérifiez que le modèle est chargé dans Ollama et réessayez."
      });
    }

    const missing = children.length - Object.keys(notes).length;
    return json({
      success: true,
      notes,
      ...(missing > 0 ? { warning: `${missing} note(s) manquante(s)` } : {})
    });

  } catch (err) {
    if (err instanceof OllamaError) {
      return json({ success: false, error: err.message }, { status: 503 });
    }
    if (process.env.NODE_ENV === 'development') console.error('[BatchNotes] Erreur inattendue:', err);
    return json({ success: false, error: 'Erreur inattendue.' }, { status: 500 });
  }
};
