/**
 * Domain Service: Children
 */
import { eq, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { children, parentChildren } from '$lib/server/db/schema';
import type { Child } from '$lib/types';

function toChild(
  record: typeof children.$inferSelect,
  parentIds: string[] = []
): Child {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    birthDate: record.birthDate,
    avatarPath: record.avatar || undefined,
    parentIds,
    assistanteId: record.assistanteId,
    createdAt: record.createdAt.toISOString()
  };
}

/** Fetch all children for a given assistante (single query with LEFT JOIN). */
async function getAllChildren(db: DrizzleDB, assistanteId: string): Promise<Child[]> {
  try {
    const rows = await db.select({
      child: children,
      parentId: parentChildren.parentId,
    })
      .from(children)
      .leftJoin(parentChildren, eq(children.id, parentChildren.childId))
      .where(eq(children.assistanteId, assistanteId))
      .orderBy(children.firstName);

    if (rows.length === 0) return [];

    // Group parent IDs by child
    const childMap = new Map<string, { record: typeof children.$inferSelect; parentIds: string[] }>();
    for (const row of rows) {
      const existing = childMap.get(row.child.id);
      if (existing) {
        if (row.parentId) existing.parentIds.push(row.parentId);
      } else {
        childMap.set(row.child.id, {
          record: row.child,
          parentIds: row.parentId ? [row.parentId] : []
        });
      }
    }

    return [...childMap.values()].map(({ record, parentIds }) => toChild(record, parentIds));
  } catch {
    return [];
  }
}

async function getChildrenForParent(db: DrizzleDB, parentId: string): Promise<Child[]> {
  try {
    const pcRecords = await db.select({
      pc: parentChildren,
      child: children,
    })
      .from(parentChildren)
      .innerJoin(children, eq(parentChildren.childId, children.id))
      .where(eq(parentChildren.parentId, parentId));

    return pcRecords.map(r => toChild(r.child, [parentId]));
  } catch {
    return [];
  }
}

export async function getChildById(db: DrizzleDB, childId: string): Promise<Child | null> {
  try {
    const rows = await db.select({
      child: children,
      parentId: parentChildren.parentId,
    })
      .from(children)
      .leftJoin(parentChildren, eq(parentChildren.childId, children.id))
      .where(eq(children.id, childId));

    if (rows.length === 0) return null;

    const parentIds = rows
      .map(r => r.parentId)
      .filter((id): id is string => id !== null);

    return toChild(rows[0].child, parentIds);
  } catch {
    return null;
  }
}

export async function getChildrenForUser(
  db: DrizzleDB,
  userId: string,
  userRole: 'assistante' | 'parent'
): Promise<Child[]> {
  if (userRole === 'parent') return getChildrenForParent(db, userId);
  return getAllChildren(db, userId);
}

export async function createChild(
  db: DrizzleDB,
  data: { firstName: string; lastName: string; birthDate: string; avatarPath?: string },
  assistanteId: string
): Promise<Child | null> {
  try {
    const [record] = await db.insert(children).values({
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate,
      assistanteId,
    }).returning();
    return toChild(record, []);
  } catch {
    return null;
  }
}

export async function updateChildAvatar(
  db: DrizzleDB,
  childId: string,
  avatarPath: string | null
): Promise<boolean> {
  try {
    await db.update(children).set({ avatar: avatarPath ?? '', updatedAt: new Date() }).where(eq(children.id, childId));
    return true;
  } catch {
    return false;
  }
}
