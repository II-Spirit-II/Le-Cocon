/**
 * Feed Page — Server
 */
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getNewsForChildren, createNews, updateNews, deleteNews, getNewsById } from '$lib/domain/news';
import { uploadNewsAttachment, deleteStorageFile, getNewsAttachmentSignedUrl } from '$lib/server/storage';
import { getChildById } from '$lib/domain/children';
import { requireAuth, requireRole, assertChildAccess } from '$lib/server/helpers';
import { createNewsSchema, updateNewsSchema, parseFormData } from '$lib/server/validation';

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireAuth(locals.user);

  const { children } = await parent();
  const childIds = children.map((c) => c.id);
  const news = await getNewsForChildren(locals.db, childIds, 50);
  const newsWithAttachmentUrls = await Promise.all(
    news.map(async (n) => {
      let attachmentUrl: string | null = null;
      if (n.attachmentPath) {
        attachmentUrl = await getNewsAttachmentSignedUrl(locals.db, n.id, n.attachmentPath);
      }
      return { ...n, attachmentUrl };
    })
  );

  return { news: newsWithAttachmentUrls, children, role: locals.user.role };
};

export const actions: Actions = {
  createNews: async ({ request, locals }) => {
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
        return fail(400, { error: uploadResult.error ?? 'Erreur lors du téléchargement' });
      }
      attachmentPath = uploadResult.path;
    }

    const news = await createNews(
      locals.db,
      { childId: v.data.childId, content: v.data.content, emoji: v.data.emoji, attachmentPath },
      locals.user.id
    );

    if (!news) return fail(500, { error: 'Erreur lors de la création de la news' });
    return { success: true };
  },

  updateNews: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const newsId = formData.get('newsId') as string;
    if (!newsId) return fail(400, { error: 'ID de la news manquant' });

    const v = parseFormData(updateNewsSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const existingNews = await getNewsById(locals.db, newsId);
    if (!existingNews) return fail(404, { error: 'News introuvable' });

    const child = await getChildById(locals.db, existingNews.childId);
    assertChildAccess(child, locals.user);

    let attachmentPath: string | null | undefined = undefined;
    if (formData.get('removeAttachment') === 'true' && existingNews.attachmentPath) {
      await deleteStorageFile(locals.db, 'news', existingNews.attachmentPath);
      attachmentPath = null;
    }

    const updated = await updateNews(locals.db, newsId, {
      content: v.data.content,
      emoji: v.data.emoji,
      attachmentPath,
    });

    if (!updated) return fail(500, { error: 'Erreur lors de la modification' });
    return { success: true, action: 'update' };
  },

  deleteNews: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const newsId = formData.get('newsId') as string;
    if (!newsId) return fail(400, { error: 'ID de la news manquant' });

    const existingNews = await getNewsById(locals.db, newsId);
    if (!existingNews) return fail(404, { error: 'News introuvable' });

    const child = await getChildById(locals.db, existingNews.childId);
    assertChildAccess(child, locals.user);

    if (existingNews.attachmentPath) {
      await deleteStorageFile(locals.db, 'news', existingNews.attachmentPath);
    }

    const deleted = await deleteNews(locals.db, newsId);
    if (!deleted) return fail(500, { error: 'Erreur lors de la suppression' });

    return { success: true, action: 'delete' };
  }
};
