import { eq, and, gt, isNull, desc } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { inviteCodes, parentChildren, children } from '$lib/server/db/schema';

export interface InviteCodeWithChild {
  id: string;
  code: string;
  child: {
    firstName: string;
    lastName: string;
  };
  expiresAt: string;
  createdAt: string;
}

// Excludes visually ambiguous characters (O, 0, I, 1)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInviteCode(
  db: DrizzleDB,
  childId: string,
  createdById: string
): Promise<{ code: string | null; error: string | null }> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  if (!createdById) return { code: null, error: 'Non authentifié' };

  // Retry up to 5 times on collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db.insert(inviteCodes).values({ code, childId, createdById, expiresAt });
      return { code, error: null };
    } catch (e) {
      if (attempt === 4) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue';
        return { code: null, error: msg };
      }
    }
  }
  return { code: null, error: 'Impossible de générer un code unique' };
}

export async function useInviteCode(
  db: DrizzleDB,
  code: string,
  userId: string
): Promise<{ childId: string | null; error: string | null }> {
  if (!userId) return { childId: null, error: 'Non authentifié' };

  try {
    const now = new Date();
    const [record] = await db.select().from(inviteCodes)
      .where(and(
        eq(inviteCodes.code, code.toUpperCase().trim()),
        isNull(inviteCodes.usedById),
        gt(inviteCodes.expiresAt, now),
      ))
      .limit(1);

    if (!record) {
      return { childId: null, error: 'Code invalide, expiré ou déjà utilisé' };
    }

    await db.update(inviteCodes).set({
      usedById: userId,
      usedAt: now,
      updatedAt: now,
    }).where(eq(inviteCodes.id, record.id));

    await db.insert(parentChildren).values({
      parentId: userId,
      childId: record.childId,
    });

    return { childId: record.childId, error: null };
  } catch {
    return { childId: null, error: "Erreur lors de l'utilisation du code" };
  }
}

export async function getInviteCodesForChild(
  db: DrizzleDB,
  childId: string
): Promise<Array<typeof inviteCodes.$inferSelect>> {
  const now = new Date();
  try {
    return await db.select().from(inviteCodes)
      .where(and(
        eq(inviteCodes.childId, childId),
        isNull(inviteCodes.usedById),
        gt(inviteCodes.expiresAt, now),
      ))
      .orderBy(desc(inviteCodes.createdAt));
  } catch {
    return [];
  }
}

export async function getAllInviteCodes(db: DrizzleDB): Promise<InviteCodeWithChild[]> {
  const now = new Date();
  try {
    const records = await db.select({
      invite: inviteCodes,
      childFirstName: children.firstName,
      childLastName: children.lastName,
    })
      .from(inviteCodes)
      .leftJoin(children, eq(inviteCodes.childId, children.id))
      .where(and(isNull(inviteCodes.usedById), gt(inviteCodes.expiresAt, now)))
      .orderBy(desc(inviteCodes.createdAt));

    return records.map(r => ({
      id: r.invite.id,
      code: r.invite.code,
      child: { firstName: r.childFirstName ?? '', lastName: r.childLastName ?? '' },
      expiresAt: r.invite.expiresAt.toISOString(),
      createdAt: r.invite.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function deleteInviteCode(
  db: DrizzleDB,
  codeId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    await db.delete(inviteCodes).where(eq(inviteCodes.id, codeId));
    return { success: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { success: false, error: msg };
  }
}
