/**
 * Settings Page — Server
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { uploadProfileAvatar, deleteStorageFile, getAvatarPublicUrl } from '$lib/server/storage';
import { getAdultAvatarUrl } from '$lib/utils/avatar';
import { invalidateUserCache, getActiveSessions, revokeAllSessions, verifyPassword, AUTH_COOKIE_NAME } from '$lib/server/auth';
import { requireAuth, requireRole } from '$lib/server/helpers';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  requireAuth(locals.user);

  const token = cookies.get(AUTH_COOKIE_NAME) ?? '';
  const activeSessions = await getActiveSessions(locals.db, locals.user.id, token);

  return {
    user: locals.user,
    hasCustomAvatar: !!locals.user.avatarPath && !locals.user.avatarPath.startsWith('https://'),
    avatarUrl: locals.user.avatarPath
      ? (locals.user.avatarPath.startsWith('https://') ? locals.user.avatarPath : await getAvatarPublicUrl(locals.db, locals.user.id, locals.user.avatarPath))
      : getAdultAvatarUrl(locals.user.name),
    defaultNapStart: locals.user.defaultNapStart ?? null,
    defaultNapEnd: locals.user.defaultNapEnd ?? null,
    activeSessions,
  };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    requireAuth(locals.user);

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim();

    if (!name || name.length < 2) return fail(400, { error: 'Le nom doit contenir au moins 2 caractères' });
    if (name.length > 100) return fail(400, { error: 'Le nom ne doit pas dépasser 100 caractères' });

    await locals.db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, locals.user.id));

    invalidateUserCache(locals.user.id);
    return { success: true, message: 'Profil mis à jour' };
  },

  uploadAvatar: async ({ request, locals }) => {
    requireAuth(locals.user);

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file || file.size === 0) return fail(400, { error: 'Aucun fichier sélectionné' });

    const result = await uploadProfileAvatar(locals.db, locals.user.id, file);
    if (!result.success) return fail(400, { error: result.error ?? 'Erreur lors du téléchargement' });

    const [updated] = await locals.db.update(users)
      .set({ avatar: result.path, updatedAt: new Date() })
      .where(eq(users.id, locals.user.id))
      .returning({ id: users.id });

    if (!updated) return fail(500, { error: 'Impossible de mettre à jour le profil' });

    invalidateUserCache(locals.user.id);
    return { success: true, message: 'Avatar mis à jour', avatarPath: result.path };
  },

  updateNapDefaults: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');

    const formData = await request.formData();
    const napStart = formData.get('default_nap_start')?.toString().trim() || null;
    const napEnd = formData.get('default_nap_end')?.toString().trim() || null;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (napStart && !timeRegex.test(napStart)) {
      return fail(400, { error: 'Format d\'heure invalide (HH:MM)' });
    }
    if (napEnd && !timeRegex.test(napEnd)) {
      return fail(400, { error: 'Format d\'heure invalide (HH:MM)' });
    }

    await locals.db
      .update(users)
      .set({ defaultNapStart: napStart, defaultNapEnd: napEnd, updatedAt: new Date() })
      .where(eq(users.id, locals.user.id));

    invalidateUserCache(locals.user.id);
    return { success: true, message: 'Horaires de sieste mis à jour' };
  },

  revokeAllSessions: async ({ locals, cookies }) => {
    requireAuth(locals.user);

    const currentToken = cookies.get(AUTH_COOKIE_NAME) ?? '';
    const count = await revokeAllSessions(locals.db, locals.user.id, currentToken);

    return { success: true, message: `${count} session${count > 1 ? 's' : ''} déconnectée${count > 1 ? 's' : ''}` };
  },

  deleteAccount: async ({ request, locals, cookies }) => {
    requireAuth(locals.user);

    const formData = await request.formData();
    const password = formData.get('password')?.toString() ?? '';

    if (!password) return fail(400, { error: 'Veuillez saisir votre mot de passe' });

    const [row] = await locals.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, locals.user.id))
      .limit(1);

    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      return fail(403, { error: 'Mot de passe incorrect' });
    }

    await revokeAllSessions(locals.db, locals.user.id);
    await locals.db.delete(users).where(eq(users.id, locals.user.id));
    invalidateUserCache(locals.user.id);

    cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
    throw redirect(303, '/');
  },

  deleteAvatar: async ({ locals }) => {
    requireAuth(locals.user);

    if (!locals.user.avatarPath) return fail(400, { error: 'Aucun avatar à supprimer' });

    await deleteStorageFile(locals.db, 'avatars', locals.user.avatarPath);
    const [cleared] = await locals.db
      .update(users)
      .set({ avatar: '', updatedAt: new Date() })
      .where(eq(users.id, locals.user.id))
      .returning({ id: users.id });

    if (!cleared) return fail(500, { error: 'Impossible de supprimer l\'avatar' });

    invalidateUserCache(locals.user.id);
    return { success: true, message: 'Avatar supprimé' };
  }
};
