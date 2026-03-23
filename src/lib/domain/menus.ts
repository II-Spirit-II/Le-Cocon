/**
 * Domain Service: Menus
 */
import { eq, and, asc } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { menus } from '$lib/server/db/schema';
import type { Menu, MealType } from '$lib/types';

function toMenu(record: typeof menus.$inferSelect): Menu {
  return {
    id: record.id,
    date: record.date,
    mealType: record.mealType,
    description: record.description,
    createdAt: record.createdAt.toISOString()
  };
}

export async function getMenusForDate(db: DrizzleDB, date: string): Promise<Menu[]> {
  try {
    const records = await db.select().from(menus)
      .where(eq(menus.date, date))
      .orderBy(asc(menus.mealType));
    return records.map(toMenu);
  } catch {
    return [];
  }
}

export async function upsertMenu(
  db: DrizzleDB,
  date: string,
  mealType: MealType,
  description: string
): Promise<Menu | null> {
  try {
    const [existing] = await db.select().from(menus)
      .where(and(eq(menus.date, date), eq(menus.mealType, mealType)))
      .limit(1);

    if (existing) {
      const [record] = await db.update(menus)
        .set({ description, updatedAt: new Date() })
        .where(eq(menus.id, existing.id))
        .returning();
      return toMenu(record);
    }

    const [record] = await db.insert(menus).values({ date, mealType, description }).returning();
    return toMenu(record);
  } catch {
    return null;
  }
}

export async function getLunchMenuForDate(db: DrizzleDB, date: string): Promise<Menu | null> {
  try {
    const [record] = await db.select().from(menus)
      .where(and(eq(menus.date, date), eq(menus.mealType, 'dejeuner')))
      .limit(1);
    return record ? toMenu(record) : null;
  } catch {
    return null;
  }
}
