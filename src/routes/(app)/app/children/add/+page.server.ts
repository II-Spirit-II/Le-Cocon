/**
 * Add Child — Server Action
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createChild } from '$lib/domain/children';
import { requireRole } from '$lib/server/helpers';
import { createChildSchema, careScheduleSchema } from '$lib/server/validation';
import type { CareSchedule } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals.user, 'assistante');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const firstName = (formData.get('firstName') as string ?? '').trim();
    const lastName = (formData.get('lastName') as string ?? '').trim();
    const birthDate = (formData.get('birthDate') as string ?? '').trim();
    const careScheduleRaw = formData.get('careSchedule') as string ?? '{}';

    let careSchedule: CareSchedule = {};
    try {
      const parsed = JSON.parse(careScheduleRaw);
      const result = careScheduleSchema.safeParse(parsed);
      if (result.success) careSchedule = result.data ?? {};
    } catch {
      // Invalid JSON → empty schedule
    }

    const v = createChildSchema.safeParse({ firstName, lastName, birthDate, careSchedule });
    if (!v.success) {
      return fail(400, {
        error: v.error.issues[0]?.message ?? 'Données invalides',
        firstName,
        lastName,
        birthDate,
      });
    }

    const child = await createChild(locals.db, v.data, locals.user.id);
    if (!child) {
      return fail(500, {
        error: 'Erreur lors de la création. Veuillez réessayer.',
        firstName,
        lastName,
        birthDate,
      });
    }

    throw redirect(303, `/app/children/${child.id}`);
  }
};
