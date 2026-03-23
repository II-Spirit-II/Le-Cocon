/**
 * New Journal — Server
 */
import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createDailyLog, getDailyLogByDate } from '$lib/domain/daily_logs';
import { getMenusForDate } from '$lib/domain/menus';
import { getChildById } from '$lib/domain/children';
import { requireRole, parseJsonSafe, assertChildAccess } from '$lib/server/helpers';
import type { MealEntry, NapEntry, HealthEntry, MoodLevel } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireRole(locals.user, 'assistante');

  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const preselectedChildId = url.searchParams.get('child') ?? '';
  const menus = await getMenusForDate(locals.db, today);

  return {
    today,
    menus,
    preselectedChildId,
    defaultNapStart: locals.user.defaultNapStart ?? '13:00',
    defaultNapEnd: locals.user.defaultNapEnd ?? '15:00'
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const childId = formData.get('childId') as string;
    const date = formData.get('date') as string;
    const mood = (formData.get('mood') as MoodLevel) || 'calme';
    const notes = (formData.get('notes') as string) || '';
    const changes = parseInt(formData.get('changes') as string, 10) || 0;

    if (!childId) return fail(400, { error: 'Veuillez sélectionner un enfant' });

    const child = await getChildById(locals.db, childId);
    assertChildAccess(child, locals.user);

    if (!date) return fail(400, { error: 'Veuillez sélectionner une date' });

    const meals = parseJsonSafe<MealEntry[]>(formData.get('meals') as string, []);
    const nap = parseJsonSafe<NapEntry | null>(formData.get('nap') as string, null);
    const health = parseJsonSafe<HealthEntry | null>(formData.get('health') as string, null);

    // Prevent duplicate
    const existingLog = await getDailyLogByDate(locals.db, childId, date);
    if (existingLog) {
      return fail(409, {
        duplicate: true,
        existingLogId: existingLog.id,
        childId,
        error: 'Un carnet existe déjà pour cet enfant à cette date'
      });
    }

    const dailyLog = await createDailyLog(
      locals.db,
      { childId, date, meals, nap, mood, health, changes, notes },
      locals.user.id
    );

    if (!dailyLog) return fail(500, { error: 'Erreur lors de la création du carnet' });

    throw redirect(303, `/app/children/${childId}`);
  }
};
