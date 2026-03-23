import type { PageServerLoad } from './$types';
import { getAllDailyLogs } from '$lib/domain/daily_logs';
import { getMenusForDate } from '$lib/domain/menus';
import { listCalendarEventsForAssistant, countUnacknowledgedNotes, countUnseenResponses } from '$lib/domain/parent_notes';
import { getNewsForChildren } from '$lib/domain/news';
import { requireAuth, toLocalDateStr } from '$lib/server/helpers';
import { getAvatarPublicUrl } from '$lib/server/storage';
import { getChildAvatarUrl } from '$lib/utils/avatar';
import type { MealEntry, NapEntry, HealthEntry, MoodLevel } from '$lib/types';

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

  const [todayLogs, todayMenus, pendingCount, todayAbsences, rawNews, calendarEvents] = await Promise.all([
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

  return {
    firstName: user.name.split(' ')[0],
    today,
    role,
    children: childrenWithJournal,
    totalChildren: children.length,
    presentCount,
    journaledCount: loggedChildIds.size,
    hasTodayMenu: todayMenus.length > 0,
    pendingCount,
    moodCounts,
    recentNews,
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth(),
    calendarEvents
  };
};
