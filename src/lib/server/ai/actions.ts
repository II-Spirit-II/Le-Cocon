import type { DrizzleDB } from '$lib/server/db';
import type { MealEntry, NapEntry, MoodLevel, HealthEntry, MealLevel, MealType } from '$lib/types';
import { createNews } from '$lib/domain/news';
import { createDailyLog, getDailyLogByDate, updateDailyLog } from '$lib/domain/daily_logs';
import { chatCompletion } from './ollama';

// ── Types ──────────────────────────────────────────────────────────────────

export type ActionType = 'create_journal' | 'create_news';

export type UnifiedIntent = 'action' | 'query' | 'chat';

export type QueryType =
  | 'meals_recent'
  | 'nap_recent'
  | 'health_last'
  | 'absences'
  | 'recap_week'
  | 'news_recent'
  | 'general';

export interface ClassificationResult {
  intent: UnifiedIntent;
  action?: ActionType;
  queryType?: QueryType;
  childName?: string;
  confidence: number;
  reasoning: string;
}

export interface ActionResult {
  type: ActionType;
  success: boolean;
  message: string;
  resourcePath?: string;
  resourceLabel?: string;
}

export type NapQuality = NapEntry['quality'] | 'none';

export interface JournalMealEntry {
  type: MealType;
  description: string;
  level: MealLevel | null;
}

export interface JournalFormData {
  childId: string;
  childName: string;
  mood: MoodLevel;
  napQuality: NapQuality;
  meals: JournalMealEntry[];
  changes: number;
  hasHealth: boolean;
  healthNote: string;
  menuId?: string | null;
}

interface ExtractedJournal {
  mood?: MoodLevel;
  meals?: string;
  mealQuantity?: string;
  nap?: string;
  notes?: string;
}

interface ExtractedNews {
  content?: string;
  emoji?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'");
}

// ── Unified intent classification ───────────────────────────────────────────

const UNIFIED_CLASSIFICATION_PROMPT = `Tu es le classifieur d'intentions de Le Cocon, une application de crèche/assistante maternelle.
Tu dois analyser le message de l'utilisatrice et déterminer PRÉCISÉMENT ce qu'elle veut faire.

Il y a 3 types d'intention :

1. "action" — L'utilisatrice veut EFFECTUER une action concrète dans l'application :
   - create_journal : ÉCRIRE/CRÉER/REMPLIR le carnet de journée d'un enfant
   - create_news : PUBLIER une actualité/news/annonce pour les parents

2. "query" — L'utilisatrice POSE UNE QUESTION ou DEMANDE DES INFORMATIONS :
   - meals_recent : questions sur les repas ("qu'a mangé...", "il mange bien ?")
   - nap_recent : questions sur le sommeil/siestes ("il dort bien ?", "ses siestes ?")
   - health_last : questions sur la santé ("il a été malade ?", "sa température ?")
   - absences : questions sur les absences ("il était là ?", "absent quand ?")
   - recap_week : demande de bilan/résumé ("résumé de la semaine", "comment ça s'est passé ?")
   - news_recent : consulter les news existantes ("quelles news ?", "quoi de neuf ?")
   - general : toute autre question factuelle

3. "chat" — Conversation simple sans action ni question sur les données (salutations, remerciements, questions générales)

=== EXEMPLES (TRÈS IMPORTANT) ===

Message: "Il a bien mangé ce midi"
→ AMBIGUÏTÉ ! C'est une INFORMATION RAPPORTÉE, pas une question.
   Si l'utilisatrice est sur la page Carnet ou Fiche enfant → action create_journal (elle veut enregistrer)
   Sinon → query meals_recent (elle décrit sans demander d'action explicite)

Message: "Est-ce qu'il mange bien en ce moment ?"
→ query meals_recent (question, pas d'action)

Message: "Crée le carnet de Lucas"
→ action create_journal (demande explicite)

Message: "Fais le CR de la journée"
→ action create_journal (CR = compte-rendu = carnet)

Message: "Résume-moi la semaine de Léo"
→ query recap_week (demande d'info, PAS une création de carnet)

Message: "Publie une news : sortie au parc"
→ action create_news

Message: "Qu'est-ce qui a été publié récemment ?"
→ query news_recent (question sur les news existantes)

Message: "Merci beaucoup"
→ chat

Message: "Il a dormi 2h"
→ action create_journal (information de journée à enregistrer)

Message: "Il dort bien en général ?"
→ query nap_recent (question)

Message: "fais-le" (après un contexte de conversation)
→ Regarde l'historique et la page pour déterminer l'action

Message: "oui" / "ok" / "vas-y"
→ Regarde l'historique pour comprendre ce qui est confirmé

=== RÈGLES ===
- POSER UNE QUESTION = query (même si ça contient "mange", "dort", etc.)
- RAPPORTER UN FAIT DE LA JOURNÉE = action create_journal (l'utilisatrice veut enregistrer)
- DEMANDER UN RÉSUMÉ/BILAN = query recap_week (ce n'est PAS une création de carnet)
- En cas de doute entre action et query → query (on pourra toujours proposer l'action ensuite)
- Le contexte de la page aide à désambiguïser les messages courts ("fais-le", "oui")
- Donne un score de confiance entre 0 et 1 (0.5 = ambiguë, 0.9+ = certain)
- Si un prénom d'enfant est mentionné, extrais-le dans child_name
- Abréviations courantes : "CR" = carnet, "actu" = news, "jurnal" = carnet

Réponds UNIQUEMENT avec un JSON valide sur une seule ligne :
{"intent":"action|query|chat","action":"create_journal|create_news","query_type":"...","child_name":"...","confidence":0.9,"reasoning":"explication courte"}

Les champs action et query_type ne doivent être présents que si intent=action ou intent=query respectivement.
child_name est optionnel, uniquement si un prénom est mentionné.`;

function contextPathToLabel(contextPath: string): string {
  if (/\/app\/children\/[0-9a-f-]{36}/.test(contextPath)) return 'Fiche enfant';
  if (contextPath.startsWith('/app/journal'))  return 'Carnet';
  if (contextPath.startsWith('/app/feed'))     return 'News';
  if (contextPath.startsWith('/app/overview')) return "Vue d'ensemble";
  if (contextPath.startsWith('/app/stats')) return 'Statistiques';
  if (contextPath.startsWith('/app/menus'))    return 'Menus';
  if (contextPath.startsWith('/app/notes'))    return 'Notes parents';
  if (contextPath.startsWith('/app/children')) return 'Enfants';
  return 'Accueil';
}

export async function classifyUnified(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  contextPath?: string,
): Promise<ClassificationResult> {
  const pageLabel = contextPath ? contextPathToLabel(contextPath) : null;
  const contextLine = pageLabel ? `\nPage courante : ${pageLabel}` : '';

  // Build messages with conversation context for disambiguation
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: UNIFIED_CLASSIFICATION_PROMPT },
  ];

  // Include last 4 exchanges for context (helps with "fais-le", "oui", etc.)
  const recentHistory = conversationHistory.slice(-8);
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map(m => `${m.role === 'user' ? 'Utilisatrice' : 'Assistant'}: ${m.content}`).join('\n');
    messages.push({ role: 'user', content: `=== HISTORIQUE RÉCENT ===\n${historyText}\n\n=== NOUVEAU MESSAGE ===\n${message}${contextLine}` });
  } else {
    messages.push({ role: 'user', content: `${message}${contextLine}` });
  }

  const fallback: ClassificationResult = { intent: 'chat', confidence: 0.3, reasoning: 'fallback' };

  try {
    const raw = await chatCompletion(messages, { temperature: 0, maxTokens: 150, timeout: 12000 });
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const intent = parsed.intent as string;

    if (intent === 'action') {
      const action = parsed.action as string | undefined;
      if (action !== 'create_journal' && action !== 'create_news') return fallback;
      return {
        intent: 'action',
        action: action,
        childName: typeof parsed.child_name === 'string' ? parsed.child_name : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    }

    if (intent === 'query') {
      const validQueryTypes: QueryType[] = ['meals_recent', 'nap_recent', 'health_last', 'absences', 'recap_week', 'news_recent', 'general'];
      const queryType = validQueryTypes.includes(parsed.query_type as QueryType)
        ? (parsed.query_type as QueryType)
        : 'general';
      return {
        intent: 'query',
        queryType,
        childName: typeof parsed.child_name === 'string' ? parsed.child_name : undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    }

    return {
      intent: 'chat',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return fallback;
  }
}

// Keep backward compat for any remaining callers
export async function classifyIntent(message: string, contextPath?: string): Promise<ActionType | null> {
  const result = await classifyUnified(message, [], contextPath);
  return result.intent === 'action' ? (result.action ?? null) : null;
}

function mealLevelToQuantity(level: MealLevel): MealEntry['quantity'] {
  const map: Record<MealLevel, MealEntry['quantity']> = {
    0: 'non-mange', 1: 'peu', 2: 'bien', 3: 'tres-bien',
  };
  return map[level];
}

function mealLevelToDescription(level: MealLevel): string {
  const map: Record<MealLevel, string> = {
    0: 'Pas mangé', 1: 'Peu mangé', 2: 'Bien mangé', 3: 'Très bien mangé',
  };
  return map[level];
}

async function generateJournalNote(data: JournalFormData): Promise<string> {
  const mealNames: Record<string, string> = {
    'petit-dejeuner': 'petit-déjeuner', 'dejeuner': 'déjeuner', 'gouter': 'goûter',
  };
  const mealSummary = data.meals
    .filter(m => m.level !== null)
    .map(m => `${mealNames[m.type] ?? m.type}: ${mealLevelToDescription(m.level!)}`)
    .join(', ');

  const parts = [
    `Humeur: ${data.mood}`,
    data.napQuality !== 'none' ? `Sieste ${data.napQuality}` : 'Pas de sieste',
    mealSummary || '',
    `Changes: ${data.changes}`,
    data.hasHealth && data.healthNote ? `Santé: ${data.healthNote}` : '',
  ].filter(Boolean);

  try {
    const prompt =
      `Génère une note courte (2 phrases max) décrivant la journée de ${data.childName} à la 3ème personne. ` +
      `Données: ${parts.join(', ')}. ` +
      `Ton factuel et bienveillant, comme un compte-rendu pour les parents. ` +
      `Utilise "il" ou "elle" selon le prénom. Ne t'adresse JAMAIS directement à l'enfant. ` +
      `Réponds uniquement avec la note, sans markdown ni guillemets.`;
    const raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 100, timeout: 20000 }
    );
    return raw.replace(/[*_#`"]/g, '').trim();
  } catch {
    return parts.join('. ');
  }
}

export async function createJournalFromFormData(
  db: DrizzleDB,
  data: JournalFormData,
  authorId: string,
  napDefaults?: { start?: string; end?: string }
): Promise<ActionResult> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const meals: MealEntry[] = data.meals
    .filter(m => m.level !== null)
    .map(m => ({
      type: m.type,
      description: m.description,
      quantity: mealLevelToQuantity(m.level!),
    }));

  const defaultStart = napDefaults?.start ?? '13:00';
  const defaultEnd = napDefaults?.end ?? '15:00';

  const nap: NapEntry | null =
    data.napQuality !== 'none'
      ? { startTime: defaultStart, endTime: defaultEnd, quality: data.napQuality as NapEntry['quality'] }
      : null;

  const health: HealthEntry | null =
    data.hasHealth && data.healthNote ? { notes: data.healthNote } : null;

  const notes = await generateJournalNote(data);
  const existing = await getDailyLogByDate(db, data.childId, today);

  if (existing) {
    const updated = await updateDailyLog(db, existing.id, {
      mood: data.mood,
      meals: meals.length > 0 ? meals : existing.meals,
      nap: nap ?? existing.nap,
      health: health ?? existing.health,
      changes: data.changes,
      notes: notes || existing.notes,
    });
    if (updated) {
      return {
        type: 'create_journal', success: true,
        message: `Carnet de ${data.childName} mis à jour !`,
        resourcePath: `/app/journal/${updated.id}/edit`,
        resourceLabel: 'Voir le carnet',
      };
    }
  } else {
    const log = await createDailyLog(
      db,
      { childId: data.childId, date: today, mood: data.mood, meals, nap, health, changes: data.changes, notes, menuId: data.menuId ?? null },
      authorId
    );
    if (log) {
      return {
        type: 'create_journal', success: true,
        message: `Carnet de ${data.childName} créé pour aujourd'hui !`,
        resourcePath: `/app/journal/${log.id}/edit`,
        resourceLabel: 'Voir le carnet',
      };
    }
  }

  return { type: 'create_journal', success: false, message: 'Impossible de sauvegarder le carnet. Vérifiez vos droits.' };
}

export function extractMoodRuleBased(n: string): MoodLevel | null {
  if (/(joyeux|content|contente|souriant|super journee|bonne journee|tres bien|geniale|adorable)/.test(n)) return 'joyeux';
  if (/(grognon|pleure|difficile|agite|agitee|capricieux|capricieuse|pénible|penible|mauvaise humeur|contrarie)/.test(n)) return 'grognon';
  if (/(calme|tranquille|sage|serein|sereine|paisible|bien|bonne humeur)/.test(n)) return 'calme';
  return null;
}

function extractMealQuantityRuleBased(n: string): MealEntry['quantity'] {
  if (/(tres bien mange|tout mange|fini son assiette|tout fini|excellent apetit|bon appétit|bon appetit)/.test(n)) return 'tres-bien';
  if (/(bien mange|mange ses|mange tout|mange bien)/.test(n)) return 'bien';
  if (/(peu mange|pas beaucoup|mange un peu|mange la moitie|la moitie|moitie|a peine)/.test(n)) return 'peu';
  if (/(pas mange|rien mange|mange rien|refuse de manger|refuse manger|n a pas voulu|n a rien voulu)/.test(n)) return 'non-mange';
  return 'bien';
}

function extractNapDurationRuleBased(msg: string): string | null {
  const m = msg.match(/(\d+)\s*h(?:eure)?s?\s*(\d+)?|(\d+)\s*min(?:utes?)?/i);
  if (!m) return null;
  if (m[3]) return `${m[3]} min`;
  if (m[2]) return `${m[1]}h${m[2]}`;
  return `${m[1]}h`;
}

function extractMealsDescriptionRuleBased(msg: string): string {
  const m = msg.match(/(?:mange[ée]?s?\s+(?:ses\s+)?)([\w\s,àâéèêëîïôùûü]+?)(?:\s+et\s+|[.,!?]|$)/i);
  if (m) return m[1].trim().slice(0, 80);
  return msg.slice(0, 100);
}

async function extractJournalEntities(message: string, childName: string): Promise<ExtractedJournal> {
  const n = normalize(message);

  const ruleResult: ExtractedJournal = {
    mood: extractMoodRuleBased(n) ?? undefined,
  };

  if (/(mange|repas|dejeuner|petit.dej|gouter|nourri)/.test(n)) {
    ruleResult.mealQuantity = extractMealQuantityRuleBased(n);
    ruleResult.meals = extractMealsDescriptionRuleBased(message);
  }

  if (/(sieste|dormi|dodo|endormi)/.test(n)) {
    ruleResult.nap = extractNapDurationRuleBased(message) ?? undefined;
  }

  try {
    const prompt =
      `Tu es un assistant qui résume une journée d'enfant. ` +
      `Enfant: ${childName}. Message de l'assistante: "${message}"\n` +
      `Génère une note de synthèse courte (1-2 phrases max, sans markdown, sans guillemets). ` +
      `Réponds uniquement avec la note.`;

    const raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 120, timeout: 20000 }
    );
    const note = raw.replace(/[*_#`]/g, '').trim();
    if (note.length > 5) ruleResult.notes = note;
  } catch {
    // non-blocking
  }

  return ruleResult;
}

async function extractNewsEntities(message: string, childName: string): Promise<ExtractedNews> {
  const prompt =
    `Génère une news courte et chaleureuse (max 140 caractères) pour une crèche/assmat à partir de ce message. ` +
    `Enfant: ${childName}. Réponds UNIQUEMENT en JSON sur une ligne.\n` +
    `Message: "${message}"\n` +
    `JSON attendu: {"content":"texte de la news SANS emoji","emoji":"un seul emoji adapté"}\n` +
    `IMPORTANT: Ne mets PAS l'emoji dans le champ content, uniquement dans le champ emoji. ` +
    `Dans le content, utilise "Il" ou "Elle" plutôt que le prénom "${childName.split(' ')[0]}" au début de la phrase.`;

  try {
    const raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4, maxTokens: 200, timeout: 25000 }
    );
    const cleaned = raw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as ExtractedNews;
      if (parsed.content) {
        parsed.content = parsed.content
          .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{2BFF}]\s*/u, '')
          .trim();
      }
      return parsed;
    }
  } catch {
    // silent fallback
  }
  return {};
}

export async function executeAction(
  db: DrizzleDB,
  actionType: ActionType,
  childId: string,
  childName: string,
  authorId: string,
  message: string,
  napDefaults?: { start?: string; end?: string }
): Promise<ActionResult> {

  if (actionType === 'create_news') {
    const ex = await extractNewsEntities(message, childName);
    const content = (ex.content ?? message).slice(0, 200);
    const emoji = ex.emoji ?? null;

    const newsItem = await createNews(db, { childId, content, emoji: emoji ?? undefined }, authorId);

    if (newsItem) {
      return {
        type: 'create_news', success: true,
        message: `News de ${childName} publiée avec succès !`,
        resourcePath: '/app/feed',
        resourceLabel: 'Voir les news',
      };
    }

    return { type: 'create_news', success: false, message: `Impossible de publier la news. Vérifiez vos droits.` };
  }

  if (actionType === 'create_journal') {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const ex = await extractJournalEntities(message, childName);

    const mood: MoodLevel = (['joyeux', 'calme', 'grognon'] as MoodLevel[]).includes(ex.mood as MoodLevel)
      ? (ex.mood as MoodLevel)
      : 'calme';

    const meals: MealEntry[] = ex.meals
      ? [{
          type: 'dejeuner',
          description: ex.meals,
          quantity: (['bien', 'peu', 'non-mange', 'tres-bien'].includes(ex.mealQuantity ?? ''))
            ? (ex.mealQuantity as MealEntry['quantity'])
            : 'bien',
        }]
      : [];

    const napStart = napDefaults?.start ?? '13:00';
    const napEnd = napDefaults?.end ?? '15:00';

    const nap: NapEntry | null = ex.nap
      ? { startTime: napStart, endTime: napEnd, quality: 'normale' }
      : null;

    const notes = ex.notes ?? '';
    const existing = await getDailyLogByDate(db, childId, today);

    if (existing) {
      const updated = await updateDailyLog(db, existing.id, {
        mood,
        meals: meals.length > 0 ? meals : existing.meals,
        nap: nap ?? existing.nap,
        notes: notes || existing.notes,
      });

      if (updated) {
        return {
          type: 'create_journal', success: true,
          message: `Carnet de ${childName} mis à jour !`,
          resourcePath: `/app/journal/${updated.id}/edit`,
          resourceLabel: 'Voir le carnet',
        };
      }
    } else {
      const log = await createDailyLog(db, { childId, date: today, mood, meals, nap, notes }, authorId);

      if (log) {
        return {
          type: 'create_journal', success: true,
          message: `Carnet de ${childName} créé pour aujourd'hui !`,
          resourcePath: `/app/journal/${log.id}/edit`,
          resourceLabel: 'Voir le carnet',
        };
      }
    }

    return { type: 'create_journal', success: false, message: 'Impossible de sauvegarder le carnet. Vérifiez vos droits.' };
  }

  return { type: actionType, success: false, message: 'Action non reconnue.' };
}
