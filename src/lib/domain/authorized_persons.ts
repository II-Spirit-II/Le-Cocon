/**
 * Domain Service: Authorized Persons
 * Adults authorized to pick up children (besides parents).
 */
import { eq, and, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { authorizedPersons } from '$lib/server/db/schema';
import type { AuthorizedPerson } from '$lib/types';

function toAuthorizedPerson(record: typeof authorizedPersons.$inferSelect): AuthorizedPerson {
  return {
    id: record.id,
    childId: record.childId,
    name: record.name,
    relationship: record.relationship,
    phone: record.phone ?? null,
    photoPath: record.photoPath ?? null,
    active: record.active,
    createdAt: record.createdAt.toISOString(),
  };
}

/** List active authorized persons for a child. */
export async function getAuthorizedPersons(
  db: DrizzleDB,
  childId: string
): Promise<AuthorizedPerson[]> {
  try {
    const records = await db.select()
      .from(authorizedPersons)
      .where(and(
        eq(authorizedPersons.childId, childId),
        eq(authorizedPersons.active, true),
      ));
    return records.map(toAuthorizedPerson);
  } catch {
    return [];
  }
}

/** Batch-load active authorized persons for multiple children. */
export async function getAuthorizedPersonsForChildren(
  db: DrizzleDB,
  childIds: string[]
): Promise<Map<string, AuthorizedPerson[]>> {
  const result = new Map<string, AuthorizedPerson[]>();
  if (childIds.length === 0) return result;
  try {
    const records = await db.select()
      .from(authorizedPersons)
      .where(and(
        inArray(authorizedPersons.childId, childIds),
        eq(authorizedPersons.active, true),
      ));
    for (const record of records) {
      const person = toAuthorizedPerson(record);
      const list = result.get(person.childId) ?? [];
      list.push(person);
      result.set(person.childId, list);
    }
    return result;
  } catch {
    return result;
  }
}

/** Add a new authorized person for a child. */
export async function createAuthorizedPerson(
  db: DrizzleDB,
  data: {
    childId: string;
    name: string;
    relationship: string;
    phone?: string;
    createdById: string;
  }
): Promise<AuthorizedPerson | null> {
  try {
    const [record] = await db.insert(authorizedPersons).values({
      childId: data.childId,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      createdById: data.createdById,
    }).returning();
    return record ? toAuthorizedPerson(record) : null;
  } catch {
    return null;
  }
}

/** Soft-delete an authorized person. Verifies the person belongs to the given child. */
export async function deactivateAuthorizedPerson(
  db: DrizzleDB,
  personId: string,
  childId: string
): Promise<boolean> {
  try {
    const result = await db.update(authorizedPersons)
      .set({ active: false, updatedAt: new Date() })
      .where(and(
        eq(authorizedPersons.id, personId),
        eq(authorizedPersons.childId, childId),
      ))
      .returning();
    return result.length > 0;
  } catch {
    return false;
  }
}
