/**
 * Saisie Rapide (Batch) — Server
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDailyLogsForDate, batchUpsertDailyLogs } from '$lib/domain/daily_logs';
import { getMenusForDate, getLunchMenuForDate } from '$lib/domain/menus';
import { getChildrenForUser } from '$lib/domain/children';
import { requireRole, parseJsonSafe } from '$lib/server/helpers';
import type { MealEntry, NapEntry, MoodLevel, HealthEntry } from '$lib/types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireRole(locals.user, 'assistante');

  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

  const [{ children }, existingLogs, menus] = await Promise.all([
    parent(),
    getDailyLogsForDate(locals.db, today),
    getMenusForDate(locals.db, today)
  ]);

  const childrenWithLogs = new Set(existingLogs.map(l => l.childId));

  return {
    today,
    children: children.filter(c => !childrenWithLogs.has(c.id)),
    existingLogs,
    menus,
    defaultNapStart: locals.user.defaultNapStart ?? '13:00',
    defaultNapEnd: locals.user.defaultNapEnd ?? '15:00'
  };
};

export const actions: Actions = {
  saveBatch: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const date = formData.get('date')?.toString();
    const entriesJson = formData.get('entries')?.toString();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, { error: 'Date invalide' });
    if (!entriesJson) return fail(400, { error: 'Données manquantes' });

    const entries = parseJsonSafe<Array<{
      childId: string;
      meals: MealEntry[];
      mood: MoodLevel;
      nap: NapEntry | null;
      health?: HealthEntry | null;
      changes?: number;
      notes?: string;
    }>>(entriesJson, []);

    if (entries.length === 0) return fail(400, { error: 'Aucun carnet à sauvegarder' });

    // Verify all childIds belong to this assistante
    const ownedChildren = await getChildrenForUser(locals.db, locals.user.id, 'assistante');
    const ownedChildIds = new Set(ownedChildren.map((c) => c.id));
    const unauthorized = entries.filter((e) => !ownedChildIds.has(e.childId));
    if (unauthorized.length > 0) return fail(403, { error: 'Accès non autorisé à certains enfants' });

    const lunchMenu = await getLunchMenuForDate(locals.db, date);

    const result = await batchUpsertDailyLogs(
      locals.db,
      entries.map((e) => ({
        childId: e.childId,
        date,
        meals: e.meals,
        nap: e.nap,
        mood: e.mood,
        health: e.health ?? null,
        changes: e.changes ?? 0,
        notes: e.notes ?? '',
        menuId: lunchMenu?.id ?? null
      })),
      locals.user.id
    );

    if (result.failed > 0 && result.success === 0) {
      return fail(500, { error: 'Erreur lors de la sauvegarde des journaux' });
    }

    if (result.failed > 0) {
      return {
        success: true,
        message: `${result.success} journaux sauvegardés (${result.failed} échecs)`
      };
    }

    return {
      success: true,
      message: `${result.success} carnet${result.success > 1 ? 's' : ''} sauvegardé${result.success > 1 ? 's' : ''} avec succès`
    };
  }
};
