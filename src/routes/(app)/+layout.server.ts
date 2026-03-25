import { redirect } from '@sveltejs/kit';
import { getChildrenForUser } from '$lib/domain/children';
import { countUnacknowledgedNotes, countUnseenResponses } from '$lib/domain/parent_notes';
import { getAvatarPublicUrl } from '$lib/server/storage';
import { getAdultAvatarUrl } from '$lib/utils/avatar';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  // Auth already enforced by hooks.server.ts — fallback redirect
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // Prevent re-run on every client-side navigation
  depends('app:layout');

  const children = await getChildrenForUser(locals.db, locals.user.id, locals.user.role);

  const avatarUrl = locals.user.avatarPath
    ? (locals.user.avatarPath.startsWith('https://') ? locals.user.avatarPath : await getAvatarPublicUrl(locals.db, locals.user.id, locals.user.avatarPath))
    : getAdultAvatarUrl(locals.user.name);

  // Load notification badges based on role
  const [unacknowledgedNotesCount, unseenResponsesCount] = await Promise.all([
    locals.user.role === 'assistante'
      ? countUnacknowledgedNotes(locals.db, locals.user.id)
      : Promise.resolve(0),
    locals.user.role === 'parent'
      ? countUnseenResponses(locals.db, locals.user.id)
      : Promise.resolve(0),
  ]);

  return {
    user: locals.user,
    avatarUrl,
    children,
    badges: {
      unacknowledgedNotesCount,
      unseenResponsesCount
    }
  };
};
