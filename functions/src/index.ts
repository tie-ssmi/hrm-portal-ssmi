import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'

admin.initializeApp()

const TIMEZONE = 'Asia/Vientiane'

type CheckInStatus = 'present' | 'late' | 'not_check_in'

type ServerTimeResult = {
  date: string      // DD-MM-YYYY
  isoDate: string   // YYYY-MM-DD
  checkTime: string // HH:mm
  status: CheckInStatus
  isLate: boolean
  timestamp: number
}

function getVientianeParts(): Omit<ServerTimeResult, 'isLate' | 'timestamp'> {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'

  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')

  return {
    date: `${day}-${month}-${year}`,       // DD-MM-YYYY
    isoDate: `${year}-${month}-${day}`,    // YYYY-MM-DD
    checkTime: `${hour}:${minute}`,        // HH:mm
    status: 'present',
  }
}

function toMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute
}

function computeCheckInStatus(nowMinutes: number, hasMorningLeaveEndToday: boolean): CheckInStatus {
  if (hasMorningLeaveEndToday) {
    const presentCutoff = 12 * 60 + 30 // 12:30
    const lateCutoff = 14 * 60 // 14:00

    if (nowMinutes <= presentCutoff) {
      return 'present'
    }

    if (nowMinutes <= lateCutoff) {
      return 'late'
    }

    return 'not_check_in'
  }

  const presentCutoff = 8 * 60 + 15 // 08:15
  const lateCutoff = 10 * 60 // 10:00

  if (nowMinutes <= presentCutoff) {
    return 'present'
  }

  if (nowMinutes <= lateCutoff) {
    return 'late'
  }

  return 'not_check_in'
}

type LeaveLike = {
  status?: string
  endDate?: string
  endPeriod?: string
}

const callableCorsOrigins: Array<string | RegExp> = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'ionic://localhost',
  /^https:\/\/.*\.web\.app$/,
  /^https:\/\/.*\.firebaseapp\.com$/,
]

async function hasMorningLeaveEndingToday(userUuid: string | undefined, isoDate: string): Promise<boolean> {
  if (!userUuid) {
    return false
  }

  const snapshot = await admin
    .firestore()
    .collection('leaves')
    .where('leaveUserUuid', '==', userUuid)
    .get()

  return snapshot.docs.some((doc) => {
    const leave = doc.data() as LeaveLike
    const status = (leave.status || '').toLowerCase()
    const endDate = leave.endDate || ''
    const endPeriod = (leave.endPeriod || '').toLowerCase()

    return (
      status === 'approved' &&
      endDate === isoDate &&
      (endPeriod === 'morning' || endPeriod === 'monning')
    )
  })
}

export const getServerTime = onCall(
  { region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' },
  async (request): Promise<ServerTimeResult> => {
    const { date, checkTime, isoDate } = getVientianeParts()
    const [hourStr, minuteStr] = checkTime.split(':')
    const hour = parseInt(hourStr, 10)
    const minute = parseInt(minuteStr, 10)
    const userUuid = typeof request.data?.userUuid === 'string' ? request.data.userUuid : undefined
    const morningLeaveEndToday = await hasMorningLeaveEndingToday(userUuid, isoDate)
    const status = computeCheckInStatus(toMinuteOfDay(hour, minute), morningLeaveEndToday)
    const isLate = status === 'late'

    return {
      date,
      isoDate,
      checkTime,
      status,
      isLate,
      timestamp: Date.now(),
    }
  }
)
