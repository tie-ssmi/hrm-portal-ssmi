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
