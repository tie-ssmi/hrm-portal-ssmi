import { addDays, format, parseISO } from 'date-fns'

import { isLeapYear, isWorkingDayKey } from '@/lib/birthday-leave'

// Birthday greeting popup — shown only to the employee whose birthday it is.
// Window: from the birthday itself through the first working day on/after it,
// so a birthday on a weekend/holiday is still greeted (belatedly) on the next
// working day. Pure date-key logic; no `new Date(dateOfBirth)` (UTC shift).

export interface BirthdayGreeting {
  birthdayKey: string // YYYY-MM-DD of this year's birthday
  isBelated: boolean
}

// Upper bound on the walk to the next working day (long holidays like Pi Mai).
const MAX_WINDOW_DAYS = 14

export function birthdayKeyForYear(dateOfBirth: string, year: number): string | null {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(dateOfBirth ?? '')
  if (!match) return null
  const [, monthStr, dayStr] = match
  // Feb 29 in a non-leap year → Feb 28 (same rule as birthday leave)
  const day = monthStr === '02' && dayStr === '29' && !isLeapYear(year) ? '28' : dayStr
  return `${year}-${monthStr}-${day}`
}

// todayKey: Vientiane date (getVientianeIsoDate). Returns null when today is
// outside this year's greeting window.
export function getBirthdayGreeting(
  dateOfBirth: string | undefined,
  todayKey: string,
  holidayDateKeys: ReadonlySet<string> = new Set(),
): BirthdayGreeting | null {
  if (!dateOfBirth) return null
  const year = Number(todayKey.slice(0, 4))
  // Previous year too: a late-December birthday's window can cross into January.
  for (const y of [year, year - 1]) {
    const greeting = greetingForYear(dateOfBirth, y, todayKey, holidayDateKeys)
    if (greeting) return greeting
  }
  return null
}

function greetingForYear(
  dateOfBirth: string,
  year: number,
  todayKey: string,
  holidayDateKeys: ReadonlySet<string>,
): BirthdayGreeting | null {
  const birthdayKey = birthdayKeyForYear(dateOfBirth, year)
  if (!birthdayKey) return null
  if (todayKey === birthdayKey) return { birthdayKey, isBelated: false }
  if (todayKey < birthdayKey) return null

  // Today is after the birthday: greet only if every day from the birthday
  // up to (not including) today was a non-working day.
  if (isWorkingDayKey(birthdayKey, holidayDateKeys)) return null
  let cursor = parseISO(birthdayKey)
  for (let i = 0; i < MAX_WINDOW_DAYS; i++) {
    cursor = addDays(cursor, 1)
    const key = format(cursor, 'yyyy-MM-dd')
    if (key === todayKey) return { birthdayKey, isBelated: true }
    if (isWorkingDayKey(key, holidayDateKeys)) return null
  }
  return null
}

export function birthdayShownStorageKey(uid: string, year: string): string {
  return `ssmi_bday_${uid}_${year}`
}
