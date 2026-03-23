/**
 * Edit Journal — Server
 */
import { redirect, fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getChildById } from '$lib/domain/children';
import { getDailyLogById, updateDailyLog } from '$lib/domain/daily_logs';
import { getMenusForDate } from '$lib/domain/menus';
import { requireRole, assertChildAccess, parseJsonSafe } from '$lib/server/helpers';
import type { MealEntry, NapEntry, HealthEntry, MoodLevel } from '$lib/types';

export const load: PageServerLoad = async ({ locals, params }) => {
  requireRole(locals.user, 'assistante');

  const journal = await getDailyLogById(locals.db, params.id);
  if (!journal) throw error(404, 'Journal introuvable');

  const [child, menus] = await Promise.all([
    getChildById(locals.db, journal.childId),
    getMenusForDate(locals.db, journal.date)
  ]);

  assertChildAccess(child, locals.user);

  return {
    journal,
    child,
    menus,
    defaultNapStart: locals.user.defaultNapStart ?? '13:00',
    defaultNapEnd: locals.user.defaultNapEnd ?? '15:00'
  };
};

export const actions: Actions = {
  default: async ({ request, locals, params }) => {
    requireRole(locals.user, 'assistante');

    const existingJournal = await getDailyLogById(locals.db, params.id);
    if (!existingJournal) return fail(404, { error: 'Journal introuvable' });

    const child = await getChildById(locals.db, existingJournal.childId);
    assertChildAccess(child, locals.user);

    const formData = await request.formData();
    const mood = (formData.get('mood') as MoodLevel) || 'calme';
    const notes = (formData.get('notes') as string) || '';
    const changes = parseInt(formData.get('changes') as string, 10) || 0;

    const meals = parseJsonSafe<MealEntry[]>(formData.get('meals') as string, []);
    const nap = parseJsonSafe<NapEntry | null>(formData.get('nap') as string, null);
    const health = parseJsonSafe<HealthEntry | null>(formData.get('health') as string, null);

    const updated = await updateDailyLog(locals.db, params.id, {
      meals, nap, mood, health, changes, notes
    });

    if (!updated) return fail(500, { error: 'Erreur lors de la modification du carnet' });

    throw redirect(303, `/app/children/${existingJournal.childId}`);
  }
};
