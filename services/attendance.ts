import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db, storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import type { AttendanceRecord } from '@/lib/types'

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
  createdBy?: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  note?: string | null
  updateBy?: string
  updateAt?: string
  checkInImageURL?: string
  isOffsite?: boolean
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
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  checkOutImageURL?: string
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
  location?: AttendanceRecord['location']
  workHours?: number
  isOffsite?: boolean
  checkInImageURL?: string
  checkOutImageURL?: string
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

  const isoDate = `${parsedDate.getUTCFullYear()}-${(parsedDate.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${parsedDate.getUTCDate().toString().padStart(2, '0')}`

  const time = `${parsedDate.getUTCHours().toString().padStart(2, '0')}:${parsedDate
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`

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

// Fetch all attendance docs for a user, merging by userUuid AND uid
// System-generated not_checked_in records may only have uid (no userUuid)
async function fetchAttendanceDocs(userUuid: string) {
  const [byUserUuid, byUid] = await Promise.all([
    getDocs(query(collection(db, 'attendance'), where('userUuid', '==', userUuid))),
    getDocs(query(collection(db, 'attendance'), where('uid', '==', userUuid))),
  ])
  const seen = new Set<string>()
  const merged = [...byUserUuid.docs, ...byUid.docs].filter(d => {
    if (seen.has(d.id)) return false
    seen.add(d.id)
    return true
  })
  return merged
}

export async function fetchAttendanceByUserThisMonth(userUuid: string): Promise<AttendanceRecord[]> {
  if (!userUuid) {
    return []
  }

  const docs = await fetchAttendanceDocs(userUuid)
  const now = new Date()

  const rows: AttendanceRecord[] = []

  for (const docSnapshot of docs) {
    const data = docSnapshot.data() as AttendanceDoc
    const parsedDate = parseAttendanceDocumentDate(data.date || '', data.dateKey)

    if (!parsedDate || !isSameMonth(parsedDate, now)) {
      continue
    }

      const normalizedStatus: AttendanceRecord['status'] =
        data.status === 'late' ? 'late'
        : data.status === 'absent' ? 'absent'
        : data.status === 'leave' ? 'leave'
        : data.status === 'offsite' ? 'offsite'
        : data.status === 'not_check_in' || data.status === 'not_checked_in' ? 'not_check_in'
        : 'present'

      rows.push({
        id: docSnapshot.id,
        date: formatLocalIsoDate(parsedDate),
        ...(data.checkInTime ? { checkIn: data.checkInTime, checkInTime: data.checkInTime } : { checkInTime: null }),
        checkOut: data.checkOutTime ?? undefined,
        checkOutTime: data.checkOutTime ?? null,
        status: normalizedStatus,
        location: data.location,
        workHours: data.workHours,
        ...(data.isOffsite ? { isOffsite: true } : {}),
        ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
        ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
      })
  }

  return rows.sort((left, right) => right.date.localeCompare(left.date))
}

export async function updateAttendanceCheckInTime({
  userUuid,
  uid,
  date,
  checkInTime,
  status,
  location,
  createdBy,
  fullNameEn,
  fullNameLo,
  jobTitle,
  employeeImage,
  note,
  department,
  workLocation,
  checkInImageURL,
  isOffsite,
}: UpdateCheckInTimeParams): Promise<string> {
  const attendanceId = `${userUuid}_${date}`
  const attendanceRef = doc(db, 'attendance', attendanceId)

  await setDoc(
    attendanceRef,
    {
      _id: attendanceId,
      uid: uid || userUuid,
      userUuid,
      date,
      checkInTime,
      checkOutTime: null,

      ...(typeof fullNameEn === 'string' ? { fullNameEn } : {}),
      ...(typeof fullNameLo === 'string' ? { fullNameLo } : {}),
      ...(typeof jobTitle === 'string' ? { jobTitle } : {}),
      ...(typeof employeeImage === 'string' ? { employeeImage } : {}),
      ...(typeof note !== 'undefined' ? { note } : {}),
      ...(department ? { department } : {}),
      ...(workLocation ? { workLocation } : {}),
      ...(checkInImageURL ? { checkInImageURL } : {}),
      ...(isOffsite ? { isOffsite: true } : {}),
      status,
      ...(location
        ? {
            location: {
              lat: location.lat,
              lng: location.lng,
            },
          }
        : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: userUuid,
    },
    { merge: true },
  )

  return attendanceId
}

export async function updateAttendanceCheckOutTime({
  userUuid,
  uid,
  date,
  checkOutTime,
  workHours,
  location,
  fullNameEn,
  fullNameLo,
  jobTitle,
  employeeImage,
  department,
  workLocation,
  checkOutImageURL,
}: UpdateCheckOutTimeParams): Promise<string> {
  const attendanceId = `${userUuid}_${date}`
  const attendanceRef = doc(db, 'attendance', attendanceId)

  await setDoc(
    attendanceRef,
    {
      _id: attendanceId,
      uid: uid || userUuid,
      userUuid,
      date,
      checkOutTime,
      ...(typeof fullNameEn === 'string' ? { fullNameEn } : {}),
      ...(typeof fullNameLo === 'string' ? { fullNameLo } : {}),
      ...(typeof jobTitle === 'string' ? { jobTitle } : {}),
      ...(typeof employeeImage === 'string' ? { employeeImage } : {}),
      ...(department ? { department } : {}),
      ...(workLocation ? { workLocation } : {}),
      ...(typeof workHours === 'number' ? { workHours } : {}),
      ...(checkOutImageURL ? { checkOutImageURL } : {}),
      ...(location
        ? {
            location: {
              lat: location.lat,
              lng: location.lng,
            },
          }
        : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: userUuid,
    },
    { merge: true },
  )

  return attendanceId
}

export async function fetchAttendanceByUser(userUuid: string): Promise<AttendanceRecord[]> {
  if (!userUuid) return []

  const docs = await fetchAttendanceDocs(userUuid)
  const rows: AttendanceRecord[] = []

  for (const docSnapshot of docs) {
    const data = docSnapshot.data() as AttendanceDoc
    const parsedDate = parseAttendanceDocumentDate(data.date || '', data.dateKey)
    if (!parsedDate) continue

    const normalizedStatus: AttendanceRecord['status'] =
      data.status === 'late' ? 'late'
      : data.status === 'absent' ? 'absent'
      : data.status === 'leave' ? 'leave'
      : data.status === 'offsite' ? 'offsite'
      : data.status === 'not_check_in' || data.status === 'not_checked_in' ? 'not_check_in'
      : 'present'

    rows.push({
      id: docSnapshot.id,
      date: formatLocalIsoDate(parsedDate),
      ...(data.checkInTime ? { checkIn: data.checkInTime, checkInTime: data.checkInTime } : { checkInTime: null }),
      checkOut: data.checkOutTime ?? undefined,
      checkOutTime: data.checkOutTime ?? null,
      status: normalizedStatus,
      location: data.location,
      workHours: data.workHours,
      ...(data.isOffsite ? { isOffsite: true } : {}),
      ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
      ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
    })
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export async function fetchTodayCheckInAttendance(): Promise<AttendanceRecord[]> {
  const today = new Date()
  const todayDateStr = formatAttendanceDocumentDate(today)

  const attendanceQuery = query(
    collection(db, 'attendance'),
    where('date', '==', todayDateStr),
  )

  const snapshot = await getDocs(attendanceQuery)
  const rows: AttendanceRecord[] = []

  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data() as AttendanceDoc & Record<string, any>

    // Filter only records with checkInTime present
    if (!data.checkInTime) {
      continue
    }

    rows.push({
      id: docSnapshot.id,
      _id: data._id,
      date: todayDateStr,
      checkInTime: data.checkInTime,
      checkIn: data.checkInTime,
      checkOutTime: data.checkOutTime,
      checkOut: data.checkOutTime || undefined,
      status: (data.status === 'late' || data.status === 'absent' || data.status === 'leave' || data.status === 'offsite')
        ? data.status
        : 'present',
      location: data.location,
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