import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { executeAIPipeline } from '$lib/server/ai/pipeline';
import {
  classifyUnified,
  executeAction,
  createJournalFromFormData,
  extractMoodRuleBased,
  type JournalFormData,
  type NapQuality,
  type JournalMealEntry,
  type ClassificationResult,
} from '$lib/server/ai/actions';
import { chatCompletion, isAIEnabled } from '$lib/server/ai/ollama';
import { getMenusForDate } from '$lib/domain/menus';
import { createNews } from '$lib/domain/news';
import { getChildrenForUser, getChildById } from '$lib/domain/children';
import { getAttendancesByDate, getMonthlyReport } from '$lib/domain/attendance';
import { createRateLimiter, assertChildAccess } from '$lib/server/helpers';
import type { MoodLevel, MealLevel, MealType } from '$lib/types';

interface ChildOption {
  id: string;
  name: string;
}

const checkRateLimit = createRateLimiter(15, 60_000);

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function childIdFromPath(contextPath: string): string | null {
  if (!contextPath.includes('/app/children/')) return null;
  const m = contextPath.match(UUID_RE);
  return m?.[0] ?? null;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, "'");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs, '$1')
    .replace(/_{2}(.*?)_{2}/gs, '$1')
    .replace(/_(.*?)_/gs, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SYSTEM_NO_MARKDOWN =
  'Réponds en français, de façon concise et chaleureuse. ' +
  'Ne jamais utiliser de markdown (pas de *, **, #, `, listes à puces formatées). ' +
  'Utilise des phrases simples.';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db, user } = locals;

  if (!user) throw error(401, 'Non authentifié');

  if (!isAIEnabled()) {
    return json({ reply: "L'assistant IA est actuellement désactivé." });
  }

  if (!checkRateLimit(user.id)) {
    return json({ reply: 'Trop de messages. Patientez une minute avant de réessayer.' }, { status: 429 });
  }

  let body: { message?: unknown; contextPath?: unknown; conversationHistory?: unknown; journalData?: unknown; newsData?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Corps de requête invalide');
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  if (!message) throw error(400, 'Message requis');

  const rawJd = body.journalData as Record<string, unknown> | undefined;
  const journalData: JournalFormData | null =
    rawJd && typeof rawJd.childId === 'string'
      ? {
          childId: rawJd.childId,
          childName: String(rawJd.childName ?? ''),
          mood: (rawJd.mood as MoodLevel) ?? 'calme',
          napQuality: (rawJd.napQuality as NapQuality) ?? 'none',
          meals: Array.isArray(rawJd.meals)
            ? (rawJd.meals as Record<string, unknown>[])
                .filter(m => m && typeof m === 'object')
                .map(m => ({
                  type: m.type as MealType,
                  description: String(m.description ?? ''),
                  level: m.level !== null && m.level !== undefined ? (m.level as MealLevel) : null,
                } satisfies JournalMealEntry))
            : [],
          changes: typeof rawJd.changes === 'number' ? rawJd.changes : 3,
          hasHealth: Boolean(rawJd.hasHealth),
          healthNote: String(rawJd.healthNote ?? ''),
          menuId: typeof rawJd.menuId === 'string' ? rawJd.menuId : null,
        }
      : null;

  const contextPath = typeof body.contextPath === 'string' ? body.contextPath : '';
  const rawHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
  const conversationHistory = rawHistory
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m && typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
    )
    .slice(-12); // last 6 exchanges

  const role = user.role;

  const napDefaults = { start: user.defaultNapStart, end: user.defaultNapEnd };

  // ── Direct form submissions (journal/news) — bypass classification ────
  if (journalData && role === 'assistante') {
    // Verify the assistante manages this child before writing
    const jChild = await getChildById(db, journalData.childId);
    assertChildAccess(jChild, user);
    const result = await createJournalFromFormData(db, journalData, user.id, napDefaults);
    return json({ reply: result.message, action: result });
  }

  const rawNd = body.newsData as Record<string, unknown> | undefined;
  if (rawNd && typeof rawNd.childId === 'string' && role === 'assistante') {
    const newsChildId = rawNd.childId;
    // Verify the assistante manages this child before writing
    const nChild = await getChildById(db, newsChildId);
    assertChildAccess(nChild, user);
    const newsContent = String(rawNd.content ?? '').trim().slice(0, 200);
    if (!newsContent) return json({ reply: 'Le contenu de la news est vide.' });
    const newsItem = await createNews(db, { childId: newsChildId, content: newsContent, emoji: undefined }, user.id);
    if (newsItem) {
      return json({
        reply: 'News publiée avec succès !',
        action: { type: 'create_news', success: true, message: 'News publiée !', resourcePath: '/app/feed', resourceLabel: 'Voir les news' },
      });
    }
    return json({ reply: 'Impossible de publier la news. Vérifiez vos droits.' });
  }

  // ── Load children list ────────────────────────────────────────────────
  const rawChildren = await getChildrenForUser(db, user.id, user.role as 'assistante' | 'parent');
  const childrenList = rawChildren.map(c => ({
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
  }));

  // ── Unified classification ────────────────────────────────────────────
  const classification = await classifyUnified(message, conversationHistory, contextPath);
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) console.log('[Agent] Classification:', JSON.stringify(classification));

  // ── Resolve target child ──────────────────────────────────────────────
  // Priority: explicit name in message > LLM-extracted name > URL path
  let targetChildId: string | null = null;

  // 1. Child name explicitly mentioned in the message (highest priority)
  const nMsg = normalize(message);
  for (const c of childrenList) {
    if (nMsg.includes(normalize(c.first_name))) {
      targetChildId = c.id;
      break;
    }
  }

  // 2. Child name extracted by LLM classification
  if (!targetChildId && classification.childName) {
    const nClassified = normalize(classification.childName);
    for (const c of childrenList) {
      if (normalize(c.first_name) === nClassified || normalize(`${c.first_name} ${c.last_name}`).includes(nClassified)) {
        targetChildId = c.id;
        break;
      }
    }
  }

  // 3. Fallback: child ID from current page URL — verify it belongs to the user's children
  if (!targetChildId) {
    const pathChildId = childIdFromPath(contextPath);
    if (pathChildId && childrenList.some(c => c.id === pathChildId)) {
      targetChildId = pathChildId;
    }
  }

  const targetChild = childrenList.find(c => c.id === targetChildId);
  let targetChildName = targetChild
    ? `${targetChild.first_name} ${targetChild.last_name}`
    : '';

  const childOptions: ChildOption[] = childrenList.map(c => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
  }));

  // ── Route based on classification ─────────────────────────────────────
  // ACTION intent (assistante only)
  if (classification.intent === 'action' && role === 'assistante' && classification.action) {
    // Low confidence → ask for confirmation instead of acting
    if (classification.confidence < 0.7) {
      const actionLabel = classification.action === 'create_journal' ? 'créer le carnet' : 'publier une news';
      const childSuffix = targetChildName ? ` pour ${targetChildName.split(' ')[0]}` : '';
      return json({
        reply: `Je crois comprendre que vous souhaitez ${actionLabel}${childSuffix}. C'est bien ça ?`,
        followUp: {
          type: 'confirm_action' as const,
          action: classification.action,
          childId: targetChildId,
          childName: targetChildName || undefined,
        },
      });
    }

    return handleAction(classification.action, targetChildId, targetChildName, childOptions, message, db, user.id, napDefaults);
  }

  // QUERY intent — special handlers for attendance queries
  if (classification.intent === 'query' && classification.queryType === 'presence_today') {
    if (role !== 'assistante') {
      return json({ reply: "Les informations de présence ne sont disponibles que pour les assistantes maternelles." });
    }
    const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const attendances = await getAttendancesByDate(db, user.id, today);

    const present = attendances.filter(a => a.id && a.arrivalTime && !a.departureTime && a.status === 'present');
    const departed = attendances.filter(a => a.id && a.arrivalTime && a.departureTime && a.status === 'present');
    const absent = attendances.filter(a => a.id && (a.status === 'absent_planned' || a.status === 'absent_unplanned'));
    const notArrived = attendances.filter(a => !a.id && a.expectedStart);

    const parts: string[] = [];
    if (present.length > 0) {
      const names = present.map(a => {
        const t = a.arrivalTime ? new Date(a.arrivalTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
        return `${a.childFirstName} (arrivée ${t})`;
      }).join(', ');
      parts.push(`${present.length} enfant${present.length > 1 ? 's' : ''} présent${present.length > 1 ? 's' : ''} : ${names}.`);
    }
    if (departed.length > 0) {
      parts.push(`${departed.length} déjà parti${departed.length > 1 ? 's' : ''} : ${departed.map(a => a.childFirstName).join(', ')}.`);
    }
    if (absent.length > 0) {
      parts.push(`${absent.length} absent${absent.length > 1 ? 's' : ''} : ${absent.map(a => a.childFirstName).join(', ')}.`);
    }
    if (notArrived.length > 0) {
      parts.push(`${notArrived.length} attendu${notArrived.length > 1 ? 's' : ''} (pas encore arrivé${notArrived.length > 1 ? 's' : ''}) : ${notArrived.map(a => a.childFirstName).join(', ')}.`);
    }
    if (parts.length === 0) parts.push("Aucune donnée de présence pour aujourd'hui.");

    return json({ reply: `Aujourd'hui : ${parts.join(' ')}` });
  }

  if (classification.intent === 'query' && classification.queryType === 'hours_child') {
    if (!targetChildId) {
      if (childrenList.length === 1) {
        targetChildId = childrenList[0].id;
        targetChildName = childrenList[0].first_name;
      } else {
        const names = childrenList.map(c => c.first_name).join(', ');
        return json({ reply: `De quel enfant souhaitez-vous voir les heures ? (${names})` });
      }
    }

    const now = new Date();
    const report = await getMonthlyReport(db, user.id, now.getFullYear(), now.getMonth());
    const childReport = report.find(r => r.childId === targetChildId);

    if (!childReport) {
      return json({ reply: `Je n'ai pas trouvé de données d'heures pour ${targetChildName || 'cet enfant'} ce mois-ci.` });
    }

    const monthName = now.toLocaleDateString('fr-FR', { month: 'long' });
    const fmtH = (h: number) => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return `${hrs}h${mins.toString().padStart(2, '0')}`; };
    const deltaSign = childReport.deltaHours >= 0 ? '+' : '';

    return json({
      reply: `En ${monthName}, ${childReport.childFirstName} a fait ${fmtH(childReport.actualHours)} sur ${fmtH(childReport.expectedHours)} prévues (${deltaSign}${fmtH(childReport.deltaHours)}). ${childReport.daysPresent} jour${childReport.daysPresent > 1 ? 's' : ''} de présence${childReport.daysAbsentPlanned > 0 ? `, ${childReport.daysAbsentPlanned} absence${childReport.daysAbsentPlanned > 1 ? 's' : ''} prévue${childReport.daysAbsentPlanned > 1 ? 's' : ''}` : ''}${childReport.daysAbsentUnplanned > 0 ? `, ${childReport.daysAbsentUnplanned} absence${childReport.daysAbsentUnplanned > 1 ? 's' : ''} imprévue${childReport.daysAbsentUnplanned > 1 ? 's' : ''}` : ''} sur ${childReport.daysExpected} jours attendus.`
    });
  }

  // QUERY intent → pipeline RAG
  if (classification.intent === 'query') {
    if (targetChildId) {
      const result = await executeAIPipeline(db, {
        childId: targetChildId,
        question: message,
        queryType: classification.queryType,
      });

      if (result.success && result.response) {
        return json({ reply: stripMarkdown(result.response.answer) });
      }
      return json({ reply: result.error ?? "Je n'ai pas pu répondre à cette question." });
    }

    // No child identified — ask which child
    const nMsg = normalize(message);
    const asksAllChildren =
      nMsg.includes('tous les enfants') ||
      nMsg.includes('toutes les enfants') ||
      nMsg.includes('chaque enfant') ||
      nMsg.includes('l ensemble des enfants');

    if (asksAllChildren) {
      const names = childrenList.map(c => c.first_name).join(', ');
      return json({
        reply: names.length > 0
          ? `Je peux répondre à des questions enfant par enfant, mais pas analyser tout le groupe en une seule fois. Précisez un prénom parmi : ${names}.`
          : "Je n'ai pas accès aux données globales du groupe. Précisez un enfant."
      });
    }

    // Single child → auto-select
    if (childrenList.length === 1) {
      const onlyChild = childrenList[0];
      const result = await executeAIPipeline(db, {
        childId: onlyChild.id,
        question: message,
        queryType: classification.queryType,
      });
      if (result.success && result.response) {
        return json({ reply: stripMarkdown(result.response.answer) });
      }
      return json({ reply: result.error ?? "Je n'ai pas pu répondre à cette question." });
    }

    // Multiple children, none identified → ask
    const names = childrenList.map(c => c.first_name).join(', ');
    return json({
      reply: `De quel enfant parlez-vous ? (${names})`,
    });
  }

  // CHAT intent → conversational response
  const systemMsg = role === 'assistante'
    ? `Tu es l'assistant IA de Le Cocon, une application de cahier de liaison pour assistantes maternelles. ${SYSTEM_NO_MARKDOWN} Tu peux aussi créer des carnets de journée et publier des news — propose-le si c'est pertinent. Pour les données d'un enfant spécifique, demande de préciser son prénom.`
    : `Tu es l'assistant IA de Le Cocon, une application de suivi pour parents et assistantes maternelles. ${SYSTEM_NO_MARKDOWN}`;

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: systemMsg },
        ...conversationHistory,
        { role: 'user', content: message }
      ],
      { maxTokens: 300, timeout: 45000 }
    );

    return json({ reply: stripMarkdown(raw) });
  } catch {
    return json({ reply: "Je n'ai pas pu traiter votre message. Réessayez." });
  }
};

// ── Action handler (extracted from inline if/else) ──────────────────────
async function handleAction(
  actionType: 'create_journal' | 'create_news',
  targetChildId: string | null,
  targetChildName: string,
  childOptions: ChildOption[],
  message: string,
  db: import('$lib/server/db').DrizzleDB,
  userId: string,
  napDefaults: { start?: string; end?: string },
) {
  if (actionType === 'create_journal') {
    if (!targetChildId) {
      return json({
        reply: childOptions.length > 0
          ? 'Pour quel enfant souhaitez-vous créer le carnet ?'
          : "Je ne trouve aucun enfant associé à votre compte.",
        followUp: childOptions.length > 0
          ? { type: 'child_picker' as const, childOptions, pendingAction: 'create_journal' as const }
          : undefined,
      });
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const menusForToday = await getMenusForDate(db, today);

    if (menusForToday.length === 0) {
      return json({
        reply: `Aucun menu n'est configuré pour aujourd'hui. Renseignez d'abord les menus du jour (section "Menus") pour que je puisse créer un carnet complet avec les repas.`,
      });
    }

    const detectedMood = extractMoodRuleBased(normalize(message));
    return json({
      reply: `Parfait ! Je vais créer le carnet de ${targetChildName}. Quelques questions rapides :`,
      followUp: {
        type: 'journal_form' as const,
        childId: targetChildId,
        childName: targetChildName,
        menus: menusForToday
          .sort((a, b) => {
            const order = { 'petit-dejeuner': 0, 'dejeuner': 1, 'gouter': 2 } as Record<string, number>;
            return (order[a.mealType] ?? 9) - (order[b.mealType] ?? 9);
          })
          .map(m => ({ mealType: m.mealType, description: m.description, id: m.id })),
        partial: { mood: detectedMood ?? undefined },
      },
    });
  }

  if (actionType === 'create_news') {
    if (!targetChildId) {
      return json({
        reply: childOptions.length > 0
          ? 'Pour quel enfant souhaitez-vous publier une news ?'
          : "Je ne trouve aucun enfant associé à votre compte.",
        followUp: childOptions.length > 0
          ? { type: 'child_picker' as const, childOptions, pendingAction: 'create_news' as const }
          : undefined,
      });
    }

    if (message.trim().length < 25) {
      return json({
        reply: `Que souhaitez-vous annoncer pour ${targetChildName} ?`,
        followUp: {
          type: 'news_content' as const,
          childId: targetChildId,
          childName: targetChildName,
        },
      });
    }

    const result = await executeAction(db, 'create_news', targetChildId, targetChildName, userId, message, napDefaults);
    return json({
      reply: result.success ? result.message : `${result.message} Vous pouvez le faire manuellement.`,
      action: result,
    });
  }

  return json({ reply: "Action non reconnue." });
}
