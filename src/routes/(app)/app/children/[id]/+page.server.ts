/**
 * Child Dashboard — Server
 */
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getChildById, updateChildAvatar, updateChild } from '$lib/domain/children';
import { createInviteCode, getInviteCodesForChild, deleteInviteCode } from '$lib/domain/invites';
import { getDailyLogsForChild } from '$lib/domain/daily_logs';
import { getNewsForChild } from '$lib/domain/news';
import { getCalendarInsights, countUnacknowledgedNotes } from '$lib/domain/parent_notes';
import { uploadChildAvatar, getAvatarPublicUrl } from '$lib/server/storage';
import { getChildAvatarUrl } from '$lib/utils/avatar';
import { requireAuth, requireRole, assertChildAccess, toLocalDateStr } from '$lib/server/helpers';
import { careScheduleSchema } from '$lib/server/validation';
import type { CareSchedule } from '$lib/types';

/** Monday of the week containing `date` (ISO string YYYY-MM-DD). */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon …
  const diff = day === 0 ? 6 : day - 1; // shift so Monday = 0
  d.setDate(d.getDate() - diff);
  return toLocalDateStr(d);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
  requireAuth(locals.user);

  const child = await getChildById(locals.db, params.id);
  if (!child) throw error(404, 'Enfant non trouve');

  assertChildAccess(child, locals.user);

  const role = locals.user.role;
  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

  if (role === 'parent') {
    // Week-based journal loading for carnet de suivi
    const weekParam = url.searchParams.get('week');
    const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? getWeekStart(weekParam)
      : getWeekStart(today);
    const weekEnd = addDays(weekStart, 6);

    const [weekLogs, recentNews, insights] = await Promise.all([
      getDailyLogsForChild(locals.db, params.id, { startDate: weekStart, endDate: weekEnd }),
      getNewsForChild(locals.db, params.id, 5),
      getCalendarInsights(locals.db, params.id)
    ]);

    const avatarUrl = child.avatarPath
      ? await getAvatarPublicUrl(locals.db, child.id, child.avatarPath)
      : getChildAvatarUrl(child.firstName + ' ' + child.lastName);

    return {
      child,
      avatarUrl,
      recentLogs: weekLogs,
      recentNews,
      insights,
      today,
      weekStart,
      weekEnd,
      role,
      // Not used by parent but keeps types consistent
      inviteCodes: [],
      pendingNotesCount: 0
    };
  }

  // Assistante: week-based view (same as parent) + invite codes
  const weekParam = url.searchParams.get('week');
  const weekStartA = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? getWeekStart(weekParam)
    : getWeekStart(today);
  const weekEndA = addDays(weekStartA, 6);

  const [inviteCodes, weekLogs, recentNews, insights, pendingNotesCount] = await Promise.all([
    getInviteCodesForChild(locals.db, params.id),
    getDailyLogsForChild(locals.db, params.id, { startDate: weekStartA, endDate: weekEndA }),
    getNewsForChild(locals.db, params.id, 5),
    getCalendarInsights(locals.db, params.id),
    countUnacknowledgedNotes(locals.db, locals.user.id, params.id)
  ]);

  const avatarUrl = child.avatarPath
    ? await getAvatarPublicUrl(locals.db, child.id, child.avatarPath)
    : null;

  return {
    child,
    inviteCodes,
    avatarUrl,
    recentLogs: weekLogs,
    recentNews,
    insights,
    pendingNotesCount,
    today,
    weekStart: weekStartA,
    weekEnd: weekEndA,
    role
  };
};

export const actions: Actions = {
  generateCode: async ({ params, locals }) => {
    requireRole(locals.user, 'assistante');

    const child = await getChildById(locals.db, params.id);
    assertChildAccess(child, locals.user);

    const { code, error: codeError } = await createInviteCode(locals.db, params.id, locals.user.id);
    if (codeError) return fail(500, { error: codeError });

    return { success: true, newCode: code };
  },

  deleteCode: async ({ request, params, locals }) => {
    requireRole(locals.user, 'assistante');

    const child = await getChildById(locals.db, params.id);
    assertChildAccess(child, locals.user);

    const formData = await request.formData();
    const codeId = formData.get('codeId')?.toString();
    if (!codeId) return fail(400, { error: 'Code ID requis' });

    const { success, error: deleteError } = await deleteInviteCode(locals.db, codeId);
    if (!success) return fail(500, { error: deleteError });

    return { deleted: true };
  },

  uploadAvatar: async ({ params, request, locals }) => {
    requireRole(locals.user, 'assistante');

    const child = await getChildById(locals.db, params.id);
    assertChildAccess(child, locals.user);

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file || file.size === 0) return fail(400, { error: 'Aucun fichier sélectionné' });

    const result = await uploadChildAvatar(locals.db, params.id, file);
    if (!result.success) return fail(400, { error: result.error ?? 'Erreur lors du téléchargement' });

    const updated = await updateChildAvatar(locals.db, params.id, result.path!);
    if (!updated) return fail(500, { error: 'Erreur lors de la mise à jour' });

    return { avatarUploaded: true };
  },

  deleteAvatar: async ({ params, locals }) => {
    requireRole(locals.user, 'assistante');

    const child = await getChildById(locals.db, params.id);
    assertChildAccess(child, locals.user);
    if (!child?.avatarPath) return fail(400, { error: 'Aucun avatar à supprimer' });

    const updated = await updateChildAvatar(locals.db, params.id, null);
    if (!updated) return fail(500, { error: 'Erreur lors de la suppression' });

    return { avatarDeleted: true };
  },

  updateSchedule: async ({ params, request, locals }) => {
    requireRole(locals.user, 'assistante');

    const child = await getChildById(locals.db, params.id);
    assertChildAccess(child, locals.user);

    const formData = await request.formData();
    const raw = formData.get('careSchedule')?.toString() ?? '{}';

    let careSchedule: CareSchedule = {};
    try {
      const parsed = JSON.parse(raw);
      const result = careScheduleSchema.safeParse(parsed);
      if (!result.success) {
        return fail(400, { error: result.error.issues[0]?.message ?? 'Horaires invalides' });
      }
      careSchedule = result.data ?? {};
    } catch {
      return fail(400, { error: 'Format invalide' });
    }

    const ok = await updateChild(locals.db, params.id, { careSchedule });
    if (!ok) return fail(500, { error: 'Erreur lors de la sauvegarde' });

    return { scheduleUpdated: true };
  }
};
