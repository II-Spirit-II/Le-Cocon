/**
 * Email Verification — enter 6-digit code sent to user's email.
 */
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';
import { verifyEmailSchema, resendCodeSchema, parseFormData } from '$lib/server/validation';
import {
  getUserByEmail,
  verifyCode,
  markEmailVerified,
  createVerificationCode,
  canResendCode,
} from '$lib/domain/email-verification';
import { sendVerificationEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ url, locals }) => {
  if (locals.user?.emailVerified) throw redirect(303, '/app/overview');

  const email = url.searchParams.get('email') ?? '';
  const devMode = (env.EMAIL_PROVIDER || 'console') === 'console';

  return { email, devMode };
};

export const actions: Actions = {
  verify: async ({ request, locals }) => {
    const formData = await request.formData();
    const v = parseFormData(verifyEmailSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const user = await getUserByEmail(locals.db, v.data.email);
    if (!user) return fail(400, { error: 'Utilisateur introuvable.' });

    if (user.emailVerified) throw redirect(303, '/login?verified=true');

    const result = await verifyCode(locals.db, user.id, v.data.code);

    switch (result) {
      case 'ok':
        await markEmailVerified(locals.db, user.id);
        throw redirect(303, '/login?verified=true');

      case 'invalid':
        return fail(400, { error: 'Code incorrect. Vérifiez et réessayez.' });

      case 'expired':
        return fail(400, { error: 'Code expiré. Demandez un nouveau code.' });

      case 'too_many_attempts':
        return fail(400, { error: 'Trop de tentatives. Demandez un nouveau code.' });
    }
  },

  resend: async ({ request, locals }) => {
    const formData = await request.formData();
    const v = parseFormData(resendCodeSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const user = await getUserByEmail(locals.db, v.data.email);
    if (!user) return fail(400, { error: 'Utilisateur introuvable.' });

    if (user.emailVerified) throw redirect(303, '/login?verified=true');

    const allowed = await canResendCode(locals.db, user.id);
    if (!allowed) {
      return fail(429, { error: 'Veuillez patienter avant de renvoyer un code.' });
    }

    const verification = await createVerificationCode(locals.db, user.id);
    if (!verification) return fail(500, { error: 'Erreur lors de la génération du code' });
    const { devCode } = await sendVerificationEmail(v.data.email, verification.code);

    return { resent: true, devCode };
  },
};
