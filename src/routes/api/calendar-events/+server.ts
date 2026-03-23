import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole, createRateLimiter } from '$lib/server/helpers';
import { listCalendarEventsForAssistant } from '$lib/domain/parent_notes';

const checkRateLimit = createRateLimiter(30, 60_000);

export const GET: RequestHandler = async ({ locals, url }) => {
  requireRole(locals.user, 'assistante');
  if (!checkRateLimit(locals.user.id)) {
    return json({ error: 'Trop de requêtes' }, { status: 429 });
  }
  const { db } = locals;

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
    return json({ error: 'Paramètres from/to requis au format YYYY-MM-DD' }, { status: 400 });
  }

  const events = await listCalendarEventsForAssistant(db, { from, to });
  return json(events, {
    headers: { 'Cache-Control': 'private, max-age=300' }
  });
};
