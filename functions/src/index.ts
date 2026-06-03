import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import webpush from 'web-push'

if (admin.apps.length === 0) {
  admin.initializeApp()
}

// VAPID keys are Firebase secrets — only available at runtime, not module load.
// setVapidDetails() is called inside each function that needs it.

const TIMEZONE = 'Asia/Vientiane'

// Bug #1 fixed: use 'not_check_in' consistently (matches computeCheckInStatus return value)
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
    date: `${day}-${month}-${year}`,
    isoDate: `${year}-${month}-${day}`,
    checkTime: `${hour}:${minute}`,
    status: 'present',
  }
}

function toMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute
}

function computeCheckInStatus(nowMinutes: number, hasMorningLeaveEndToday: boolean): CheckInStatus {
  if (hasMorningLeaveEndToday) {
    const presentCutoff = 12 * 60 + 30 // 12:30
    const lateCutoff = 14 * 60          // 14:00

    if (nowMinutes <= presentCutoff) return 'present'
    if (nowMinutes <= lateCutoff) return 'late'
    return 'not_check_in'
  }

  const presentCutoff = 8 * 60 + 15 // 08:15
  const lateCutoff = 10 * 60         // 10:00

  if (nowMinutes <= presentCutoff) return 'present'
  if (nowMinutes <= lateCutoff) return 'late'
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
  if (!userUuid) return false

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
      // 'monning' kept for backward-compatibility with existing DB records
      (endPeriod === 'morning' || endPeriod === 'monning')
    )
  })
}

// =========================================================================
// 🌐 1. GET SERVER TIME
// =========================================================================
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

    return { date, isoDate, checkTime, status, isLate, timestamp: Date.now() }
  }
)

// =========================================================================
// 🔄 2. CORE LOGIC: CHECK + SEND PUSH NOTIFICATION
// =========================================================================
async function sendAttendanceReminder() {
  webpush.setVapidDetails(
    'mailto:admin@ssmi-hrm.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const { isoDate } = getVientianeParts()
  console.log(`[Cron Job]: checking not-checked-in for ${isoDate}`)

  const db = admin.firestore()

  // Documents are pre-created at midnight with status 'not_check_in'.
  // Status updates to 'present'/'late' when the employee checks in.
  // Use 'dateKey' (YYYY-MM-DD) — 'date' field is DD-MM-YYYY which won't match isoDate.
  const snapshot = await db
    .collection('attendance')
    .where('dateKey', '==', isoDate)
    .where('status', '==', 'not_check_in')
    .get()

  if (snapshot.empty) {
    console.log('All employees checked in today.')
    return
  }

  const payload = JSON.stringify({
    title: '🚨 ເຕືອນ Check-in ເຂົ້າວຽກ!',
    body: 'ຮອດເວລາແລ້ວ! ກະລຸນາກົດບັນທຶກເວລາເຂົ້າວຽກຂອງທ່ານຕອນນີ້.',
    icon: '/apple-icon.png',
    badge: '/SSMI.svg',
    url: '/dashboard/attendance',
  })

  // attendance.uid = Firebase Auth UID (e.g. "DDJzovvTUXVdXcCLVfKndy5Ewo62")
  const userUids = [
    ...new Set(
      snapshot.docs
        .map(d => d.data().uid as string)
        .filter(Boolean)
    ),
  ]

  // employees collection is keyed by uid — use getAll for O(1) batch fetch
  const employeeRefs = userUids.map(uid => db.collection('employees').doc(uid))
  const employeeDocs = await db.getAll(...employeeRefs)

  const results = await Promise.all(
    employeeDocs.map(async (empDoc) => {
      if (!empDoc.exists) return false
      const subscription = empDoc.data()?.pushSubscription
      if (!subscription) return false

      return webpush
        .sendNotification(subscription, payload)
        .then(() => true)
        .catch((err: unknown) => {
          console.error(`Failed to notify employee ${empDoc.id}:`, err)
          return false
        })
    })
  )

  const notified = results.filter(Boolean).length
  console.log(`Notified ${notified} / ${snapshot.size} users`)
}

// =========================================================================
// ⏰ 3. CRON JOB 08:00 (Mon–Fri)
// =========================================================================
export const checkAttendanceAt800 = onSchedule(
  { schedule: '0 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' },
  async () => { await sendAttendanceReminder() }
)

// =========================================================================
// ⏰ 4. CRON JOB 08:14 (Mon–Fri)
// =========================================================================
export const checkAttendanceAt814 = onSchedule(
  { schedule: '14 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' },
  async () => { await sendAttendanceReminder() }
)
