import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/helpers';
import { getChildrenForUser } from '$lib/domain/children';
import { getAllDailyLogs } from '$lib/domain/daily_logs';
import { getNewsForChildren } from '$lib/domain/news';
import { getNotesForParent, getNotesForAssistant } from '$lib/domain/parent_notes';

// RGPD Article 20 — Right to data portability
export const GET: RequestHandler = async ({ locals }) => {
  requireAuth(locals.user);

  const { id, email, name, role, createdAt } = locals.user;
  const db = locals.db;

  // Fetch all children accessible to this user
  const children = await getChildrenForUser(db, id, role);
  const childIds = children.map((c) => c.id);

  // Fetch related data in parallel
  const [dailyLogs, news, notes] = await Promise.all([
    childIds.length > 0 ? getAllDailyLogs(db, { childIds }) : Promise.resolve([]),
    childIds.length > 0 ? getNewsForChildren(db, childIds) : Promise.resolve([]),
    role === 'parent'
      ? getNotesForParent(db, id)
      : getNotesForAssistant(db, id)
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    profile: { email, name, role, createdAt },
    children,
    dailyLogs,
    news,
    notes
  };

  return json(exportData, {
    headers: {
      'Content-Disposition': 'attachment; filename="lecocon-export.json"',
      'Cache-Control': 'no-store'
    }
  });
};
