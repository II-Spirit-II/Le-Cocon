/**
 * Domain Service: Daily Logs
 */
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { dailyLogs } from '$lib/server/db/schema';
import type { DailyLog, MealEntry, NapEntry, HealthEntry, MoodLevel } from '$lib/types';

function toDailyLog(record: typeof dailyLogs.$inferSelect): DailyLog {
  return {
    id: record.id,
    childId: record.childId,
    authorId: record.authorId,
    date: record.date,
    meals: (record.meals ?? []) as MealEntry[],
    nap: (record.nap ?? null) as NapEntry | null,
    mood: record.mood,
    health: (record.health ?? null) as HealthEntry | null,
    changes: record.changes,
    notes: record.notes ?? '',
    menuId: record.menuId ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function getAllDailyLogs(
  db: DrizzleDB,
  options?: { childId?: string; childIds?: string[]; limit?: number; startDate?: string; endDate?: string }
): Promise<DailyLog[]> {
  try {
    const conditions = [];
    if (options?.childId) conditions.push(eq(dailyLogs.childId, options.childId));
    if (options?.childIds && options.childIds.length > 0) {
      conditions.push(inArray(dailyLogs.childId, options.childIds));
    }
    if (options?.startDate) conditions.push(gte(dailyLogs.date, options.startDate));
    if (options?.endDate) conditions.push(lte(dailyLogs.date, options.endDate));

    // If childIds was provided but empty, no results possible
    if (options?.childIds && options.childIds.length === 0) return [];

    let query = db.select().from(dailyLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyLogs.date));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    const records = await query;
    return records.map(toDailyLog);
  } catch {
    return [];
  }
}

export async function getDailyLogsForChild(
  db: DrizzleDB,
  childId: string,
  options?: { limit?: number; startDate?: string; endDate?: string }
): Promise<DailyLog[]> {
  return getAllDailyLogs(db, { ...options, childId });
}

export async function getDailyLogById(db: DrizzleDB, logId: string): Promise<DailyLog | null> {
  try {
    const [record] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, logId)).limit(1);
    return record ? toDailyLog(record) : null;
  } catch {
    return null;
  }
}

export async function getDailyLogByDate(
  db: DrizzleDB,
  childId: string,
  date: string
): Promise<DailyLog | null> {
  try {
    const [record] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.childId, childId), eq(dailyLogs.date, date)))
      .limit(1);
    return record ? toDailyLog(record) : null;
  } catch {
    return null;
  }
}

export async function createDailyLog(
  db: DrizzleDB,
  data: {
    childId: string;
    date: string;
    meals?: MealEntry[];
    nap?: NapEntry | null;
    mood?: MoodLevel;
    health?: HealthEntry | null;
    changes?: number;
    notes?: string;
    menuId?: string | null;
  },
  authorId: string
): Promise<DailyLog | null> {
  try {
    const [record] = await db.insert(dailyLogs).values({
      childId: data.childId,
      authorId,
      date: data.date,
      meals: data.meals ?? [],
      nap: data.nap ?? null,
      mood: data.mood ?? 'calme',
      health: data.health ?? null,
      changes: data.changes ?? 0,
      notes: data.notes ?? '',
      ...(data.menuId ? { menuId: data.menuId } : {})
    }).returning();
    return toDailyLog(record);
  } catch {
    return null;
  }
}

export async function updateDailyLog(
  db: DrizzleDB,
  logId: string,
  data: {
    meals?: MealEntry[];
    nap?: NapEntry | null;
    mood?: MoodLevel;
    health?: HealthEntry | null;
    changes?: number;
    notes?: string;
  }
): Promise<DailyLog | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.meals !== undefined) updates.meals = data.meals;
    if (data.nap !== undefined) updates.nap = data.nap;
    if (data.mood !== undefined) updates.mood = data.mood;
    if (data.health !== undefined) updates.health = data.health;
    if (data.changes !== undefined) updates.changes = data.changes;
    if (data.notes !== undefined) updates.notes = data.notes;

    const [record] = await db.update(dailyLogs).set(updates).where(eq(dailyLogs.id, logId)).returning();
    return record ? toDailyLog(record) : null;
  } catch {
    return null;
  }
}

export async function deleteDailyLog(db: DrizzleDB, logId: string): Promise<boolean> {
  try {
    await db.delete(dailyLogs).where(eq(dailyLogs.id, logId));
    return true;
  } catch {
    return false;
  }
}

export async function getDailyLogsForDate(db: DrizzleDB, date: string): Promise<DailyLog[]> {
  return getAllDailyLogs(db, { startDate: date, endDate: date });
}

export async function batchUpsertDailyLogs(
  db: DrizzleDB,
  logs: Array<{
    childId: string;
    date: string;
    meals?: MealEntry[];
    nap?: NapEntry | null;
    mood?: MoodLevel;
    health?: HealthEntry | null;
    changes?: number;
    notes?: string;
    menuId?: string | null;
  }>,
  authorId: string
): Promise<{ success: number; failed: number }> {
  // Atomic upsert: INSERT ... ON CONFLICT DO UPDATE
  const results = await Promise.allSettled(
    logs.map(async (logData) => {
      try {
        const [record] = await db.insert(dailyLogs).values({
          childId: logData.childId,
          authorId,
          date: logData.date,
          meals: logData.meals ?? [],
          nap: logData.nap ?? null,
          mood: logData.mood ?? 'calme',
          health: logData.health ?? null,
          changes: logData.changes ?? 0,
          notes: logData.notes ?? '',
          ...(logData.menuId ? { menuId: logData.menuId } : {})
        }).onConflictDoUpdate({
          target: [dailyLogs.childId, dailyLogs.date],
          set: {
            meals: logData.meals ?? [],
            nap: logData.nap ?? null,
            mood: logData.mood ?? 'calme',
            health: logData.health ?? null,
            changes: logData.changes ?? 0,
            notes: logData.notes ?? '',
            updatedAt: new Date(),
            ...(logData.menuId ? { menuId: logData.menuId } : {})
          }
        }).returning();
        return record ? toDailyLog(record) : null;
      } catch {
        return null;
      }
    })
  );

  const success = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  const failed = results.length - success;
  return { success, failed };
}
