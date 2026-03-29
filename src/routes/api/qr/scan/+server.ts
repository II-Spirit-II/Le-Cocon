/**
 * POST /api/qr/scan — Assistante scans a parent's QR token.
 * Returns the parent info + their children's attendance status.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyQrToken } from '$lib/server/qr';
import { getChildrenForUser } from '$lib/domain/children';
import { getAttendancesByDate } from '$lib/domain/attendance';
import { createRateLimiter } from '$lib/server/helpers';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const checkRate = createRateLimiter(30, 60_000);

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db, user } = locals;
  if (!user) throw error(401, 'Non authentifié');
  if (user.role !== 'assistante') throw error(403, 'Réservé aux assistantes');

  if (!checkRate(user.id)) {
    return json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Corps de requête invalide');
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) throw error(400, 'Token manquant');

  // Verify QR token
  const result = verifyQrToken(token);
  if (!result) {
    return json({ error: 'QR code expiré ou invalide. Demandez au parent de rafraîchir son code.' }, { status: 401 });
  }

  // Get parent info
  const [parentRow] = await db.select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, result.parentId));

  if (!parentRow) {
    return json({ error: 'Parent introuvable' }, { status: 404 });
  }

  // Get parent's children
  const parentChildren = await getChildrenForUser(db, result.parentId, 'parent');

  // Filter: only children managed by this assistante
  const myChildren = parentChildren.filter(c => c.assistanteId === user.id);

  if (myChildren.length === 0) {
    return json({ error: 'Aucun enfant de ce parent n\'est dans votre structure' }, { status: 404 });
  }

  // Get today's attendance for these children
  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const allAttendances = await getAttendancesByDate(db, user.id, today);

  const childrenStatus = myChildren.map(child => {
    const att = allAttendances.find(a => a.childId === child.id);
    const isPresent = att?.id && att.arrivalTime && !att.departureTime && att.status === 'present';
    const hasDeparted = att?.id && att.arrivalTime && att.departureTime && att.status === 'present';
    const isAbsent = att?.id && (att.status === 'absent_planned' || att.status === 'absent_unplanned');

    return {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      avatarPath: child.avatarPath ?? null,
      status: isPresent ? 'present' as const
        : hasDeparted ? 'departed' as const
        : isAbsent ? 'absent' as const
        : 'expected' as const,
      arrivalTime: att?.arrivalTime ?? null,
    };
  });

  return json({
    parentId: result.parentId,
    parentName: parentRow.name,
    children: childrenStatus,
  });
};
