/**
 * Inbox Page — Server
 *
 * Assistante-facing: receive and respond to parent notes.
 */
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getNotesForAssistant, acknowledgeNote, respondToNote, getNoteById } from '$lib/domain/parent_notes';
import { getChildById } from '$lib/domain/children';
import { requireRole, assertChildAccess } from '$lib/server/helpers';
import { respondToNoteSchema, parseFormData } from '$lib/server/validation';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'assistante') throw redirect(302, '/app/notes');

  const notes = await getNotesForAssistant(locals.db, locals.user.id, { limit: 50 });

  return { notes, role: locals.user.role };
};

export const actions: Actions = {
  acknowledge: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const noteId = formData.get('noteId') as string;
    if (!noteId) return fail(400, { error: 'ID de note manquant' });

    // Verify assistante manages this note's child
    const existing = await getNoteById(locals.db, noteId);
    if (!existing) return fail(404, { error: 'Note introuvable' });
    const child = await getChildById(locals.db, existing.childId);
    assertChildAccess(child, locals.user);

    const note = await acknowledgeNote(locals.db, noteId, locals.user.id);
    if (!note) return fail(500, { error: 'Erreur lors de l\'acquittement' });

    return { success: true, acknowledged: noteId };
  },

  respond: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const v = parseFormData(respondToNoteSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    // Verify assistante manages this note's child
    const existing = await getNoteById(locals.db, v.data.noteId);
    if (!existing) return fail(404, { error: 'Note introuvable' });
    const child = await getChildById(locals.db, existing.childId);
    assertChildAccess(child, locals.user);

    const note = await respondToNote(locals.db, v.data.noteId, v.data.response, locals.user.id);
    if (!note) return fail(500, { error: 'Erreur lors de l\'envoi de la réponse' });

    return { success: true, responded: v.data.noteId };
  }
};
