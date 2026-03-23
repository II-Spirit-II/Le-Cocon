/**
 * Invite Code Redemption — Server
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { useInviteCode } from '$lib/domain/invites';
import { requireRole } from '$lib/server/helpers';
import { inviteCodeSchema, parseFormData } from '$lib/server/validation';

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals.user, 'parent');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    requireRole(locals.user, 'parent');

    const formData = await request.formData();
    const v = parseFormData(inviteCodeSchema, formData);
    if (!v.ok) return fail(400, { error: v.error, code: formData.get('code') as string });

    const { childId, error } = await useInviteCode(locals.db, v.data.code, locals.user.id);
    if (error) return fail(400, { error, code: v.data.code });

    throw redirect(303, `/app/children/${childId}`);
  }
};
