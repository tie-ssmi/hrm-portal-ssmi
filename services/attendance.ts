import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AttendanceRecord } from '@/lib/types'

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
  status: 'present' | 'late'
  location?: AttendanceLocation
  createdBy?: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  note?: string | null
  updateBy?: string
  updateAt?: string
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
  checkInTime?: string
  checkOutTime?: string | null
  status?: AttendanceRecord['status'] | 'not_checked_in'
  location?: AttendanceRecord['location']
  workHours?: number
}

export function formatAttendanceDocumentDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear().toString()
  return `${day}-${month}-${year}`
}

function parseAttendanceDocumentDate(value: string): Date | null {
  if (!value) {
    return null
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-').map(Number)
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

export async function fetchAttendanceByUserThisMonth(userUuid: string): Promise<AttendanceRecord[]> {
  if (!userUuid) {
    return []
  }

  const attendanceQuery = query(
    collection(db, 'attendance'),
    where('userUuid', '==', userUuid),
  )

  const snapshot = await getDocs(attendanceQuery)
  const now = new Date()

  const rows: AttendanceRecord[] = []

  for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data() as AttendanceDoc
      const parsedDate = parseAttendanceDocumentDate(data.date || '')

      if (!parsedDate || !isSameMonth(parsedDate, now)) {
        continue
      }

      if (data.status === 'not_checked_in') {
        continue
      }

      rows.push({
        id: docSnapshot.id,
        date: formatLocalIsoDate(parsedDate),
        ...(data.checkInTime ? { checkIn: data.checkInTime } : {}),
        ...(data.checkOutTime ? { checkOut: data.checkOutTime } : {}),
        status: (data.status === 'late' || data.status === 'absent' || data.status === 'leave' || data.status === 'offsite')
          ? data.status
          : 'present',
        location: data.location,
        workHours: data.workHours,
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
    })
  }

  // Sort by checkInTime descending (last one first)
  return rows.sort((left, right) => {
    const leftTime = left.checkInTime || ''
    const rightTime = right.checkInTime || ''
    return rightTime.localeCompare(leftTime)
  })
}