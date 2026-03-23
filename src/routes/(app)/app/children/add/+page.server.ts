/**
 * Add Child — Server Action
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createChild } from '$lib/domain/children';
import { requireRole } from '$lib/server/helpers';
import { createChildSchema, parseFormData } from '$lib/server/validation';

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals.user, 'assistante');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const v = parseFormData(createChildSchema, formData);
    if (!v.ok) {
      return fail(400, {
        error: v.error,
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        birthDate: formData.get('birthDate') as string,
      });
    }

    const child = await createChild(locals.db, v.data, locals.user.id);
    if (!child) {
      return fail(500, {
        error: 'Erreur lors de la création. Veuillez réessayer.',
        ...v.data,
      });
    }

    throw redirect(303, `/app/children/${child.id}`);
  }
};
