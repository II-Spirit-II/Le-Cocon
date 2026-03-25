/**
 * New News — Server
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createNews } from '$lib/domain/news';
import { getChildById } from '$lib/domain/children';
import { uploadNewsAttachment } from '$lib/server/storage';
import { requireRole, assertChildAccess } from '$lib/server/helpers';
import { createNewsSchema, parseFormData } from '$lib/server/validation';
import { getChildAvatarUrl } from '$lib/utils/avatar';
import { getAvatarPublicUrl } from '$lib/server/storage';

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireRole(locals.user, 'assistante');

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
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const v = parseFormData(createNewsSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const child = await getChildById(locals.db, v.data.childId);
    assertChildAccess(child, locals.user);

    // Handle attachment upload
    const attachment = formData.get('attachment') as File | null;
    let attachmentPath: string | undefined;
    if (attachment && attachment.size > 0) {
      const tempId = crypto.randomUUID();
      const uploadResult = await uploadNewsAttachment(locals.db, v.data.childId, tempId, attachment);
      if (!uploadResult.success) {
        return fail(400, { error: uploadResult.error ?? 'Erreur lors du telechargement' });
      }
      attachmentPath = uploadResult.path;
    }

    const news = await createNews(
      locals.db,
      { childId: v.data.childId, content: v.data.content, emoji: v.data.emoji, attachmentPath },
      locals.user.id
    );

    if (!news) return fail(500, { error: 'Erreur lors de la creation de la news' });

    throw redirect(303, '/app/feed');
  }
};
