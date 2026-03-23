import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AUTH_COOKIE_NAME, revokeSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (token) {
    await revokeSession(locals.db, token);
  }
  cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
  throw redirect(303, '/');
};
