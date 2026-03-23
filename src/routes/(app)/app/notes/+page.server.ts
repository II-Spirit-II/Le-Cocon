/**
 * Notes Page — Server
 *
 * Parent-facing: list and create notes to the assistante.
 */
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getNotesForParent, createNote, deleteNote, markResponseAsSeen, getNoteById } from '$lib/domain/parent_notes';
import { getChildById } from '$lib/domain/children';
import { requireAuth, requireRole, assertChildAccess } from '$lib/server/helpers';
import { createNoteSchema, parseFormData } from '$lib/server/validation';

export const load: PageServerLoad = async ({ locals }) => {
  requireAuth(locals.user);

  const notes = await getNotesForParent(locals.db, locals.user.id, { limit: 50 });

  return { notes, role: locals.user.role };
};

export const actions: Actions = {
  createNote: async ({ request, locals }) => {
    requireRole(locals.user, 'parent');

    const formData = await request.formData();
    const v = parseFormData(createNoteSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    // Verify parent has access to this child
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

    if (!note) return fail(500, { error: 'Erreur lors de la création de la note' });
    return { success: true };
  },

  deleteNote: async ({ request, locals }) => {
    requireRole(locals.user, 'parent');

    const formData = await request.formData();
    const noteId = formData.get('noteId') as string;
    if (!noteId) return fail(400, { error: 'ID de note manquant' });

    // Verify parent owns this note's child
    const note = await getNoteById(locals.db, noteId);
    if (!note) return fail(404, { error: 'Note introuvable' });
    const child = await getChildById(locals.db, note.childId);
    assertChildAccess(child, locals.user);

    const success = await deleteNote(locals.db, noteId);
    if (!success) return fail(500, { error: 'Impossible de supprimer la note' });

    return { success: true, deleted: true };
  },

  markAsSeen: async ({ request, locals }) => {
    requireRole(locals.user, 'parent');

    const formData = await request.formData();
    const noteId = formData.get('noteId') as string;
    if (!noteId) return fail(400, { error: 'ID de note manquant' });

    // Verify parent owns this note's child
    const existing = await getNoteById(locals.db, noteId);
    if (!existing) return fail(404, { error: 'Note introuvable' });
    const child = await getChildById(locals.db, existing.childId);
    assertChildAccess(child, locals.user);

    const result = await markResponseAsSeen(locals.db, noteId);
    if (!result) return fail(500, { error: 'Erreur lors du marquage de la réponse' });

    return { success: true, markedAsSeen: noteId };
  }
};
