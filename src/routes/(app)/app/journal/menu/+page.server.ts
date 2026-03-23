/**
 * Menu du Jour — Server
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getMenusForDate, upsertMenu } from '$lib/domain/menus';
import { requireRole } from '$lib/server/helpers';

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals.user, 'assistante');

  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const menus = await getMenusForDate(locals.db, today);

  return { today, menus };
};

export const actions: Actions = {
  saveMenu: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const date = formData.get('date')?.toString();
    const petitDej = formData.get('petit-dejeuner')?.toString().trim() ?? '';
    const dejeuner = formData.get('dejeuner')?.toString().trim() ?? '';
    const gouter = formData.get('gouter')?.toString().trim() ?? '';

    if (!date) return fail(400, { error: 'Date manquante' });

    const tasks: Array<Promise<unknown>> = [];
    if (petitDej) tasks.push(upsertMenu(locals.db, date, 'petit-dejeuner', petitDej));
    if (dejeuner) tasks.push(upsertMenu(locals.db, date, 'dejeuner', dejeuner));
    if (gouter) tasks.push(upsertMenu(locals.db, date, 'gouter', gouter));

    if (tasks.length === 0) return fail(400, { error: 'Au moins un repas doit être renseigné' });

    await Promise.all(tasks);
    return { success: true, message: 'Menu du jour enregistré' };
  }
};
