/**
 * Domain Service: Parent Notes
 */
import { eq, and, gte, lte, desc, asc, isNull, isNotNull, sql, count, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { parentNotes, children, parentChildren } from '$lib/server/db/schema';
import type { ParentNote, ParentNoteKind, CalendarEvent } from '$lib/types';

export type { CalendarEvent };

export interface ListNotesOptions {
  childId?: string;
  onlyOpen?: boolean;
  limit?: number;
  offset?: number;
}

export interface CalendarInsights {
  absencesNext7Days: number;
  absencesNext30Days: number;
  absenceDaysLast30: number;
  retardsLast30Days: number;
}

function toNote(record: typeof parentNotes.$inferSelect): ParentNote {
  return {
    id: record.id,
    childId: record.childId,
    createdBy: record.createdById,
    kind: record.kind,
    content: record.content,
    startDate: record.startDate ?? null,
    endDate: record.endDate ?? null,
    assistantAcknowledgedAt: record.assistantAcknowledgedAt?.toISOString() ?? null,
    assistantAcknowledgedBy: record.assistantAcknowledgedById ?? null,
    assistantResponse: record.assistantResponse ?? null,
    assistantRespondedAt: record.assistantRespondedAt?.toISOString() ?? null,
    parentSeenResponseAt: record.parentSeenResponseAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function getNotesForParent(
  db: DrizzleDB,
  parentId: string,
  options?: ListNotesOptions
): Promise<ParentNote[]> {
  try {
    // Only return notes for children linked to this parent
    const childIds = await db.select({ childId: children.id })
      .from(children)
      .innerJoin(
        parentChildren,
        eq(children.id, parentChildren.childId)
      )
      .where(eq(parentChildren.parentId, parentId));

    if (childIds.length === 0) return [];

    const conditions = [
      inArray(parentNotes.childId, childIds.map(c => c.childId)),
    ];
    if (options?.childId) conditions.push(eq(parentNotes.childId, options.childId));
    if (options?.onlyOpen) conditions.push(isNull(parentNotes.assistantAcknowledgedAt));

    const records = await db.select().from(parentNotes)
      .where(and(...conditions))
      .orderBy(desc(parentNotes.createdAt));

    return records.map(toNote);
  } catch {
    return [];
  }
}

export async function getNotesForAssistant(
  db: DrizzleDB,
  assistanteId: string,
  options?: ListNotesOptions
): Promise<ParentNote[]> {
  try {
    // Only return notes for children managed by this assistante
    const childIds = await db.select({ childId: children.id })
      .from(children)
      .where(eq(children.assistanteId, assistanteId));

    if (childIds.length === 0) return [];

    const conditions = [
      inArray(parentNotes.childId, childIds.map(c => c.childId)),
    ];
    if (options?.childId) conditions.push(eq(parentNotes.childId, options.childId));
    if (options?.onlyOpen) conditions.push(isNull(parentNotes.assistantAcknowledgedAt));

    const records = await db.select().from(parentNotes)
      .where(and(...conditions))
      .orderBy(desc(parentNotes.createdAt));

    return records.map(toNote);
  } catch {
    return [];
  }
}

export async function getNoteById(db: DrizzleDB, noteId: string): Promise<ParentNote | null> {
  try {
    const [record] = await db.select().from(parentNotes).where(eq(parentNotes.id, noteId)).limit(1);
    return record ? toNote(record) : null;
  } catch {
    return null;
  }
}

export async function createNote(
  db: DrizzleDB,
  data: {
    childId: string;
    kind: ParentNoteKind;
    content: string;
    startDate?: string | null;
    endDate?: string | null;
  },
  createdBy: string
): Promise<ParentNote | null> {
  try {
    const [record] = await db.insert(parentNotes).values({
      childId: data.childId,
      createdById: createdBy,
      kind: data.kind,
      content: data.content,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
    }).returning();
    return toNote(record);
  } catch {
    return null;
  }
}

export async function updateNoteAsParent(
  db: DrizzleDB,
  noteId: string,
  data: {
    kind?: ParentNoteKind;
    content?: string;
    startDate?: string | null;
    endDate?: string | null;
  }
): Promise<ParentNote | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.kind !== undefined) updates.kind = data.kind;
    if (data.content !== undefined) updates.content = data.content;
    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;

    const [record] = await db.update(parentNotes).set(updates).where(eq(parentNotes.id, noteId)).returning();
    return record ? toNote(record) : null;
  } catch {
    return null;
  }
}

export async function acknowledgeNote(
  db: DrizzleDB,
  noteId: string,
  assistantId: string
): Promise<ParentNote | null> {
  try {
    const [record] = await db.update(parentNotes).set({
      assistantAcknowledgedAt: new Date(),
      assistantAcknowledgedById: assistantId,
      updatedAt: new Date(),
    }).where(eq(parentNotes.id, noteId)).returning();
    return record ? toNote(record) : null;
  } catch {
    return null;
  }
}

export async function respondToNote(
  db: DrizzleDB,
  noteId: string,
  response: string,
  assistantId: string
): Promise<ParentNote | null> {
  try {
    const [record] = await db.update(parentNotes).set({
      assistantResponse: response,
      assistantRespondedAt: new Date(),
      assistantAcknowledgedAt: new Date(),
      assistantAcknowledgedById: assistantId,
      updatedAt: new Date(),
    }).where(eq(parentNotes.id, noteId)).returning();
    return record ? toNote(record) : null;
  } catch {
    return null;
  }
}

export async function deleteNote(db: DrizzleDB, noteId: string): Promise<boolean> {
  try {
    await db.delete(parentNotes).where(eq(parentNotes.id, noteId));
    return true;
  } catch {
    return false;
  }
}

export async function countUnacknowledgedNotes(
  db: DrizzleDB,
  assistanteId: string,
  childId?: string
): Promise<number> {
  try {
    // Scope to children managed by this assistante
    const childIds = await db.select({ childId: children.id })
      .from(children)
      .where(eq(children.assistanteId, assistanteId));

    if (childIds.length === 0) return 0;

    const conditions = [
      isNull(parentNotes.assistantAcknowledgedAt),
      inArray(parentNotes.childId, childIds.map(c => c.childId)),
    ];
    if (childId) conditions.push(eq(parentNotes.childId, childId));

    const [result] = await db.select({ value: count() }).from(parentNotes)
      .where(and(...conditions));

    return result?.value ?? 0;
  } catch {
    return 0;
  }
}

export async function countUnseenResponses(
  db: DrizzleDB,
  parentId: string
): Promise<number> {
  try {
    // Scope to children linked to this parent
    const childIds = await db.select({ childId: parentChildren.childId })
      .from(parentChildren)
      .where(eq(parentChildren.parentId, parentId));

    if (childIds.length === 0) return 0;

    const [result] = await db.select({ value: count() }).from(parentNotes)
      .where(and(
        isNotNull(parentNotes.assistantRespondedAt),
        isNull(parentNotes.parentSeenResponseAt),
        inArray(parentNotes.childId, childIds.map(c => c.childId)),
      ));

    return result?.value ?? 0;
  } catch {
    return 0;
  }
}

export async function markResponseAsSeen(
  db: DrizzleDB,
  noteId: string
): Promise<ParentNote | null> {
  try {
    const [record] = await db.update(parentNotes).set({
      parentSeenResponseAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(parentNotes.id, noteId)).returning();
    return record ? toNote(record) : null;
  } catch {
    return null;
  }
}

// ── Calendar ──────────────────────────────────────────────────

interface CalendarQueryOptions {
  from: string;
  to: string;
  childId?: string;
  kinds?: ParentNoteKind[];
}

export async function listCalendarEventsForAssistant(
  db: DrizzleDB,
  options: CalendarQueryOptions
): Promise<CalendarEvent[]> {
  try {
    const conditions = [
      lte(parentNotes.startDate, options.to),
      gte(parentNotes.endDate, options.from),
    ];
    if (options.childId) conditions.push(eq(parentNotes.childId, options.childId));
    if (options.kinds?.length) {
      const kindConditions = options.kinds.map(k => eq(parentNotes.kind, k));
      conditions.push(sql`(${sql.join(kindConditions, sql` OR `)})`);
    }

    const records = await db.select({
      note: parentNotes,
      childFirstName: children.firstName,
      childLastName: children.lastName,
    })
      .from(parentNotes)
      .leftJoin(children, eq(parentNotes.childId, children.id))
      .where(and(...conditions))
      .orderBy(asc(parentNotes.startDate));

    return records.map(r => ({
      id: r.note.id,
      childId: r.note.childId,
      childName: r.childFirstName && r.childLastName
        ? `${r.childFirstName} ${r.childLastName}`
        : r.note.childId,
      kind: r.note.kind,
      startDate: r.note.startDate ?? '',
      endDate: r.note.endDate ?? '',
      content: r.note.content,
      acknowledgedAt: r.note.assistantAcknowledgedAt?.toISOString() ?? null,
      createdAt: r.note.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

// Parent-scoped calendar events: only notes created by this parent
export async function listCalendarEventsForParent(
  db: DrizzleDB,
  parentId: string,
  options: CalendarQueryOptions
): Promise<CalendarEvent[]> {
  try {
    const conditions = [
      eq(parentNotes.createdById, parentId),
      lte(parentNotes.startDate, options.to),
      gte(parentNotes.endDate, options.from),
    ];
    if (options.childId) conditions.push(eq(parentNotes.childId, options.childId));
    if (options.kinds?.length) {
      const kindConditions = options.kinds.map(k => eq(parentNotes.kind, k));
      conditions.push(sql`(${sql.join(kindConditions, sql` OR `)})`);
    }

    const records = await db.select({
      note: parentNotes,
      childFirstName: children.firstName,
      childLastName: children.lastName,
    })
      .from(parentNotes)
      .leftJoin(children, eq(parentNotes.childId, children.id))
      .where(and(...conditions))
      .orderBy(asc(parentNotes.startDate));

    return records.map(r => ({
      id: r.note.id,
      childId: r.note.childId,
      childName: r.childFirstName && r.childLastName
        ? `${r.childFirstName} ${r.childLastName}`
        : r.note.childId,
      kind: r.note.kind,
      startDate: r.note.startDate ?? '',
      endDate: r.note.endDate ?? '',
      content: r.note.content,
      acknowledgedAt: r.note.assistantAcknowledgedAt?.toISOString() ?? null,
      createdAt: r.note.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getCalendarInsights(
  db: DrizzleDB,
  childId?: string
): Promise<CalendarInsights> {
  const today = new Date().toISOString().slice(0, 10);
  const plus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const plus30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const minus30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    const baseConditions = childId ? [eq(parentNotes.childId, childId)] : [];

    const [next7, next30, last30absences, last30retards] = await Promise.all([
      db.select({ value: count() }).from(parentNotes)
        .where(and(
          eq(parentNotes.kind, 'absence'),
          lte(parentNotes.startDate, plus7),
          gte(parentNotes.endDate, today),
          ...baseConditions,
        )),
      db.select({ value: count() }).from(parentNotes)
        .where(and(
          eq(parentNotes.kind, 'absence'),
          lte(parentNotes.startDate, plus30),
          gte(parentNotes.endDate, today),
          ...baseConditions,
        )),
      db.select().from(parentNotes)
        .where(and(
          eq(parentNotes.kind, 'absence'),
          gte(parentNotes.startDate, minus30),
          lte(parentNotes.startDate, today),
          ...baseConditions,
        )),
      db.select({ value: count() }).from(parentNotes)
        .where(and(
          eq(parentNotes.kind, 'retard'),
          gte(parentNotes.startDate, minus30),
          ...baseConditions,
        )),
    ]);

    let absenceDaysLast30 = 0;
    for (const note of last30absences) {
      if (note.startDate && note.endDate) {
        const start = new Date(note.startDate);
        const end = new Date(note.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        absenceDaysLast30 += Math.max(0, days);
      }
    }

    return {
      absencesNext7Days: next7[0]?.value ?? 0,
      absencesNext30Days: next30[0]?.value ?? 0,
      absenceDaysLast30,
      retardsLast30Days: last30retards[0]?.value ?? 0
    };
  } catch {
    return { absencesNext7Days: 0, absencesNext30Days: 0, absenceDaysLast30: 0, retardsLast30Days: 0 };
  }
}
