/**
 * Domain Service: News
 */
import { eq, desc, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { news } from '$lib/server/db/schema';
import type { News } from '$lib/types';

function toNews(record: typeof news.$inferSelect): News {
  return {
    id: record.id,
    childId: record.childId,
    authorId: record.authorId,
    content: record.content,
    emoji: record.emoji || undefined,
    attachmentPath: record.attachment || undefined,
    createdAt: record.createdAt.toISOString()
  };
}

export async function getAllNews(
  db: DrizzleDB,
  options?: { childId?: string; limit?: number }
): Promise<News[]> {
  try {
    let query = db.select().from(news)
      .where(options?.childId ? eq(news.childId, options.childId) : undefined)
      .orderBy(desc(news.createdAt));

    query = query.limit(options?.limit ?? 100) as typeof query;

    const records = await query;
    return records.map(toNews);
  } catch {
    return [];
  }
}

export async function getNewsForChild(
  db: DrizzleDB,
  childId: string,
  limit?: number
): Promise<News[]> {
  return getAllNews(db, { childId, limit });
}

/** Fetch news scoped to a set of child IDs (for role-based access). */
export async function getNewsForChildren(
  db: DrizzleDB,
  childIds: string[],
  limit?: number
): Promise<News[]> {
  if (childIds.length === 0) return [];
  try {
    const records = await db.select().from(news)
      .where(inArray(news.childId, childIds))
      .orderBy(desc(news.createdAt))
      .limit(limit ?? 100);
    return records.map(toNews);
  } catch {
    return [];
  }
}

export async function getNewsById(db: DrizzleDB, newsId: string): Promise<News | null> {
  try {
    const [record] = await db.select().from(news).where(eq(news.id, newsId)).limit(1);
    return record ? toNews(record) : null;
  } catch {
    return null;
  }
}

export async function createNews(
  db: DrizzleDB,
  data: { childId: string; content: string; emoji?: string; attachmentPath?: string },
  authorId: string
): Promise<News | null> {
  try {
    const [record] = await db.insert(news).values({
      childId: data.childId,
      authorId,
      content: data.content,
      ...(data.emoji ? { emoji: data.emoji } : {}),
      ...(data.attachmentPath ? { attachment: data.attachmentPath } : {})
    }).returning();
    return toNews(record);
  } catch {
    return null;
  }
}

export async function updateNews(
  db: DrizzleDB,
  newsId: string,
  data: { content?: string; emoji?: string | null; attachmentPath?: string | null }
): Promise<News | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.content !== undefined) updates.content = data.content;
    if (data.emoji !== undefined) updates.emoji = data.emoji ?? '';
    if (data.attachmentPath !== undefined) updates.attachment = data.attachmentPath ?? '';

    const [record] = await db.update(news).set(updates).where(eq(news.id, newsId)).returning();
    return record ? toNews(record) : null;
  } catch {
    return null;
  }
}

export async function deleteNews(db: DrizzleDB, newsId: string): Promise<boolean> {
  try {
    await db.delete(news).where(eq(news.id, newsId));
    return true;
  } catch {
    return false;
  }
}
