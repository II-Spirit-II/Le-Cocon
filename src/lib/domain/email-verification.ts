/**
 * Email verification — code generation, validation, and rate limiting.
 * Codes are SHA-256 hashed before storage.
 */
import { eq, and, gt, isNull, desc } from 'drizzle-orm';
import { emailVerifications, users } from '$lib/server/db/schema';
import { invalidateUserCache } from '$lib/server/auth';
import type { DrizzleDB } from '$lib/server/db';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MS = 15 * 60_000; // 15 min
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000; // 60s
const MAX_RESENDS_PER_HOUR = 3;

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(CODE_LENGTH, '0');
}

/** Create a new verification code, invalidating any previous unexpired ones. */
export async function createVerificationCode(
  db: DrizzleDB,
  userId: string
): Promise<{ code: string } | null> {
  try {
    const code = generateCode();
    const codeHash = await hashCode(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MS);

    // Expire all previous codes for this user
    await db.update(emailVerifications)
      .set({ expiresAt: now })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          gt(emailVerifications.expiresAt, now),
          isNull(emailVerifications.verifiedAt)
        )
      );

    await db.insert(emailVerifications).values({
      userId,
      codeHash,
      expiresAt,
    });

    return { code };
  } catch {
    return null;
  }
}

export type VerifyResult = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

/** Verify a 6-digit code against the latest unexpired record. */
export async function verifyCode(
  db: DrizzleDB,
  userId: string,
  code: string
): Promise<VerifyResult> {
  try {
    const now = new Date();

    const [record] = await db.select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          gt(emailVerifications.expiresAt, now),
          isNull(emailVerifications.verifiedAt)
        )
      )
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (!record) return 'expired';
    if (record.attempts >= MAX_ATTEMPTS) return 'too_many_attempts';

    const inputHash = await hashCode(code);

    if (inputHash !== record.codeHash) {
      await db.update(emailVerifications)
        .set({ attempts: record.attempts + 1 })
        .where(eq(emailVerifications.id, record.id));
      return 'invalid';
    }

    await db.update(emailVerifications)
      .set({ verifiedAt: now })
      .where(eq(emailVerifications.id, record.id));

    return 'ok';
  } catch {
    return 'expired';
  }
}

/** Mark user email as verified and bust the auth cache. */
export async function markEmailVerified(db: DrizzleDB, userId: string): Promise<void> {
  try {
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));
    invalidateUserCache(userId);
  } catch {
    // Silent fail
  }
}

/** Check resend eligibility: 60s cooldown + max 3/hour. */
export async function canResendCode(db: DrizzleDB, userId: string): Promise<boolean> {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const recentCodes = await db.select({ createdAt: emailVerifications.createdAt })
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          gt(emailVerifications.createdAt, oneHourAgo)
        )
      )
      .orderBy(desc(emailVerifications.createdAt));

    if (recentCodes.length >= MAX_RESENDS_PER_HOUR) return false;

    const latest = recentCodes[0];
    if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/** Look up a user by email — needed by verify-email route. */
export async function getUserByEmail(db: DrizzleDB, email: string) {
  try {
    const [row] = await db.select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}
