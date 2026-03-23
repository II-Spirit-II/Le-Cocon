import { redirect } from '@sveltejs/kit';
import { getChildrenForUser } from '$lib/domain/children';
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

  return {
    user: locals.user,
    avatarUrl,
    children,
    badges: {
      unacknowledgedNotesCount: 0,
      unseenResponsesCount: 0
    }
  };
};
