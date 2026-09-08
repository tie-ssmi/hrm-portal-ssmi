import { format, isWeekend } from 'date-fns'

// Replaces the two verbatim-duplicated `calcDuration` functions that used to
// live in components/dashboard/leave-request-form.tsx and
// app/dashboard/approv/leave/instead/page.tsx.

export type CountMode = 'workingDays' | 'calendarDays'
export type Period = 'morning' | 'afternoon'

export interface CalcLeaveDurationArgs {
  startDate?: Date
  startPeriod?: Period
  endDate?: Date
  endPeriod?: Period
  holidayDateKeys?: Set<string>
  countMode?: CountMode
}

// dayFraction on a holiday (see services/officialHolidays.ts) is
// deliberately NOT subtracted fractionally here — a date present in
// holidayDateKeys excludes the whole day. The admin repo's live Cloud
// Function (countLeaveDaysInRange, the thing that actually deducts from an
// employee's real balance) does the same — matching it keeps this preview
// number consistent with what's actually deducted, rather than being a
// more "correct" number that quietly disagrees with the real one.
export function calcLeaveDuration({
  startDate,
  startPeriod = 'morning',
  endDate,
  endPeriod = 'afternoon',
  holidayDateKeys = new Set(),
  countMode = 'workingDays',
}: CalcLeaveDurationArgs): number | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (start > end) return null

  if (countMode === 'calendarDays') {
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    return totalDays > 0 ? totalDays : null
  }

  let halfDays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dateKey = format(cursor, 'yyyy-MM-dd')
    if (!isWeekend(cursor) && !holidayDateKeys.has(dateKey)) {
      const isStartDay = cursor.getTime() === start.getTime()
      const isEndDay = cursor.getTime() === end.getTime()
      if (isStartDay && isEndDay) {
        const startIndex = startPeriod === 'morning' ? 0 : 1
        const endIndex = endPeriod === 'morning' ? 0 : 1
        const sameDayHalfDays = endIndex - startIndex + 1
        if (sameDayHalfDays <= 0) return null
        halfDays += sameDayHalfDays
      } else if (isStartDay) {
        halfDays += startPeriod === 'morning' ? 2 : 1
      } else if (isEndDay) {
        halfDays += endPeriod === 'afternoon' ? 2 : 1
      } else {
        halfDays += 2
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return halfDays > 0 ? halfDays / 2 : null
}

export interface MaxLeaveEndDateArgs extends Omit<CalcLeaveDurationArgs, 'endDate'> {
  /** Policy balance the request has to fit inside. */
  remainingDays?: number
  /**
   * Assume the last day can be trimmed to a half day, so a balance ending in
   * .5 still reaches the further date — 4.5 days from Mon 07/09 gets to Fri
   * 11/09 by finishing at midday. Only pass this where the caller then fits
   * the end period to the balance (the leave form does, on selection);
   * otherwise the cap would offer a date the chosen periods overrun.
   */
  fitEndPeriod?: boolean
}

// Walk forward a generous but bounded horizon — a balance large enough to
// run past this would be a data problem, not a request someone is typing.
const MAX_END_DATE_HORIZON_DAYS = 400

/**
 * The latest end date whose resulting duration still fits inside
 * `remainingDays`, counted by exactly the rules calcLeaveDuration uses.
 *
 * Because weekends and holidays cost nothing in 'workingDays' mode, the
 * answer stretches past them: 5 days from Mon 07/09 normally ends Fri 11/09,
 * but if 11/09 is a holiday the fifth working day falls on Mon 14/09.
 *
 * Returns null when there is nothing to cap against (no start date, no
 * balance, or a balance too small for even one half-day).
 */
export function getMaxLeaveEndDate({
  startDate,
  startPeriod = 'morning',
  endPeriod = 'afternoon',
  holidayDateKeys = new Set(),
  countMode = 'workingDays',
  remainingDays,
  fitEndPeriod = false,
}: MaxLeaveEndDateArgs): Date | null {
  if (!startDate || remainingDays == null || remainingDays <= 0) return null

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  if (countMode === 'calendarDays') {
    // Every day costs 1 here, periods included — mirror calcLeaveDuration.
    const whole = Math.floor(remainingDays)
    if (whole < 1) return null
    const end = new Date(start)
    end.setDate(end.getDate() + whole - 1)
    return end
  }

  const budgetHalfDays = Math.floor(remainingDays * 2)
  if (budgetHalfDays < 1) return null

  const startIndex = startPeriod === 'morning' ? 0 : 1
  const endIndex = endPeriod === 'morning' ? 0 : 1
  // Half-days consumed by every counted day before the cursor, with the start
  // day already charged at its partial rate.
  let prefixHalfDays = 0
  let maxEnd: Date | null = null

  const cursor = new Date(start)
  for (let step = 0; step < MAX_END_DATE_HORIZON_DAYS; step++) {
    const dateKey = format(cursor, 'yyyy-MM-dd')
    if (!isWeekend(cursor) && !holidayDateKeys.has(dateKey)) {
      const isStartDay = cursor.getTime() === start.getTime()
      // What the range would total if it ended on this day. Under
      // fitEndPeriod the end day is charged at its cheapest — one half day,
      // which is also the floor for a same-day range whatever the periods.
      const totalIfEndsHere = isStartDay
        ? fitEndPeriod
          ? 1
          : endIndex - startIndex + 1
        : prefixHalfDays + (fitEndPeriod || endPeriod === 'morning' ? 1 : 2)

      if (totalIfEndsHere > budgetHalfDays) break
      if (totalIfEndsHere > 0) maxEnd = new Date(cursor)

      prefixHalfDays += isStartDay ? (startPeriod === 'morning' ? 2 : 1) : 2
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return maxEnd
}
