/**
 * POST /api/qr/confirm — Assistante confirms arrival/departure for scanned children.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChildById } from '$lib/domain/children';
import { markArrival, markDeparture } from '$lib/domain/attendance';
import { assertChildAccess, createRateLimiter } from '$lib/server/helpers';

const checkRate = createRateLimiter(30, 60_000);

interface ConfirmBody {
  action: 'checkin' | 'checkout';
  parentId: string;
  childIds: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db, user } = locals;
  if (!user) throw error(401, 'Non authentifié');
  if (user.role !== 'assistante') throw error(403, 'Réservé aux assistantes');

  if (!checkRate(user.id)) {
    return json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  let body: ConfirmBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Corps de requête invalide');
  }

  const { action, parentId, childIds } = body;

  if (!action || !['checkin', 'checkout'].includes(action)) {
    throw error(400, 'Action invalide');
  }
  if (!parentId || !Array.isArray(childIds) || childIds.length === 0) {
    throw error(400, 'Données manquantes');
  }

  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  let successCount = 0;

  for (const childId of childIds) {
    // Verify each child belongs to the parent AND this assistante
    const child = await getChildById(db, childId);
    if (!child) continue;

    // Check assistante manages this child
    if (child.assistanteId !== user.id) continue;

    // Check parent is linked to this child
    if (!child.parentIds.includes(parentId)) continue;

    if (action === 'checkin') {
      const result = await markArrival(db, {
        childId,
        date: today,
        personType: 'parent',
        personId: parentId,
        method: 'qr',
        scannedBy: user.id,
      });
      if (result) successCount++;
    } else {
      const result = await markDeparture(db, {
        childId,
        date: today,
        personType: 'parent',
        personId: parentId,
        method: 'qr',
        scannedBy: user.id,
      });
      if (result) successCount++;
    }
  }

  if (successCount === 0) {
    return json({ error: 'Aucun pointage effectué' }, { status: 400 });
  }

  return json({ success: true, count: successCount });
};
