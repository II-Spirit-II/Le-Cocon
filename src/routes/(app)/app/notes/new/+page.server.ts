/**
 * New Note — Server
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createNote } from '$lib/domain/parent_notes';
import { getChildById } from '$lib/domain/children';
import { requireRole, assertChildAccess } from '$lib/server/helpers';
import { createNoteSchema, parseFormData } from '$lib/server/validation';
import { getChildAvatarUrl } from '$lib/utils/avatar';
import { getAvatarPublicUrl } from '$lib/server/storage';

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireRole(locals.user, 'parent');

  const { children } = await parent();

  const childrenWithAvatars = await Promise.all(
    children.map(async (c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      avatarUrl: c.avatarPath
        ? await getAvatarPublicUrl(locals.db, c.id, c.avatarPath)
        : getChildAvatarUrl(c.firstName + ' ' + c.lastName),
    }))
  );

  return { children: childrenWithAvatars };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    requireRole(locals.user, 'parent');

    const formData = await request.formData();
    const v = parseFormData(createNoteSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const child = await getChildById(locals.db, v.data.childId);
    assertChildAccess(child, locals.user);

    const note = await createNote(
      locals.db,
      {
        childId: v.data.childId,
        kind: v.data.kind,
        content: v.data.content,
        startDate: v.data.startDate ?? null,
        endDate: v.data.endDate ?? null,
      },
      locals.user.id
    );

    if (!note) return fail(500, { error: 'Erreur lors de la creation de la note' });

    throw redirect(303, '/app/notes');
  }
};
