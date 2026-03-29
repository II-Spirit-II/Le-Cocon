import { env } from '$env/dynamic/private';
import { eq, and, isNull, gte } from 'drizzle-orm';
import { createHash } from 'crypto';
import { getDb } from './db';
import type { DrizzleDB } from './db';
import { users, sessions } from './db/schema';
import { createRateLimiter } from './helpers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '$lib/types/auth';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  avatarPath?: string;
  defaultNapStart?: string;
  defaultNapEnd?: string;
  createdAt: string;
}

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '3d';

// Pre-computed dummy hash for constant-time user enumeration prevention
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lg2VBe6JBMYOJekyOdnXv9QDFkFmtJMOoKqXG1bXpFbWe';

// In-memory user cache — avoids a DB query on every request
const USER_CACHE_TTL = 5 * 60_000; // 5 min
const userCache = new Map<string, { user: AuthUser; expiresAt: number }>();

/** Evict a user from the auth cache (call after profile update, logout, etc.) */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

// Cache secret at module level — avoids env lookup on every JWT op
let _secret: string | null = null;

function getSecret(): string {
  if (_secret) return _secret;
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET doit être défini et contenir au moins 32 caractères');
  }
  _secret = secret;
  return _secret;
}

// Brute-force protection: 10 attempts per email per 15 min
const loginLimiter = createRateLimiter(10, 15 * 60_000);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit by email to prevent brute-force
  if (!loginLimiter(normalizedEmail)) return null;

  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!row) {
    // Constant-time: always run bcrypt to prevent email enumeration via timing
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return null;

  const token = signToken({ userId: row.id, email: row.email, role: row.role });

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      emailVerified: row.emailVerified,
      avatarPath: row.avatar || undefined,
      defaultNapStart: row.defaultNapStart || undefined,
      defaultNapEnd: row.defaultNapEnd || undefined,
      createdAt: row.createdAt.toISOString(),
    },
    token,
  };
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const cached = userCache.get(payload.userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.user;
  }

  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!row) return null;

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: row.emailVerified,
    avatarPath: row.avatar || undefined,
    defaultNapStart: row.defaultNapStart || undefined,
    defaultNapEnd: row.defaultNapEnd || undefined,
    createdAt: row.createdAt.toISOString(),
  };

  userCache.set(payload.userId, { user, expiresAt: Date.now() + USER_CACHE_TTL });

  // Cleanup stale entries periodically
  if (userCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of userCache) {
      if (now > v.expiresAt) userCache.delete(k);
    }
  }

  return user;
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<AuthUser | null> {
  const db = getDb();
  const passwordHash = await hashPassword(data.password);

  try {
    const [row] = await db.insert(users).values({
      email: data.email.toLowerCase().trim(),
      passwordHash,
      name: data.name.trim(),
      role: data.role,
    }).returning();

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      emailVerified: false,
      createdAt: row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = 'auth_token';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 3,
};

// ── Session management ──────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionInfo {
  id: string;
  userAgent: string;
  createdAt: string;
  isCurrent: boolean;
}

/** Create a session record in DB for the given token. */
export async function createSession(
  db: DrizzleDB,
  userId: string,
  token: string,
  userAgent: string
): Promise<void> {
  try {
    await db.insert(sessions).values({
      userId,
      tokenHash: hashToken(token),
      userAgent: userAgent || '',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
  } catch {
    // Silent fail — session creation is best-effort
  }
}

/** Check if a token has an active (non-revoked, non-expired) session. */
export async function isSessionValid(db: DrizzleDB, token: string): Promise<boolean> {
  try {
    const [row] = await db.select({ id: sessions.id })
      .from(sessions)
      .where(and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gte(sessions.expiresAt, new Date()),
      ))
      .limit(1);
    return !!row;
  } catch {
    return false;
  }
}

/** Revoke the session for a specific token. */
export async function revokeSession(db: DrizzleDB, token: string): Promise<void> {
  try {
    await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  } catch {
    // Silent fail — session revocation is best-effort
  }
}

/** Revoke all sessions for a user, optionally except one token. */
export async function revokeAllSessions(
  db: DrizzleDB,
  userId: string,
  exceptToken?: string
): Promise<number> {
  try {
    const rows = await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ))
      .returning({ id: sessions.id, tokenHash: sessions.tokenHash });

    // Re-activate the excepted session if provided
    if (exceptToken && rows.length > 0) {
      await db.update(sessions)
        .set({ revokedAt: null })
        .where(eq(sessions.tokenHash, hashToken(exceptToken)));
    }

    return exceptToken ? rows.length - 1 : rows.length;
  } catch {
    // Silent fail — session revocation is best-effort
    return 0;
  }
}

/** List active sessions for a user. */
export async function getActiveSessions(
  db: DrizzleDB,
  userId: string,
  currentToken: string
): Promise<SessionInfo[]> {
  try {
    const currentHash = hashToken(currentToken);
    const rows = await db.select({
      id: sessions.id,
      tokenHash: sessions.tokenHash,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
    })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ))
      .orderBy(sessions.createdAt);

    return rows.map(r => ({
      id: r.id,
      userAgent: r.userAgent ?? '',
      createdAt: r.createdAt.toISOString(),
      isCurrent: r.tokenHash === currentHash,
    }));
  } catch {
    return [];
  }
}
