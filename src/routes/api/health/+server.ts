import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const headers = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({ locals }) => {
  try {
    await locals.db.execute(sql`SELECT 1`);
    return json({ status: 'ok', db: 'connected' }, { headers });
  } catch {
    return json({ status: 'degraded', db: 'unreachable' }, { status: 503, headers });
  }
};
