/**
 * Login — Server Action
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { authenticateUser, createSession, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from '$lib/server/auth';
import { loginSchema, parseFormData } from '$lib/server/validation';
import { createVerificationCode, getUserByEmail } from '$lib/domain/email-verification';
import { sendVerificationEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.emailVerified) throw redirect(303, '/app/overview');
  return {
    redirectUrl: url.searchParams.get('redirect') ?? '/app/overview',
    verified: url.searchParams.get('verified') === 'true',
  };
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const v = parseFormData(loginSchema, formData);
    if (!v.ok) return fail(400, { error: v.error, email: formData.get('email') as string, unverified: false });

    const result = await authenticateUser(v.data.email, v.data.password);
    if (!result) {
      return fail(400, { error: 'Email ou mot de passe incorrect', email: v.data.email, unverified: false });
    }

    // Block unverified users and redirect them to verification
    if (!result.user.emailVerified) {
      const dbUser = await getUserByEmail(locals.db, v.data.email);
      if (dbUser) {
        const result2 = await createVerificationCode(locals.db, dbUser.id);
        if (result2) await sendVerificationEmail(v.data.email, result2.code);
      }
      return fail(403, {
        error: 'Veuillez vérifier votre adresse email avant de vous connecter.',
        email: v.data.email,
        unverified: true,
      });
    }

    cookies.set(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
    await createSession(locals.db, result.user.id, result.token, request.headers.get('user-agent') ?? '');
    throw redirect(303, v.data.redirectUrl);
  }
};
