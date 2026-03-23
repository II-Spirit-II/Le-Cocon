import type { DrizzleDB } from '$lib/server/db';
import type { MealEntry, NapEntry, MoodLevel, HealthEntry, MealLevel, MealType } from '$lib/types';
import { createNews } from '$lib/domain/news';
import { createDailyLog, getDailyLogByDate, updateDailyLog } from '$lib/domain/daily_logs';
import { chatCompletion } from './ollama';

// ── Types ──────────────────────────────────────────────────────────────────

export type ActionType = 'create_journal' | 'create_news';

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

const INTENT_CLASSIFICATION_PROMPT =
  `Tu es un classifieur d'intentions pour une application de crèche/assistante maternelle. ` +
  `Analyse le message de l'utilisatrice et détermine son intention parmi :\n` +
  `- "create_journal" : elle veut ÉCRIRE/CRÉER/REMPLIR le carnet ou le compte-rendu de la journée d'un enfant. Verbes typiques : "fais", "crée", "remplis", "complète", "saisis", "ajoute" le carnet/journal/CR/fiche.\n` +
  `- "create_news" : elle veut PUBLIER une actualité, news, annonce ou message destiné aux parents dans les news. Verbes typiques : "publie", "poste", "annonce", "partage", "dis aux parents".\n` +
  `- "chat" : TOUT le reste — questions, demandes d'info, résumés, bilans, consultations. C'est le choix par défaut.\n\n` +
  `RÈGLES CRITIQUES :\n` +
  `- POSER UNE QUESTION sur un enfant = "chat" (ex: "comment s'est passée la semaine de Léo ?", "résume-moi la journée", "qu'a mangé Emma ?", "bilan de la semaine")\n` +
  `- DEMANDER UN RÉSUMÉ ou un bilan = "chat" (ce n'est PAS une création de carnet)\n` +
  `- Seule une demande explicite de REMPLIR/CRÉER/FAIRE le carnet = "create_journal"\n` +
  `- En cas de doute, choisis "chat"\n` +
  `- Les utilisatrices peuvent faire des fautes d'orthographe, utiliser des abréviations, du langage familier\n` +
  `- "actu" = actualité = news, "CR" = compte-rendu = carnet, "jurnal" = carnet, "journal" = carnet\n` +
  `- Le contexte de la page courante t'aide à désambiguïser : "fais-le" sur la page Carnet = create_journal, "fais-le" sur les News = create_news\n\n` +
  `Réponds UNIQUEMENT avec un JSON sur une seule ligne : {"intent":"create_journal"} ou {"intent":"create_news"} ou {"intent":"chat"}`;

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

export async function classifyIntent(message: string, contextPath?: string): Promise<ActionType | null> {
  const pageLabel = contextPath ? contextPathToLabel(contextPath) : null;
  const contextLine = pageLabel ? `\nPage courante : ${pageLabel}` : '';

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
        { role: 'user', content: `${message}${contextLine}` },
      ],
      { temperature: 0, maxTokens: 30, timeout: 10000 }
    );
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { intent?: string };
      if (parsed.intent === 'create_journal' || parsed.intent === 'create_news') {
        return parsed.intent;
      }
    }
  } catch {
    // AI unavailable → no action detected
  }
  return null;
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
