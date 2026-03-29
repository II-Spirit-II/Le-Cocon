import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getDb, closeDb, warmupDb } from '$lib/server/db';
import { getUserFromToken, isSessionValid, AUTH_COOKIE_NAME } from '$lib/server/auth';

// Fire-and-forget: starts DB connection in background while Vite finishes compiling.
// By the time the developer opens the browser, the pool is likely already connected.
warmupDb().catch(() => {});

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = getDb();
  event.locals.user = null;

  const token = event.cookies.get(AUTH_COOKIE_NAME);

  if (token) {
    try {
      const user = await getUserFromToken(token);
      if (user) {
        // Verify the session hasn't been revoked
        const sessionValid = await isSessionValid(event.locals.db, token);
        if (sessionValid) {
          event.locals.user = user;
        } else {
          event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
        }
      } else {
        // Token expired or user deleted — clear stale cookie
        event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
      }
    } catch {
      event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
    }
  }

  // Auth guard: redirect unauthenticated users away from /app/*
  if (!event.locals.user && event.url.pathname.startsWith('/app')) {
    const returnUrl = encodeURIComponent(event.url.pathname);
    throw redirect(303, `/login?redirect=${returnUrl}`);
  }

  // Email verification guard: unverified users cannot access /app/*
  if (event.locals.user && !event.locals.user.emailVerified && event.url.pathname.startsWith('/app')) {
    throw redirect(303, `/verify-email?email=${encodeURIComponent(event.locals.user.email)}`);
  }

  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // camera must stay unrestricted — iOS Safari rejects camera=(self) and blocks getUserMedia entirely
  response.headers.set('Permissions-Policy', 'microphone=(), geolocation=()');

  // CSP is handled by SvelteKit via svelte.config.js (auto nonce injection for inline scripts)
  // Only set fallback CSP if SvelteKit didn't generate one (e.g. prerendered pages)
  if (!response.headers.has('content-security-policy')) {
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://s3.fr-par.scw.cloud https://api.dicebear.com; connect-src 'self' https://api.scaleway.ai https://api.scaleway.com; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }

  return response;
};

// Graceful shutdown: drain DB pool when server stops
process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
