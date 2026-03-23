/**
 * Children Page — Server Load
 *
 * Children data comes from the parent layout.
 * This file is kept for future actions.
 */
import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/helpers';

export const load: PageServerLoad = async ({ locals }) => {
  requireAuth(locals.user);
};
