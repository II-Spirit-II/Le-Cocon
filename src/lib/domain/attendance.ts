/**
 * Domain Service: Attendance
 * Tracks child check-in/check-out, absences, and presence status.
 */
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import type { DrizzleDB } from '$lib/server/db';
import { attendances, children, parentChildren } from '$lib/server/db/schema';
import type {
  Attendance,
  AttendanceWithChild,
  AttendanceStatus,
  CheckMethod,
  PersonType,
  CareSchedule,
  CareWeekday,
  MonthlyChildReport,
} from '$lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAY_MAP: CareWeekday[] = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
];

function dateToFrenchWeekday(dateStr: string): CareWeekday {
  const d = new Date(dateStr + 'T12:00:00');
  return WEEKDAY_MAP[d.getDay()];
}

/** Combine a date string (YYYY-MM-DD) and time (HH:MM) into a Date in Europe/Paris. */
function buildTimestamp(dateStr: string, time: string): Date {
  // Create a date in UTC, then compute the offset for Europe/Paris
  // by comparing the local representation to UTC
  const utcProbe = new Date(`${dateStr}T${time}:00Z`);
  const parisStr = utcProbe.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' });
  // parisStr is "YYYY-MM-DD HH:MM:SS" — parse back as UTC
  const parisAsUtc = new Date(parisStr.replace(' ', 'T') + 'Z');
  // Offset = Paris time - UTC time (in ms)
  const offsetMs = parisAsUtc.getTime() - utcProbe.getTime();
  // Desired local time interpreted as Europe/Paris, converted to UTC
  const localAsUtc = new Date(`${dateStr}T${time}:00Z`);
  return new Date(localAsUtc.getTime() - offsetMs);
}

// ── Transform ───────────────────────────────────────────────────────────────

function toAttendance(record: typeof attendances.$inferSelect): Attendance {
  return {
    id: record.id,
    childId: record.childId,
    date: record.date,
    status: record.status as AttendanceStatus,
    arrivalTime: record.arrivalTime?.toISOString() ?? null,
    arrivalPersonType: (record.arrivalPersonType as PersonType) ?? null,
    arrivalPersonId: record.arrivalPersonId ?? null,
    arrivalMethod: (record.arrivalMethod as CheckMethod) ?? null,
    departureTime: record.departureTime?.toISOString() ?? null,
    departurePersonType: (record.departurePersonType as PersonType) ?? null,
    departurePersonId: record.departurePersonId ?? null,
    departureMethod: (record.departureMethod as CheckMethod) ?? null,
    notes: record.notes ?? '',
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** Get a single attendance record by ID. Used for ownership verification. */
export async function getAttendanceById(
  db: DrizzleDB,
  attendanceId: string
): Promise<Attendance | null> {
  try {
    const [record] = await db.select()
      .from(attendances)
      .where(eq(attendances.id, attendanceId));
    return record ? toAttendance(record) : null;
  } catch {
    return null;
  }
}

/** Get all children for an assistante with their attendance for a given date. */
export async function getAttendancesByDate(
  db: DrizzleDB,
  assistanteId: string,
  date: string
): Promise<AttendanceWithChild[]> {
  try {
    // Step 1: get all children with their parent IDs
    const childRows = await db.select({
      child: children,
      parentId: parentChildren.parentId,
    })
      .from(children)
      .leftJoin(parentChildren, eq(children.id, parentChildren.childId))
      .where(eq(children.assistanteId, assistanteId))
      .orderBy(children.firstName);

    if (childRows.length === 0) return [];

    // Group parent IDs by child
    const childMap = new Map<string, { record: typeof children.$inferSelect; parentIds: string[] }>();
    for (const row of childRows) {
      const existing = childMap.get(row.child.id);
      if (existing) {
        if (row.parentId) existing.parentIds.push(row.parentId);
      } else {
        childMap.set(row.child.id, {
          record: row.child,
          parentIds: row.parentId ? [row.parentId] : [],
        });
      }
    }

    const childIds = [...childMap.keys()];

    // Step 2: get attendances for those children on the given date
    const attendanceRows = await db.select()
      .from(attendances)
      .where(and(
        inArray(attendances.childId, childIds),
        eq(attendances.date, date)
      ));

    const attendanceMap = new Map<string, typeof attendances.$inferSelect>();
    for (const row of attendanceRows) {
      attendanceMap.set(row.childId, row);
    }

    // Step 3: merge
    const weekday = dateToFrenchWeekday(date);
    const result: AttendanceWithChild[] = [];

    for (const { record, parentIds } of childMap.values()) {
      const schedule = (record.careSchedule ?? {}) as CareSchedule;
      const daySchedule = schedule[weekday] ?? null;
      const att = attendanceMap.get(record.id);

      if (att) {
        result.push({
          ...toAttendance(att),
          childFirstName: record.firstName,
          childLastName: record.lastName,
          childAvatar: record.avatar || null,
          expectedStart: daySchedule?.start ?? null,
          expectedEnd: daySchedule?.end ?? null,
          parentIds,
        });
      } else {
        // No attendance record yet — build a placeholder
        result.push({
          id: '',
          childId: record.id,
          date,
          status: 'present',
          arrivalTime: null,
          arrivalPersonType: null,
          arrivalPersonId: null,
          arrivalMethod: null,
          departureTime: null,
          departurePersonType: null,
          departurePersonId: null,
          departureMethod: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
          childFirstName: record.firstName,
          childLastName: record.lastName,
          childAvatar: record.avatar || null,
          expectedStart: daySchedule?.start ?? null,
          expectedEnd: daySchedule?.end ?? null,
          parentIds,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

/** Get attendance for a parent's children on a given date. */
export async function getAttendancesForParent(
  db: DrizzleDB,
  parentId: string,
  date: string
): Promise<AttendanceWithChild[]> {
  try {
    const pcRows = await db.select({ child: children })
      .from(parentChildren)
      .innerJoin(children, eq(parentChildren.childId, children.id))
      .where(eq(parentChildren.parentId, parentId));

    if (pcRows.length === 0) return [];

    const childIds = pcRows.map(r => r.child.id);
    const attendanceRows = await db.select()
      .from(attendances)
      .where(and(inArray(attendances.childId, childIds), eq(attendances.date, date)));

    const attendanceMap = new Map<string, typeof attendances.$inferSelect>();
    for (const row of attendanceRows) {
      attendanceMap.set(row.childId, row);
    }

    const weekday = dateToFrenchWeekday(date);
    const result: AttendanceWithChild[] = [];

    for (const { child: record } of pcRows) {
      const schedule = (record.careSchedule ?? {}) as CareSchedule;
      const daySchedule = schedule[weekday] ?? null;
      const att = attendanceMap.get(record.id);

      if (att) {
        result.push({
          ...toAttendance(att),
          childFirstName: record.firstName,
          childLastName: record.lastName,
          childAvatar: record.avatar || null,
          expectedStart: daySchedule?.start ?? null,
          expectedEnd: daySchedule?.end ?? null,
          parentIds: [parentId],
        });
      } else {
        result.push({
          id: '',
          childId: record.id,
          date,
          status: 'present',
          arrivalTime: null,
          arrivalPersonType: null,
          arrivalPersonId: null,
          arrivalMethod: null,
          departureTime: null,
          departurePersonType: null,
          departurePersonId: null,
          departureMethod: null,
          notes: '',
          createdAt: '',
          updatedAt: '',
          childFirstName: record.firstName,
          childLastName: record.lastName,
          childAvatar: record.avatar || null,
          expectedStart: daySchedule?.start ?? null,
          expectedEnd: daySchedule?.end ?? null,
          parentIds: [parentId],
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function markArrival(
  db: DrizzleDB,
  data: {
    childId: string;
    date: string;
    personType: PersonType;
    personId: string;
    method: CheckMethod;
    scannedBy: string;
    time?: string;
  }
): Promise<Attendance | null> {
  try {
    const arrivalTime = data.time
      ? buildTimestamp(data.date, data.time)
      : new Date();

    const [record] = await db.insert(attendances).values({
      childId: data.childId,
      date: data.date,
      status: 'present',
      arrivalTime,
      arrivalPersonType: data.personType,
      arrivalPersonId: data.personId,
      arrivalMethod: data.method,
      arrivalScannedBy: data.scannedBy,
    }).onConflictDoUpdate({
      target: [attendances.childId, attendances.date],
      set: {
        status: 'present',
        arrivalTime,
        arrivalPersonType: data.personType,
        arrivalPersonId: data.personId,
        arrivalMethod: data.method,
        arrivalScannedBy: data.scannedBy,
        updatedAt: new Date(),
      },
    }).returning();

    return record ? toAttendance(record) : null;
  } catch {
    return null;
  }
}

export async function markDeparture(
  db: DrizzleDB,
  data: {
    childId: string;
    date: string;
    personType: PersonType;
    personId: string;
    method: CheckMethod;
    scannedBy: string;
    time?: string;
  }
): Promise<Attendance | null> {
  try {
    // Verify an arrival exists before recording departure
    const [existing] = await db.select()
      .from(attendances)
      .where(and(
        eq(attendances.childId, data.childId),
        eq(attendances.date, data.date),
      ));
    if (!existing || !existing.arrivalTime) return null;

    const departureTime = data.time
      ? buildTimestamp(data.date, data.time)
      : new Date();

    const [record] = await db.update(attendances).set({
      departureTime,
      departurePersonType: data.personType,
      departurePersonId: data.personId,
      departureMethod: data.method,
      departureScannedBy: data.scannedBy,
      updatedAt: new Date(),
    }).where(and(
      eq(attendances.childId, data.childId),
      eq(attendances.date, data.date),
    )).returning();

    return record ? toAttendance(record) : null;
  } catch {
    return null;
  }
}

export async function markAbsent(
  db: DrizzleDB,
  data: {
    childId: string;
    date: string;
    status: 'absent_planned' | 'absent_unplanned';
    notes?: string;
  }
): Promise<Attendance | null> {
  try {
    const [record] = await db.insert(attendances).values({
      childId: data.childId,
      date: data.date,
      status: data.status,
      notes: data.notes ?? '',
    }).onConflictDoUpdate({
      target: [attendances.childId, attendances.date],
      set: {
        status: data.status,
        arrivalTime: null,
        arrivalPersonType: null,
        arrivalPersonId: null,
        arrivalMethod: null,
        arrivalScannedBy: null,
        departureTime: null,
        departurePersonType: null,
        departurePersonId: null,
        departureMethod: null,
        departureScannedBy: null,
        notes: data.notes ?? '',
        updatedAt: new Date(),
      },
    }).returning();

    return record ? toAttendance(record) : null;
  } catch {
    return null;
  }
}

export async function updateAttendance(
  db: DrizzleDB,
  attendanceId: string,
  updates: {
    arrivalTime?: string;
    departureTime?: string;
    notes?: string;
  }
): Promise<Attendance | null> {
  try {
    // Fetch original to get the date for timestamp reconstruction
    const [existing] = await db.select()
      .from(attendances)
      .where(eq(attendances.id, attendanceId));

    if (!existing) return null;

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.arrivalTime !== undefined) {
      set.arrivalTime = buildTimestamp(existing.date, updates.arrivalTime);
    }
    if (updates.departureTime !== undefined) {
      set.departureTime = buildTimestamp(existing.date, updates.departureTime);
    }
    if (updates.notes !== undefined) {
      set.notes = updates.notes;
    }

    const [record] = await db.update(attendances)
      .set(set)
      .where(eq(attendances.id, attendanceId))
      .returning();

    return record ? toAttendance(record) : null;
  } catch {
    return null;
  }
}

export async function cancelAttendance(
  db: DrizzleDB,
  childId: string,
  date: string
): Promise<boolean> {
  try {
    await db.delete(attendances).where(and(
      eq(attendances.childId, childId),
      eq(attendances.date, date),
    ));
    return true;
  } catch {
    return false;
  }
}

export async function getMonthlyAttendances(
  db: DrizzleDB,
  childIds: string[],
  startDate: string,
  endDate: string
): Promise<Attendance[]> {
  try {
    if (childIds.length === 0) return [];

    const records = await db.select()
      .from(attendances)
      .where(and(
        inArray(attendances.childId, childIds),
        gte(attendances.date, startDate),
        lte(attendances.date, endDate),
      ))
      .orderBy(desc(attendances.date));

    return records.map(toAttendance);
  } catch {
    return [];
  }
}

// ── Reports ─────────────────────────────────────────────────────────────────

/** Parse HH:MM into fractional hours. */
function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

/** Compute hours between two ISO timestamps. */
function isoTimeDiffHours(arrival: string, departure: string): number {
  const diff = new Date(departure).getTime() - new Date(arrival).getTime();
  return Math.max(0, diff / 3600000);
}

/** Generate all dates in a month as YYYY-MM-DD strings. */
function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = d.toString().padStart(2, '0');
    const mm = (month + 1).toString().padStart(2, '0');
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
}

/** Build a monthly report comparing expected vs actual hours per child. */
export async function getMonthlyReport(
  db: DrizzleDB,
  assistanteId: string,
  year: number,
  month: number // 0-indexed
): Promise<MonthlyChildReport[]> {
  try {
    // Get all children for the assistante
    const childRows = await db.select()
      .from(children)
      .where(eq(children.assistanteId, assistanteId))
      .orderBy(children.firstName);

    if (childRows.length === 0) return [];

    const childIds = childRows.map(c => c.id);
    const dates = getMonthDates(year, month);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Fetch all attendances for the month
    const monthAttendances = await getMonthlyAttendances(db, childIds, startDate, endDate);

    // Index by childId + date
    const attMap = new Map<string, Attendance>();
    for (const att of monthAttendances) {
      attMap.set(`${att.childId}:${att.date}`, att);
    }

    return childRows.map(child => {
      const schedule = (child.careSchedule ?? {}) as CareSchedule;
      let expectedHours = 0;
      let actualHours = 0;
      let daysPresent = 0;
      let daysAbsentPlanned = 0;
      let daysAbsentUnplanned = 0;
      let daysExpected = 0;

      for (const dateStr of dates) {
        const weekday = dateToFrenchWeekday(dateStr);
        const daySchedule = schedule[weekday];

        // Skip days with no scheduled care
        if (!daySchedule) continue;
        daysExpected++;

        const dayExpected = timeToHours(daySchedule.end) - timeToHours(daySchedule.start);
        expectedHours += dayExpected;

        const att = attMap.get(`${child.id}:${dateStr}`);
        if (!att) continue; // No attendance record — counts as 0 actual hours

        if (att.status === 'absent_planned') {
          daysAbsentPlanned++;
        } else if (att.status === 'absent_unplanned') {
          daysAbsentUnplanned++;
        } else if (att.arrivalTime && att.departureTime) {
          daysPresent++;
          actualHours += isoTimeDiffHours(att.arrivalTime, att.departureTime);
        } else if (att.arrivalTime) {
          // Still present (no departure yet) — cap at expected end time or now, whichever is earlier
          daysPresent++;
          const now = new Date().toISOString();
          const capTime = daySchedule ? buildTimestamp(dateStr, daySchedule.end).toISOString() : now;
          const endTime = capTime < now ? capTime : now;
          actualHours += isoTimeDiffHours(att.arrivalTime, endTime);
        }
      }

      return {
        childId: child.id,
        childFirstName: child.firstName,
        childLastName: child.lastName,
        childAvatar: child.avatar || null,
        expectedHours: Math.round(expectedHours * 100) / 100,
        actualHours: Math.round(actualHours * 100) / 100,
        deltaHours: Math.round((actualHours - expectedHours) * 100) / 100,
        daysPresent,
        daysAbsentPlanned,
        daysAbsentUnplanned,
        daysExpected,
      };
    });
  } catch {
    return [];
  }
}
