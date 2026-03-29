/**
 * Attendance Page — Server
 *
 * Both roles see the page; only assistante can perform actions.
 * Parents get a read-only view of their children's attendance.
 */
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { requireAuth, requireRole, assertChildAccess, createRateLimiter } from '$lib/server/helpers';
import { getChildById } from '$lib/domain/children';
import {
  getAttendancesByDate,
  getAttendancesForParent,
  getAttendanceById,
  markArrival,
  markDeparture,
  markAbsent,
  updateAttendance,
  cancelAttendance,
} from '$lib/domain/attendance';
import { getAuthorizedPersonsForChildren } from '$lib/domain/authorized_persons';
import {
  markArrivalSchema,
  markDepartureSchema,
  markAbsentSchema,
  editAttendanceSchema,
  parseFormData,
} from '$lib/server/validation';
import { users } from '$lib/server/db/schema';

const checkActionRate = createRateLimiter(30, 60_000); // 30 mutations/min

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  requireAuth(locals.user);
  const { db, user } = locals;

  const dateParam = url.searchParams.get('date');
  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isToday = date === today;

  // Get attendances based on role
  const attendancesList = user.role === 'assistante'
    ? await getAttendancesByDate(db, user.id, date)
    : await getAttendancesForParent(db, user.id, date);

  // Get parent names for the check-in dropdown (assistante only)
  let parentsMap: Record<string, string> = {};
  let authorizedPersonsMap: Record<string, Array<{ id: string; name: string; relationship: string }>> = {};

  if (user.role === 'assistante') {
    // Collect unique parent IDs from all children
    const allParentIds = [...new Set(attendancesList.flatMap(a => a.parentIds))];

    if (allParentIds.length > 0) {
      const parentRows = await db.select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, allParentIds));
      parentsMap = Object.fromEntries(parentRows.map(p => [p.id, p.name]));
    }

    // Get authorized persons for all children in one query
    const childIds = attendancesList.map(a => a.childId);
    const authorizedMap = await getAuthorizedPersonsForChildren(db, childIds);
    for (const childId of childIds) {
      const persons = authorizedMap.get(childId) ?? [];
      authorizedPersonsMap[childId] = persons.map(p => ({
        id: p.id,
        name: p.name,
        relationship: p.relationship,
      }));
    }
  }

  return {
    date,
    isToday,
    attendances: attendancesList,
    parentsMap,
    authorizedPersonsMap,
    role: user.role,
  };
};

export const actions: Actions = {
  checkin: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');
    if (!checkActionRate(locals.user.id)) return fail(429, { error: 'Trop de requêtes' });

    const formData = await request.formData();
    const v = parseFormData(markArrivalSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const child = await getChildById(locals.db, v.data.childId);
    assertChildAccess(child, locals.user);

    const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const result = await markArrival(locals.db, {
      childId: v.data.childId,
      date: today,
      personType: v.data.personType,
      personId: v.data.personId,
      method: 'manual',
      scannedBy: locals.user.id,
      time: v.data.time,
    });

    if (!result) return fail(500, { error: "Erreur lors du pointage d'arrivée" });
    return { success: true, action: 'checkin' };
  },

  checkout: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');
    if (!checkActionRate(locals.user.id)) return fail(429, { error: 'Trop de requêtes' });

    const formData = await request.formData();
    const v = parseFormData(markDepartureSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const child = await getChildById(locals.db, v.data.childId);
    assertChildAccess(child, locals.user);

    const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const result = await markDeparture(locals.db, {
      childId: v.data.childId,
      date: today,
      personType: v.data.personType,
      personId: v.data.personId,
      method: 'manual',
      scannedBy: locals.user.id,
      time: v.data.time,
    });

    if (!result) return fail(500, { error: 'Erreur lors du pointage de départ' });
    return { success: true, action: 'checkout' };
  },

  absent: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');
    if (!checkActionRate(locals.user.id)) return fail(429, { error: 'Trop de requêtes' });

    const formData = await request.formData();
    const v = parseFormData(markAbsentSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    const child = await getChildById(locals.db, v.data.childId);
    assertChildAccess(child, locals.user);

    const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const result = await markAbsent(locals.db, {
      childId: v.data.childId,
      date: today,
      status: v.data.status,
      notes: v.data.notes,
    });

    if (!result) return fail(500, { error: "Erreur lors du marquage d'absence" });
    return { success: true, action: 'absent' };
  },

  edit: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');
    if (!checkActionRate(locals.user.id)) return fail(429, { error: 'Trop de requêtes' });

    const formData = await request.formData();
    const v = parseFormData(editAttendanceSchema, formData);
    if (!v.ok) return fail(400, { error: v.error });

    // Verify the attendance record belongs to a child managed by this assistante
    const att = await getAttendanceById(locals.db, v.data.attendanceId);
    if (!att) return fail(404, { error: 'Pointage introuvable' });
    const child = await getChildById(locals.db, att.childId);
    assertChildAccess(child, locals.user);

    const result = await updateAttendance(locals.db, v.data.attendanceId, {
      arrivalTime: v.data.arrivalTime,
      departureTime: v.data.departureTime,
      notes: v.data.notes,
    });

    if (!result) return fail(500, { error: 'Erreur lors de la modification' });
    return { success: true, action: 'edit' };
  },

  cancel: async ({ request, locals }) => {
    requireRole(locals.user, 'assistante');
    if (!checkActionRate(locals.user.id)) return fail(429, { error: 'Trop de requêtes' });

    const formData = await request.formData();
    const rawChildId = formData.get('childId')?.toString() ?? '';
    if (!rawChildId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawChildId)) {
      return fail(400, { error: 'Enfant manquant' });
    }

    const child = await getChildById(locals.db, rawChildId);
    assertChildAccess(child, locals.user);

    const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    const result = await cancelAttendance(locals.db, rawChildId, today);

    if (!result) return fail(500, { error: "Erreur lors de l'annulation" });
    return { success: true, action: 'cancel' };
  },
};
