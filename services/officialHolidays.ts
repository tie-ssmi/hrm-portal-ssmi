import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Schema v2 — mirrors the admin repo's officialHoliday shape exactly
// (HRM-System-SSMI/frontend/src/services/holidays.ts). Both repos deploy
// against the same Firestore project and collection name (kept singular,
// "officialHoliday") — do not rename this to a plural collection, that
// would fragment holiday data across the two apps.
export type HolidayType =
  | 'national'
  | 'traditional'
  | 'religious'
  | 'international'
  | 'company'
  // legacy value from pre-v2 docs — kept so old docs still display, not
  // selectable anywhere in this app (portal has no holiday create/edit UI)
  | 'public_holiday'

export type DateRule = 'fixed' | 'lunar' | 'announced'
export type ScopeMode = 'all' | 'include' | 'exclude'
export type HolidayStatus = 'active' | 'cancelled' | 'moved'

export interface HolidayScope {
  mode: ScopeMode
  locationUuids: string[]
}

export interface HolidaySubstitute {
  isSubstitute: boolean
  substituteForDate: string | null
  substituteForHolidayId: string | null
}

export interface OfficialHoliday {
  id: string
  name: string
  /** @deprecated compat with pre-v2 readers — always equals startDate */
  date: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD — equals startDate for single-day holidays
  dayFraction: number // 1 = full day, 0.5 = half day (not yet used in day-counting, see lib/leave-duration.ts)
  year: number
  type: HolidayType
  dateRule: DateRule
  scope: HolidayScope
  substitute: HolidaySubstitute
  status: HolidayStatus
  announcementRef?: string
  schemaVersion: number
  createdBy?: string
  createdAt?: unknown
  updatedBy?: string
  updatedAt?: unknown
}

const DEFAULT_SCOPE: HolidayScope = { mode: 'all', locationUuids: [] }
const DEFAULT_SUBSTITUTE: HolidaySubstitute = {
  isSubstitute: false,
  substituteForDate: null,
  substituteForHolidayId: null,
}

// Accepts either a v2 doc or a pre-v2 doc (only had name/date/type) and
// backfills defaults for whatever's missing — read-time normalization,
// no Firestore migration needed (same approach as the admin repo).
function normalizeHoliday(id: string, data: Record<string, unknown>): OfficialHoliday {
  const startDate = (data.startDate as string) ?? (data.date as string) ?? ''
  const endDate = (data.endDate as string) ?? startDate

  return {
    id,
    name: (data.name as string) ?? '',
    date: (data.date as string) ?? startDate,
    startDate,
    endDate,
    dayFraction: (data.dayFraction as number) ?? 1,
    year: (data.year as number) ?? (Number(startDate.slice(0, 4)) || 0),
    type: (data.type as HolidayType) ?? 'national',
    dateRule: (data.dateRule as DateRule) ?? 'fixed',
    scope: (data.scope as HolidayScope | undefined) ?? DEFAULT_SCOPE,
    substitute: (data.substitute as HolidaySubstitute | undefined) ?? DEFAULT_SUBSTITUTE,
    status: (data.status as HolidayStatus) ?? 'active',
    announcementRef: data.announcementRef as string | undefined,
    schemaVersion: (data.schemaVersion as number) ?? 1,
    createdBy: data.createdBy as string | undefined,
    createdAt: data.createdAt,
    updatedBy: data.updatedBy as string | undefined,
    updatedAt: data.updatedAt,
  }
}

// Full, unfiltered fetch — cached client-side (see lib/use-official-holidays-query.ts,
// 24h staleTime). Deliberately not a ranged Firestore query: the admin repo's own
// range query (filtering on the legacy `date` field) is documented as missing
// multi-day holidays whose startDate falls before the requested range.
export async function fetchOfficialHolidays(): Promise<OfficialHoliday[]> {
  const snap = await getDocs(collection(db, 'officialHoliday'))
  return snap.docs.map((d) => normalizeHoliday(d.id, d.data()))
}

export function appliesToLocation(scope: HolidayScope, workLocationUuid?: string): boolean {
  if (scope.mode === 'all') return true
  if (!workLocationUuid) return scope.mode === 'exclude'
  if (scope.mode === 'include') return scope.locationUuids.includes(workLocationUuid)
  return !scope.locationUuids.includes(workLocationUuid) // exclude
}

function eachDateKey(startKey: string, endKey: string): string[] {
  if (!startKey || !endKey) return []
  const keys: string[] = []
  const cur = new Date(startKey)
  const endMs = new Date(endKey).getTime()
  while (cur.getTime() <= endMs) {
    keys.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    )
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

// Active + in-scope holidays, expanded from startDate..endDate into a flat
// set of date keys — fixes the pre-v2 behavior of only ever reading the
// single `date` field, which made multi-day holidays (e.g. a 3-day Pi Mai
// Lao entry) show as a single blocked day instead of the full range.
export function buildHolidayDateKeySet(
  holidays: OfficialHoliday[],
  workLocationUuid?: string,
): Set<string> {
  const keys = new Set<string>()
  for (const h of holidays) {
    if (h.status === 'cancelled') continue
    if (!appliesToLocation(h.scope, workLocationUuid)) continue
    for (const key of eachDateKey(h.startDate, h.endDate)) keys.add(key)
  }
  return keys
}
