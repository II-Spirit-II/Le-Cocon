/**
 * Monthly Attendance Report — Server
 * Assistante only. Compares expected vs actual hours per child.
 */
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/helpers';
import { getMonthlyReport } from '$lib/domain/attendance';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireRole(locals.user, 'assistante');

  const now = new Date();
  const yearParam = url.searchParams.get('year');
  const monthParam = url.searchParams.get('month');

  const parsedYear = yearParam ? parseInt(yearParam, 10) : NaN;
  const parsedMonth = monthParam ? parseInt(monthParam, 10) : NaN;
  const year = !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100 ? parsedYear : now.getFullYear();
  const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth - 1 : now.getMonth();

  const report = await getMonthlyReport(locals.db, locals.user.id, year, month);

  // Totals
  const totalExpected = report.reduce((s, r) => s + r.expectedHours, 0);
  const totalActual = report.reduce((s, r) => s + r.actualHours, 0);
  const totalPresent = report.reduce((s, r) => s + r.daysPresent, 0);
  const totalAbsent = report.reduce((s, r) => s + r.daysAbsentPlanned + r.daysAbsentUnplanned, 0);

  return {
    report,
    year,
    month: month + 1, // back to 1-indexed for URL/display
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalDelta: Math.round((totalActual - totalExpected) * 100) / 100,
    totalPresent,
    totalAbsent,
  };
};
