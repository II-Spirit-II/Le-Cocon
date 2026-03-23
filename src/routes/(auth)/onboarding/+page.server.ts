/**
 * Onboarding — Server Action
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createUser } from '$lib/server/auth';
import { signupSchema, parseFormData } from '$lib/server/validation';
import { createRateLimiter } from '$lib/server/helpers';
import { getAdultAvatarUrl } from '$lib/utils/avatar';
import { eq } from 'drizzle-orm';
import { users, userConsents } from '$lib/server/db/schema';
import { createVerificationCode } from '$lib/domain/email-verification';
import { sendVerificationEmail } from '$lib/server/email';

const signupLimiter = createRateLimiter(5, 15 * 60_000);

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user?.emailVerified) throw redirect(303, '/app/overview');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const formData = await request.formData();
    const v = parseFormData(signupSchema, formData);
    if (!v.ok) {
      return fail(400, {
        error: v.error,
        email: formData.get('email') as string,
        name: formData.get('name') as string,
      });
    }

    if (!signupLimiter(v.data.email)) {
      return fail(429, {
        error: 'Trop de tentatives. Réessayez dans quelques minutes.',
        email: v.data.email,
        name: v.data.name,
      });
    }

    // RGPD consent check
    const consent = formData.get('consent');
    if (consent !== 'on') {
      return fail(400, {
        error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
        email: v.data.email,
        name: v.data.name,
      });
    }

    const user = await createUser(v.data);
    if (!user) {
      return fail(400, {
        error: 'Cet email est déjà utilisé. Essayez de vous connecter.',
        email: v.data.email,
        name: v.data.name,
      });
    }

    // Store chosen DiceBear avatar URL
    const seed = formData.get('avatarSeed')?.toString() ?? '0';
    const avatarSeed = parseInt(seed, 10);
    const avatarName = v.data.name + (avatarSeed > 0 ? ` ${avatarSeed}` : '');
    const avatarUrl = getAdultAvatarUrl(avatarName);

    await locals.db.update(users)
      .set({ avatar: avatarUrl })
      .where(eq(users.email, v.data.email));

    // Record RGPD consent
    await locals.db.insert(userConsents).values({
      userId: user.id,
      version: '1.0',
    });

    // Send verification email
    const verification = await createVerificationCode(locals.db, user.id);
    if (verification) await sendVerificationEmail(v.data.email, verification.code);

    throw redirect(303, `/verify-email?email=${encodeURIComponent(v.data.email)}`);
  }
};
