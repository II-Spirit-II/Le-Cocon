/**
 * Statistiques — Server
 * Aggregates data across all children for the assistante's dashboard.
 */
import type { PageServerLoad } from './$types';
import { requireRole, toLocalDateStr } from '$lib/server/helpers';
import { getAllDailyLogs } from '$lib/domain/daily_logs';
import { getCalendarInsights, getNotesForAssistant } from '$lib/domain/parent_notes';

export const load: PageServerLoad = async ({ locals, url, parent }) => {
  requireRole(locals.user, 'assistante');
  const { db, user } = locals;
  const { children } = await parent();

  const childIds = children.map((c: { id: string }) => c.id);
  const totalChildren = children.length;

  // Period: default 30 days, toggle via ?period=7
  const periodParam = url.searchParams.get('period');
  const periodDays = periodParam === '7' ? 7 : 30;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - periodDays);
  const startStr = toLocalDateStr(startDate);
  const endStr = toLocalDateStr(now);

  // Total possible journal entries for the period
  const businessDays = countBusinessDays(startDate, now);
  const totalPossibleLogs = totalChildren * businessDays;

  const [logs, insights, notes] = await Promise.all([
    getAllDailyLogs(db, { childIds, startDate: startStr, endDate: endStr, limit: 5000 }),
    getCalendarInsights(db),
    getNotesForAssistant(db, user.id),
  ]);

  // Mood distribution
  const moodCounts = { joyeux: 0, calme: 0, grognon: 0 };
  for (const log of logs) {
    if (log.mood in moodCounts) moodCounts[log.mood as keyof typeof moodCounts]++;
  }
  const totalMoods = moodCounts.joyeux + moodCounts.calme + moodCounts.grognon;

  // Meal quality
  let mealTotal = 0;
  let mealScore = 0;
  const MEAL_SCORES: Record<string, number> = {
    'non-mange': 0, 'peu': 1, 'bien': 2, 'tres-bien': 3
  };
  for (const log of logs) {
    for (const meal of log.meals as Array<{ quantity: string }>) {
      mealTotal++;
      mealScore += MEAL_SCORES[meal.quantity] ?? 0;
    }
  }
  const avgMealScore = mealTotal > 0 ? mealScore / mealTotal : 0;

  // Nap stats
  let napCount = 0;
  let napTotalMinutes = 0;
  for (const log of logs) {
    const nap = log.nap as { startTime?: string; endTime?: string } | null;
    if (nap?.startTime && nap?.endTime) {
      napCount++;
      const [sh, sm] = nap.startTime.split(':').map(Number);
      const [eh, em] = nap.endTime.split(':').map(Number);
      napTotalMinutes += (eh * 60 + em) - (sh * 60 + sm);
    }
  }
  const avgNapMinutes = napCount > 0 ? Math.round(napTotalMinutes / napCount) : 0;

  // Changes average
  let changesTotal = 0;
  for (const log of logs) changesTotal += log.changes;
  const avgChanges = logs.length > 0 ? +(changesTotal / logs.length).toFixed(1) : 0;

  // Health alerts count
  let healthAlerts = 0;
  for (const log of logs) {
    const h = log.health as { temperature?: number; symptoms?: string; medication?: string } | null;
    if (h && (h.temperature || h.symptoms || h.medication)) healthAlerts++;
  }

  // Journal completion rate
  const completionRate = totalPossibleLogs > 0
    ? Math.round((logs.length / totalPossibleLogs) * 100)
    : 0;

  // Per-child absence ranking
  const absencesByChild: Record<string, number> = {};
  const retardsByChild: Record<string, number> = {};
  for (const note of notes) {
    if (note.kind === 'absence') {
      absencesByChild[note.childId] = (absencesByChild[note.childId] ?? 0) + 1;
    } else if (note.kind === 'retard') {
      retardsByChild[note.childId] = (retardsByChild[note.childId] ?? 0) + 1;
    }
  }

  const childAbsenceRanking = children
    .map((c: { id: string; firstName: string; lastName: string }) => ({
      id: c.id,
      name: c.firstName,
      absences: absencesByChild[c.id] ?? 0,
      retards: retardsByChild[c.id] ?? 0,
    }))
    .sort((a: { absences: number }, b: { absences: number }) => b.absences - a.absences);

  // Per-child mood breakdown (for top-level chart)
  const childMoods = children.map((c: { id: string; firstName: string }) => {
    const childLogs = logs.filter(l => l.childId === c.id);
    return {
      name: c.firstName,
      joyeux: childLogs.filter(l => l.mood === 'joyeux').length,
      calme: childLogs.filter(l => l.mood === 'calme').length,
      grognon: childLogs.filter(l => l.mood === 'grognon').length,
      total: childLogs.length,
    };
  });

  return {
    periodDays,
    totalChildren,
    totalLogs: logs.length,
    completionRate,
    moodCounts,
    totalMoods,
    avgMealScore,
    avgNapMinutes,
    avgChanges,
    healthAlerts,
    insights,
    childAbsenceRanking,
    childMoods,
  };
};

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
