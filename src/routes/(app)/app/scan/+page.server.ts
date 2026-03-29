import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/helpers';

export const load: PageServerLoad = async ({ locals }) => {
  requireAuth(locals.user);
  if (locals.user.role !== 'assistante') throw redirect(303, '/app/attendance');
  return {};
};
