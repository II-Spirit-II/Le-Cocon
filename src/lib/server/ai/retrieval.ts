import { eq, and, gte, desc } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { children, dailyLogs, news, parentNotes } from '$lib/server/db/schema';
import type { AIIntent, RetrievedSources } from './types';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function retrieveSources(
  db: DrizzleDB,
  childId: string,
  intent: AIIntent,
  timeframeDays: number = 90
): Promise<RetrievedSources> {
  const startDate = daysAgo(timeframeDays);

  try {
    const [logs, newsItems, notes] = await Promise.all([
      db.select().from(dailyLogs)
        .where(and(eq(dailyLogs.childId, childId), gte(dailyLogs.date, startDate)))
        .orderBy(desc(dailyLogs.date))
        .limit(30),
      db.select().from(news)
        .where(eq(news.childId, childId))
        .orderBy(desc(news.createdAt))
        .limit(20),
      db.select().from(parentNotes)
        .where(and(eq(parentNotes.childId, childId), gte(parentNotes.createdAt, new Date(startDate))))
        .orderBy(desc(parentNotes.createdAt))
        .limit(20),
    ]);

    return {
      dailyLogs: logs.map(r => ({
        id: r.id,
        date: r.date,
        meals: r.meals ?? [],
        nap: r.nap ?? null,
        mood: r.mood,
        health: r.health ?? null,
        changes: r.changes,
        notes: r.notes ?? '',
        menuRef: null,
      })),
      news: newsItems.map(r => ({
        id: r.id,
        content: r.content,
        emoji: r.emoji || null,
        createdAt: r.createdAt.toISOString(),
      })),
      parentNotes: notes.map(r => ({
        id: r.id,
        kind: r.kind,
        content: r.content,
        startDate: r.startDate ?? null,
        endDate: r.endDate ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return { dailyLogs: [], news: [], parentNotes: [] };
  }
}

export async function verifyChildAccess(db: DrizzleDB, childId: string): Promise<boolean> {
  try {
    const [record] = await db.select({ id: children.id }).from(children)
      .where(eq(children.id, childId)).limit(1);
    return !!record;
  } catch {
    return false;
  }
}
