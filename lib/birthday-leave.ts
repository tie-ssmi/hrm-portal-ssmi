import { addDays, format, isWeekend, parseISO } from 'date-fns'

// POL-008 — company birthday-leave policy. Not implemented anywhere yet (in
// either repo) as of this writing; this is a pure utility staged ahead of
// admin's POL-008 policy doc + balance engine. Not called from any page —
// wiring it into a UI or a balance write is follow-up work once that policy
// doc exists server-side.
//
// Do NOT confuse this with official-holiday substitute days
// (services/officialHolidays.ts `substitute`): government holidays only
// shift when the government announces a substitute day — this app never
// auto-generates one. Birthday leave is an internal company policy, so it
// DOES auto-shift to the nearest working day, entirely client-side.

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function isWorkingDayKey(dateKey: string, holidayDateKeys: ReadonlySet<string>): boolean {
  return !isWeekend(parseISO(dateKey)) && !holidayDateKeys.has(dateKey)
}

// dateOfBirth: "YYYY-MM-DD" (only month/day are used). year: the calendar
// year to resolve the leave date for. holidayDateKeys: build via
// buildHolidayDateKeySet(holidays, workLocationUuid) so scope is respected.
// Returns null if no working day exists within the same month (reported to
// HR — the entitlement is lost for the year, per the design doc).
export function resolveBirthdayLeaveDate(
  dateOfBirth: string,
  year: number,
  holidayDateKeys: ReadonlySet<string> = new Set(),
): string | null {
  const [, monthStr, dayStr] = dateOfBirth.split('-')
  if (!monthStr || !dayStr) return null

  // Feb 29 in a non-leap year doesn't exist — HR decision: use Feb 28.
  const day = monthStr === '02' && dayStr === '29' && !isLeapYear(year) ? '28' : dayStr
  const targetKey = `${year}-${monthStr}-${day}`

  if (isWorkingDayKey(targetKey, holidayDateKeys)) return targetKey

  const monthPrefix = `${year}-${monthStr}`
  const target = parseISO(targetKey)
  for (let offset = 1; offset <= 10; offset++) {
    for (const candidateDate of [addDays(target, offset), addDays(target, -offset)]) {
      const candidateKey = format(candidateDate, 'yyyy-MM-dd')
      if (!candidateKey.startsWith(monthPrefix)) continue // never cross into another month
      if (isWorkingDayKey(candidateKey, holidayDateKeys)) return candidateKey
    }
  }
  return null
}
