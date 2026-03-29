import type { PageServerLoad } from './$types';
import { getAllDailyLogs } from '$lib/domain/daily_logs';
import { getMenusForDate } from '$lib/domain/menus';
import { listCalendarEventsForAssistant, listCalendarEventsForParent, countUnacknowledgedNotes, countUnseenResponses } from '$lib/domain/parent_notes';
import { getNewsForChildren } from '$lib/domain/news';
import { getAttendancesByDate } from '$lib/domain/attendance';
import { requireAuth, toLocalDateStr } from '$lib/server/helpers';
import { getAvatarPublicUrl } from '$lib/server/storage';
import { getChildAvatarUrl } from '$lib/utils/avatar';
import type { MealEntry, NapEntry, HealthEntry, MoodLevel, CareSchedule } from '$lib/types';

function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: toLocalDateStr(from),
    to: toLocalDateStr(to)
  };
}

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireAuth(locals.user);
  const { db, user } = locals;

  const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const role = user.role;

  const now = new Date();
  const { from: monthFrom, to: monthTo } = getMonthRange(now.getFullYear(), now.getMonth());

  const { children } = await parent();
  const childIds = children.map((c) => c.id);

  const [todayLogs, todayMenus, pendingCount, todayAbsences, rawNews, calendarEvents, attendancesToday] = await Promise.all([
    getAllDailyLogs(db, { childIds, startDate: today, endDate: today }),
    getMenusForDate(db, today),
    role === 'assistante'
      ? countUnacknowledgedNotes(db, user.id)
      : countUnseenResponses(db, user.id),
    role === 'assistante'
      ? listCalendarEventsForAssistant(db, { from: today, to: today, kinds: ['absence'] })
      : Promise.resolve([]),
    getNewsForChildren(db, childIds, 6),
    role === 'assistante'
      ? listCalendarEventsForAssistant(db, { from: monthFrom, to: monthTo })
      : listCalendarEventsForParent(db, user.id, { from: monthFrom, to: monthTo }),
    role === 'assistante'
      ? getAttendancesByDate(db, user.id, today)
      : Promise.resolve([])
  ]);

  const absentChildIds = new Set(todayAbsences.map((a) => a.childId));
  const loggedChildIds = new Set(todayLogs.map((l) => l.childId));

  // For parents: build rich child cards with full journal detail
  const childrenWithJournal = await Promise.all(children.map(async (child) => {
    const log = todayLogs.find((l) => l.childId === child.id) ?? null;
    return {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      avatarPath: child.avatarPath ?? null,
      avatarUrl: child.avatarPath
        ? await getAvatarPublicUrl(locals.db, child.id, child.avatarPath)
        : getChildAvatarUrl(child.firstName + ' ' + child.lastName),
      isAbsent: absentChildIds.has(child.id),
      hasLog: loggedChildIds.has(child.id),
      mood: (log?.mood ?? null) as MoodLevel | null,
      meals: (log?.meals ?? []) as MealEntry[],
      nap: (log?.nap ?? null) as NapEntry | null,
      health: (log?.health ?? null) as HealthEntry | null,
      changes: log?.changes ?? 0,
      notes: log?.notes ?? '',
      careSchedule: (child.careSchedule ?? {}) as CareSchedule,
    };
  }));

  const moodCounts = { grognon: 0, calme: 0, joyeux: 0 };
  todayLogs.forEach((log) => {
    if (log.mood in moodCounts) moodCounts[log.mood as keyof typeof moodCounts]++;
  });

  const presentCount = children.filter((c) => !absentChildIds.has(c.id)).length;

  const childNameMap = new Map(children.map((c) => [c.id, c.firstName]));

  const recentNews = rawNews.map((n) => ({
    id: n.id,
    childId: n.childId,
    childName: childNameMap.get(n.childId) ?? '',
    content: n.content,
    emoji: n.emoji ?? null,
    createdAt: n.createdAt
  }));

  // Attendance summary for dashboard widget
  const attPresent = attendancesToday.filter(a => a.id && a.arrivalTime && !a.departureTime && a.status === 'present');
  const attDeparted = attendancesToday.filter(a => a.id && a.arrivalTime && a.departureTime && a.status === 'present');
  const attAbsent = attendancesToday.filter(a => a.id && (a.status === 'absent_planned' || a.status === 'absent_unplanned'));
  const attNotArrived = attendancesToday.filter(a => !a.id && a.expectedStart);

  const attendanceSummary = attPresent.slice(0, 4).map(a => ({
    firstName: a.childFirstName,
    arrivalTime: a.arrivalTime,
  }));

  return {
    firstName: user.name.split(' ')[0],
    today,
    role,
    children: childrenWithJournal,
    totalChildren: children.length,
    presentCount,
    journaledCount: loggedChildIds.size,
    hasTodayMenu: todayMenus.length > 0,
    todayMenus: todayMenus.map(m => ({ mealType: m.mealType, description: m.description })),
    pendingCount,
    moodCounts,
    recentNews,
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth(),
    calendarEvents,
    attendance: {
      presentCount: attPresent.length,
      departedCount: attDeparted.length,
      absentCount: attAbsent.length,
      notArrivedCount: attNotArrived.length,
      summary: attendanceSummary,
      stillPresentCount: attPresent.length,
    }
  };
};
