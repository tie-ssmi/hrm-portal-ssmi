import { collection, getDocs, query, where, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { db, storage } from '@/lib/firebase'
import type { AttendanceRecord } from '@/lib/types'

let _fns: ReturnType<typeof getFunctions> | null = null
function fns() {
  if (!_fns) _fns = getFunctions(app, 'asia-southeast1')
  return _fns
}

export async function uploadAttendanceImage(file: File, userUuid: string, type: 'checkIn' | 'checkOut'): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `attendance/${userUuid}/${type}_${Date.now()}.${ext}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, file)
  return getDownloadURL(ref)
}

type ServerDateTime = {
  date: Date
  isoDate: string
  time: string
}

type AttendanceLocation = {
  lat: number
  lng: number
}

type UpdateCheckInTimeParams = {
  userUuid: string
  uid?: string
  date: string
  checkInTime: string
  status: 'present' | 'late' | 'not_check_in'
  location?: AttendanceLocation
  accuracy?: number
  createdBy?: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  note?: string | null
  updatedBy?: string
  checkInImageURL?: string
  isOffsite?: boolean
  deviceLocalId?: string
  deviceFingerprint?: string
  department?: {
    name: string
    uid: string
  }
  workLocation?: {
    code?: string
    name: string
    uid?: string
  }
}

type UpdateCheckOutTimeParams = {
  userUuid: string
  uid?: string
  date: string
  checkOutTime: string
  workHours?: number
  location?: AttendanceLocation
  accuracy?: number
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  checkOutImageURL?: string
  deviceLocalId?: string
  deviceFingerprint?: string
  department?: {
    name: string
    uid: string
  }
  workLocation?: {
    code?: string
    name: string
    uid?: string
  }
}

type AttendanceDoc = {
  _id?: string
  userUuid?: string
  uid?: string
  date?: string
  dateKey?: string
  checkInTime?: string | null
  checkOutTime?: string | null
  status?: AttendanceRecord['status'] | 'not_checked_in'
  checkInLocation?: AttendanceRecord['checkInLocation']
  checkOutLocation?: AttendanceRecord['checkOutLocation']
  workHours?: number
  isOffsite?: boolean
  morningLeaveDay?: boolean
  checkInImageURL?: string
  checkOutImageURL?: string
  workLocation?: { name: string; uid?: string; code?: string }
  fullNameLo?: string
  fullNameEn?: string
  employeeImage?: string
  department?: { name: string; uid: string }
}

export function formatAttendanceDocumentDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear().toString()
  return `${day}-${month}-${year}`
}

function parseAttendanceDocumentDate(value: string, dateKey?: string): Date | null {
  // dateKey is YYYY-MM-DD — most reliable, use first
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const d = new Date(`${dateKey}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (!value) return null

  // DD-MM-YYYY (hyphen)
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // DD/MM/YYYY (slash)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/').map(Number)
    return new Date(year, month - 1, day)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isSameMonth(date: Date, target: Date): boolean {
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth()
}

function normalizeAttendanceStatus(status: AttendanceDoc['status']): AttendanceRecord['status'] {
  if (status === 'late') return 'late'
  if (status === 'absent') return 'absent'
  if (status === 'leave') return 'leave'
  if (status === 'offsite') return 'offsite'
  if (status === 'trip') return 'trip'
  if (status === 'not_check_in' || status === 'not_checked_in') return 'not_check_in'
  return 'present'
}

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDateAndTime(dateTimeString: string): ServerDateTime {
  const parsedDate = new Date(dateTimeString)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Invalid date received from server time source.')
  }

  // worldtimeapi already returns the datetime in the requested timezone (Asia/Vientiane).
  // Parsing with new Date() converts to UTC internally, so getUTC*() would return UTC values
  // — off by 7 hours. Extract date and time directly from the local datetime string instead.
  const tIndex = dateTimeString.indexOf('T')
  const isoDate = tIndex > 0 ? dateTimeString.substring(0, tIndex) : dateTimeString.substring(0, 10)
  const time = tIndex > 0 ? dateTimeString.substring(tIndex + 1, tIndex + 6) : '00:00'

  return {
    date: parsedDate,
    isoDate,
    time,
  }
}

export async function getServerDateTimeInVientiane(): Promise<ServerDateTime> {
  const response = await fetch('https://worldtimeapi.org/api/timezone/Asia/Vientiane', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Unable to get server time. Please try again.')
  }

  const payload = (await response.json()) as { datetime?: string }

  if (!payload.datetime) {
    throw new Error('Server time response is invalid.')
  }

  return parseIsoDateAndTime(payload.datetime)
}

function dedupeDocs(
  a: QueryDocumentSnapshot<DocumentData>[],
  b: QueryDocumentSnapshot<DocumentData>[],
) {
  const seen = new Set<string>()
  return [...a, ...b].filter(d => {
    if (seen.has(d.id)) return false
    seen.add(d.id)
    return true
  })
}

// Fetch attendance docs for a user, merging by userUuid AND uid.
// System-generated not_checked_in records may only have uid (no userUuid).
// Pass sinceIsoDate (YYYY-MM-DD) to scope results and avoid full-history scans.
async function fetchAttendanceDocs(userUuid: string, sinceIsoDate?: string) {
  if (sinceIsoDate) {
    // Indexed path — requires composite indexes (userUuid+dateKey, uid+dateKey),
    // see firestore.indexes.json. Falls back to a full scan below if those
    // indexes haven't been deployed yet (Firestore throws failed-precondition).
    try {
      const [byUserUuid, byUid] = await Promise.all([
        getDocs(query(
          collection(db, 'attendance'),
          where('userUuid', '==', userUuid),
          where('dateKey', '>=', sinceIsoDate),
        )),
        getDocs(query(
          collection(db, 'attendance'),
          where('uid', '==', userUuid),
          where('dateKey', '>=', sinceIsoDate),
        )),
      ])
      return dedupeDocs(byUserUuid.docs, byUid.docs)
    } catch {
      // fall through to full scan
    }
  }

  const [byUserUuid, byUid] = await Promise.all([
    getDocs(query(collection(db, 'attendance'), where('userUuid', '==', userUuid))),
    getDocs(query(collection(db, 'attendance'), where('uid', '==', userUuid))),
  ])
  const docs = dedupeDocs(byUserUuid.docs, byUid.docs)
  if (sinceIsoDate) {
    return docs.filter(d => (d.data().dateKey ?? '') >= sinceIsoDate)
  }
  return docs
}

export async function fetchAttendanceByUserThisMonth(userUuid: string): Promise<AttendanceRecord[]> {
  if (!userUuid) return []

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`
  const docs = await fetchAttendanceDocs(userUuid, monthStart)

  const rows: AttendanceRecord[] = []

  for (const docSnapshot of docs) {
    const data = docSnapshot.data() as AttendanceDoc
    const parsedDate = parseAttendanceDocumentDate(data.date || '', data.dateKey)

    if (!parsedDate || !isSameMonth(parsedDate, now)) {
      continue
    }

    rows.push({
      id: docSnapshot.id,
      date: formatLocalIsoDate(parsedDate),
      ...(data.checkInTime ? { checkIn: data.checkInTime, checkInTime: data.checkInTime } : {}),
      checkOut: data.checkOutTime ?? undefined,
      checkOutTime: data.checkOutTime ?? null,
      status: normalizeAttendanceStatus(data.status),
      checkInLocation: data.checkInLocation,
      checkOutLocation: data.checkOutLocation,
      workHours: data.workHours,
      ...(data.isOffsite ? { isOffsite: true } : {}),
      ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
      ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
    })
  }

  return rows.sort((left, right) => right.date.localeCompare(left.date))
}

export async function updateAttendanceCheckInTime(params: UpdateCheckInTimeParams): Promise<string> {
  const recordCheckIn = httpsCallable<UpdateCheckInTimeParams, { attendanceId: string }>(
    fns(), 'recordCheckIn'
  )
  const result = await recordCheckIn(params)
  return result.data.attendanceId
}

export async function updateAttendanceCheckOutTime({
  userUuid,
  uid,
  location,
  accuracy,
  fullNameEn,
  fullNameLo,
  jobTitle,
  employeeImage,
  department,
  workLocation,
  checkOutImageURL,
  deviceLocalId,
  deviceFingerprint,
}: UpdateCheckOutTimeParams): Promise<string> {
  const fn = httpsCallable<Omit<UpdateCheckOutTimeParams, 'date' | 'checkOutTime' | 'workHours'>, { attendanceId: string }>(
    fns(), 'recordCheckOut'
  )
  const result = await fn({ userUuid, uid, location, accuracy, fullNameEn, fullNameLo, jobTitle, employeeImage, department, workLocation, checkOutImageURL, deviceLocalId, deviceFingerprint })
  return result.data.attendanceId
}

export async function fetchAttendanceByUser(userUuid: string): Promise<AttendanceRecord[]> {
  if (!userUuid) return []

  // history/page.tsx only ever shows the trailing 12 months (month dropdown) +
  // the current calendar year (year-to-date stats) — Jan 1 of last year covers
  // both with margin, so there's no need to download the user's full tenure.
  const sinceIsoDate = `${new Date().getFullYear() - 1}-01-01`
  const docs = await fetchAttendanceDocs(userUuid, sinceIsoDate)
  const rows: AttendanceRecord[] = []

  for (const docSnapshot of docs) {
    const data = docSnapshot.data() as AttendanceDoc
    const parsedDate = parseAttendanceDocumentDate(data.date || '', data.dateKey)
    if (!parsedDate) continue

    rows.push({
      id: docSnapshot.id,
      date: formatLocalIsoDate(parsedDate),
      ...(data.checkInTime ? { checkIn: data.checkInTime, checkInTime: data.checkInTime } : {}),
      checkOut: data.checkOutTime ?? undefined,
      checkOutTime: data.checkOutTime ?? null,
      status: normalizeAttendanceStatus(data.status),
      checkInLocation: data.checkInLocation,
      checkOutLocation: data.checkOutLocation,
      workHours: data.workHours,
      ...(data.isOffsite ? { isOffsite: true } : {}),
      ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
      ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
    })
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export async function fetchTodayCheckInAttendance(isoDate?: string): Promise<AttendanceRecord[]> {
  const target = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date()
  const todayDateStr = formatAttendanceDocumentDate(target)
  const todayIsoStr = isoDate ?? target.toISOString().split('T')[0]

  // Query by DD-MM-YYYY date field; also OR by dateKey (YYYY-MM-DD) to catch all formats
  const col = collection(db, 'attendance')
  const [snapByDate, snapByDateKey] = await Promise.all([
    getDocs(query(col, where('date', '==', todayDateStr))),
    getDocs(query(col, where('dateKey', '==', todayIsoStr))),
  ])

  const seen = new Set<string>()
  const allDocs: { id: string; data: AttendanceDoc & Record<string, any> }[] = []
  for (const snap of [snapByDate, snapByDateKey]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        allDocs.push({ id: d.id, data: d.data() as AttendanceDoc & Record<string, any> })
      }
    }
  }

  const rows: AttendanceRecord[] = []

  for (const { id: docId, data } of allDocs) {

    // Filter only records with checkInTime present
    if (!data.checkInTime) {
      continue
    }

    rows.push({
      id: docId,
      _id: data._id,
      date: todayDateStr,
      checkInTime: data.checkInTime,
      checkIn: data.checkInTime,
      checkOutTime: data.checkOutTime,
      checkOut: data.checkOutTime || undefined,
      status: normalizeAttendanceStatus(data.status),
      checkInLocation: data.checkInLocation,
      checkOutLocation: data.checkOutLocation,
      workHours: data.workHours,
      uid: data.uid,
      userUuid: data.userUuid,
      fullNameEn: data.fullNameEn,
      fullNameLo: data.fullNameLo,
      employeeImage: data.employeeImage,
      jobTitle: data.jobTitle,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
      note: data.note,
      department: data.department,
      workLocation: data.workLocation,
      ...(data.isOffsite ? { isOffsite: true } : {}),
      ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
      ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
    })
  }

  // Sort by checkInTime descending (last one first)
  return rows.sort((left, right) => {
    const leftTime = left.checkInTime || ''
    const rightTime = right.checkInTime || ''
    return rightTime.localeCompare(leftTime)
  })
}

export type LateRankEntry = {
  userUuid: string
  fullNameLo?: string
  fullNameEn?: string
  employeeImage?: string
  department?: { name: string; uid: string }
  workLocation?: { name: string; uid?: string; code?: string }
  lateCount: number
  penaltyMinutes: number
}

const LATE_THRESHOLD_MINUTES = 8 * 60 + 15        // 08:15 — normal day
const MORNING_LEAVE_THRESHOLD_MINUTES = 12 * 60 + 30 // 12:30 — half-day morning leave
const IMAGE_THRESHOLD_MINUTES = 9 * 60             // 09:00 — check-in with photo

function checkInPenaltyMinutes(checkInTime: string | null | undefined, morningLeaveDay?: boolean, hasImage?: boolean): number {
  if (!checkInTime) return 0
  const [hStr, mStr] = checkInTime.split(':')
  const total = parseInt(hStr, 10) * 60 + parseInt(mStr, 10)
  const threshold = morningLeaveDay
    ? MORNING_LEAVE_THRESHOLD_MINUTES
    : hasImage
      ? IMAGE_THRESHOLD_MINUTES
      : LATE_THRESHOLD_MINUTES
  return Math.max(0, total - threshold)
}

function isTargetMonth(data: AttendanceDoc, monthPrefix: string): boolean {
  // YYYY-MM-DD (dateKey field — most reliable)
  if (data.dateKey && /^\d{4}-\d{2}/.test(data.dateKey)) {
    return data.dateKey.startsWith(monthPrefix)
  }

  if (data.date) {
    // YYYY-MM-DD (ISO format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      return data.date.startsWith(monthPrefix)
    }
    // DD-MM-YYYY (hyphen)
    if (/^\d{2}-\d{2}-\d{4}$/.test(data.date)) {
      const [, mm, yyyy] = data.date.split('-')
      return `${yyyy}-${mm}` === monthPrefix
    }
    // DD/MM/YYYY (slash)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(data.date)) {
      const [, mm, yyyy] = data.date.split('/')
      return `${yyyy}-${mm}` === monthPrefix
    }
  }

  return false
}

function toIsoDateString(data: AttendanceDoc): string {
  if (data.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(data.dateKey)) return data.dateKey
  if (data.date) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return data.date
    if (/^\d{2}-\d{2}-\d{4}$/.test(data.date)) {
      const [dd, mm, yyyy] = data.date.split('-')
      return `${yyyy}-${mm}-${dd}`
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(data.date)) {
      const [dd, mm, yyyy] = data.date.split('/')
      return `${yyyy}-${mm}-${dd}`
    }
  }
  return ''
}

export async function fetchLateRankingForMonth(monthKey: string): Promise<LateRankEntry[]> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const monthStart = `${monthKey}-01`
  const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0]

  // Try indexed query first (requires composite index on status + dateKey in Firestore console).
  // Only fall back to a full company-wide scan if the query itself fails (e.g. the
  // composite index isn't deployed yet) — a legitimate 0-result month (nobody was
  // late) must NOT trigger the fallback, or every quiet month pays for a full scan.
  let snapDocs: QueryDocumentSnapshot<DocumentData>[]
  try {
    const snap = await getDocs(
      query(
        collection(db, 'attendance'),
        where('status', '==', 'late'),
        where('dateKey', '>=', monthStart),
        where('dateKey', '<', nextMonthStart),
      ),
    )
    snapDocs = snap.docs
  } catch {
    // Composite index missing/still building — fetch all late records and filter in JS.
    // Also catches legacy records that predate the dateKey field.
    const snap = await getDocs(
      query(collection(db, 'attendance'), where('status', '==', 'late')),
    )
    snapDocs = snap.docs
  }

  const map = new Map<string, LateRankEntry>()
  const latestDate = new Map<string, string>()

  for (const d of snapDocs) {
    const data = d.data() as AttendanceDoc

    if (!isTargetMonth(data, monthKey)) continue

    // Normalise key: same person may have records with userUuid on some docs and uid on others.
    // Check both in the map so they merge into one entry instead of creating duplicates.
    const uuidA = (data.userUuid || '').trim()
    const uuidB = (data.uid || '').trim()
    const mapKey = (uuidA && map.has(uuidA)) ? uuidA
                 : (uuidB && map.has(uuidB)) ? uuidB
                 : uuidA || uuidB
    if (!mapKey) continue

    const penalty = checkInPenaltyMinutes(data.checkInTime ?? null, data.morningLeaveDay, !!data.checkInImageURL)
    const recordDate = toIsoDateString(data)
    const existing = map.get(mapKey)

    if (existing) {
      existing.lateCount++
      existing.penaltyMinutes += penalty
      if (recordDate > (latestDate.get(mapKey) ?? '')) {
        latestDate.set(mapKey, recordDate)
        existing.workLocation = data.workLocation
        existing.department = data.department
        existing.fullNameLo = data.fullNameLo
        existing.fullNameEn = data.fullNameEn
        existing.employeeImage = data.employeeImage
      }
    } else {
      latestDate.set(mapKey, recordDate)
      map.set(mapKey, {
        userUuid: mapKey,
        fullNameLo: data.fullNameLo,
        fullNameEn: data.fullNameEn,
        employeeImage: data.employeeImage,
        department: data.department,
        workLocation: data.workLocation,
        lateCount: 1,
        penaltyMinutes: penalty,
      })
    }
  }

  return [...map.values()].sort((a, b) =>
    b.lateCount !== a.lateCount ? b.lateCount - a.lateCount : b.penaltyMinutes - a.penaltyMinutes,
  )
}