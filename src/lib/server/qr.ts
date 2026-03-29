/**
 * QR Code token generation and verification.
 * Uses short-lived JWTs (2 min) signed with JWT_SECRET for secure QR check-in/out.
 */
import { env } from '$env/dynamic/private';
import { createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import { toString as qrToString, toDataURL as qrToDataURL } from 'qrcode';

const QR_TOKEN_EXPIRY = 120; // 2 minutes in seconds

interface QrPayload {
  sub: string;
  purpose: 'qr_checkin';
  iat?: number;
  exp?: number;
}

let _qrSecret: string | null = null;

/** Derive a dedicated signing key for QR tokens — prevents token confusion with auth JWTs. */
function getQrSecret(): string {
  if (_qrSecret) return _qrSecret;
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET doit être défini et contenir au moins 32 caractères');
  }
  _qrSecret = createHmac('sha256', secret).update('qr_checkin_v1').digest('hex');
  return _qrSecret;
}

/** Sign a short-lived JWT for QR code display. */
export function generateQrToken(parentId: string): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload: QrPayload = {
    sub: parentId,
    purpose: 'qr_checkin',
  };
  const token = jwt.sign(payload, getQrSecret(), { expiresIn: QR_TOKEN_EXPIRY });
  return { token, expiresAt: (now + QR_TOKEN_EXPIRY) * 1000 };
}

/** Verify a QR token and extract the parent ID. Returns null if invalid/expired. */
export function verifyQrToken(token: string): { parentId: string } | null {
  try {
    const decoded = jwt.verify(token, getQrSecret()) as QrPayload;
    if (decoded.purpose !== 'qr_checkin') return null;
    if (!decoded.sub) return null;
    return { parentId: decoded.sub };
  } catch {
    return null;
  }
}

/** Generate a QR code as SVG string from arbitrary data. */
export async function generateQrSvg(data: string): Promise<string> {
  return qrToString(data, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1A1612',  // nuit
      light: '#00000000', // transparent background
    },
  });
}

/** Generate a QR code as data URL (PNG) — fallback if SVG rendering fails. */
export async function generateQrDataUrl(data: string): Promise<string> {
  return qrToDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1A1612',
      light: '#FFF8F0', // soie background
    },
  });
}
