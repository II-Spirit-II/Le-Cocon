/**
 * Shared server helpers — DRY utilities for route handlers.
 */
import { error } from '@sveltejs/kit';
import type { User } from '$lib/types/auth';
import type { UserRole } from '$lib/types/auth';

/** Throws 403 if user is null or doesn't have the required role. */
export function requireRole(user: User | null, role: UserRole): asserts user is User {
  if (!user) throw error(401, 'Non authentifié');
  if (user.role !== role) throw error(403, `Action réservée aux ${role}s`);
}

/** Throws 401 if user is null. */
export function requireAuth(user: User | null): asserts user is User {
  if (!user) throw error(401, 'Non authentifié');
}

/** Throws 403 if the user doesn't own the child (assistante or parent). */
export function assertChildAccess(
  child: { assistanteId: string; parentIds: string[] } | null,
  user: User
): void {
  if (!child) throw error(404, 'Enfant introuvable');
  if (user.role === 'assistante' && child.assistanteId !== user.id) {
    throw error(403, 'Accès non autorisé');
  }
  if (user.role === 'parent' && !child.parentIds.includes(user.id)) {
    throw error(403, 'Accès non autorisé');
  }
}

export { toLocalDateStr } from '$lib/utils/date';

/** Safe JSON parse with typed fallback — never throws. */
export function parseJsonSafe<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * In-memory rate limiter. Returns false if limit is exceeded.
 * Cleans stale entries on each call to prevent unbounded growth.
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const map = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): boolean {
    const now = Date.now();

    // Periodic cleanup: remove entries older than 2x window
    if (map.size > 1000) {
      for (const [k, v] of map) {
        if (now > v.resetAt + windowMs) map.delete(k);
      }
    }

    const entry = map.get(key);
    if (!entry || now > entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
  };
}
