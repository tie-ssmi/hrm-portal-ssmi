import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Mirrors the admin repo's workCalendars schema
// (HRM-System-SSMI/frontend/src/services/workCalendars.ts). Portal is
// read-only here — holiday/calendar management is admin's job.

export interface WeeklyPattern {
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

export interface WorkCalendar {
  calendarId: string
  nameLo: string
  timezone: string
  weeklyPattern: WeeklyPattern
  workHoursPerDay: number
  isDefault: boolean
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null
}

// HR decision: Sat/Sun are not working days, one global calendar company-wide
// (branch differences are handled via officialHoliday.scope, not per-branch
// calendars). Used as a fallback if workCalendars/LA-2026 hasn't been seeded
// in Firestore yet — not currently consulted by lib/leave-duration.ts, which
// (like the admin repo's own day-counters) hardcodes the Sat/Sun check
// directly rather than reading this collection. Kept here so
// Employee.workCalendarId has a real collection to eventually point at.
export const FALLBACK_WORK_CALENDAR: WorkCalendar = {
  calendarId: 'LA-2026',
  nameLo: 'ປະຕິທິນເຮັດວຽກ ສປປ ລາວ 2026',
  timezone: 'Asia/Vientiane',
  weeklyPattern: { mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 0, sun: 0 },
  workHoursPerDay: 8,
  isDefault: true,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
}

function normalizeWorkCalendar(data: Record<string, unknown>): WorkCalendar {
  return {
    calendarId: (data.calendarId as string) ?? FALLBACK_WORK_CALENDAR.calendarId,
    nameLo: (data.nameLo as string) ?? FALLBACK_WORK_CALENDAR.nameLo,
    timezone: (data.timezone as string) ?? FALLBACK_WORK_CALENDAR.timezone,
    weeklyPattern: (data.weeklyPattern as WeeklyPattern) ?? FALLBACK_WORK_CALENDAR.weeklyPattern,
    workHoursPerDay: (data.workHoursPerDay as number) ?? FALLBACK_WORK_CALENDAR.workHoursPerDay,
    isDefault: (data.isDefault as boolean) ?? true,
    effectiveFrom: (data.effectiveFrom as string) ?? FALLBACK_WORK_CALENDAR.effectiveFrom,
    effectiveTo: (data.effectiveTo as string | null) ?? null,
  }
}

export async function getDefaultWorkCalendar(): Promise<WorkCalendar> {
  try {
    const q = query(collection(db, 'workCalendars'), where('isDefault', '==', true), limit(1))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return FALLBACK_WORK_CALENDAR
    return normalizeWorkCalendar(snapshot.docs[0].data())
  } catch (error) {
    console.error('Error fetching default work calendar:', error)
    return FALLBACK_WORK_CALENDAR
  }
}
