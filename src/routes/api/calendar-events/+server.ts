import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, createRateLimiter } from '$lib/server/helpers';
import { listCalendarEventsForAssistant, listCalendarEventsForParent } from '$lib/domain/parent_notes';

const checkRateLimit = createRateLimiter(30, 60_000);

export const GET: RequestHandler = async ({ locals, url }) => {
  requireAuth(locals.user);
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

  const events = locals.user.role === 'parent'
    ? await listCalendarEventsForParent(db, locals.user.id, { from, to })
    : await listCalendarEventsForAssistant(db, { from, to });

  return json(events, {
    headers: { 'Cache-Control': 'private, max-age=300' }
  });
};
