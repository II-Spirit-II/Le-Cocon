/**
 * POST /api/qr/generate — Parent requests a fresh QR code token.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateQrToken, generateQrSvg, generateQrDataUrl } from '$lib/server/qr';
import { createRateLimiter } from '$lib/server/helpers';

const checkRate = createRateLimiter(30, 60_000);

export const POST: RequestHandler = async ({ locals }) => {
  const { user } = locals;
  if (!user) throw error(401, 'Non authentifié');
  if (user.role !== 'parent') throw error(403, 'Réservé aux parents');

  if (!checkRate(user.id)) {
    return json({ error: 'Trop de requêtes, réessayez dans un instant' }, { status: 429 });
  }

  const { token, expiresAt } = generateQrToken(user.id);
  const [svg, dataUrl] = await Promise.all([
    generateQrSvg(token),
    generateQrDataUrl(token),
  ]);

  return json({ token, svg, dataUrl, expiresAt });
};
