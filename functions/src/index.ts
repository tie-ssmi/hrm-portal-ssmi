import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import webpush from 'web-push'

if (admin.apps.length === 0) {
  admin.initializeApp()
}

// VAPID keys ພ້ອມໃຊ້ທີ່ module level ໃນ Cloud Functions v2 (process.env ຖືກ inject ກ່ອນ function run)
// ເອີ້ນຄັ້ງດຽວທີ່ module level — ບໍ່ຕ້ອງເອີ້ນຊ້ຳທຸກ invocation
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@ssmi-hrm.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const TIMEZONE = 'Asia/Vientiane'

// ໃຊ້ 'not_check_in' ໃຫ້ສອດຄ່ອງກັນກັບຄ່າທີ່ computeCheckInStatus ສົ່ງກັບ
type CheckInStatus = 'present' | 'late' | 'not_check_in'

type ServerTimeResult = {
  date: string      // ວັນ-ເດືອນ-ປີ (DD-MM-YYYY)
  isoDate: string   // ປີ-ເດືອນ-ວັນ (YYYY-MM-DD)
  checkTime: string // ຊົ່ວໂມງ:ນາທີ (HH:mm)
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
    const presentCutoff = 12 * 60 + 30 // 12:30 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ (ມີລາພັກເຄິ່ງເຊົ້າ)
    const lateCutoff = 14 * 60          // 14:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ

    if (nowMinutes <= presentCutoff) return 'present'
    if (nowMinutes <= lateCutoff) return 'late'
    return 'not_check_in'
  }

  const presentCutoff = 8 * 60 + 15 // 08:15 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາທັນ
  const lateCutoff = 10 * 60         // 10:00 — ເວລາສຸດທ້າຍທີ່ຖືວ່າມາສາຍ

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

  // ກັ່ນຕອງ endDate + status ທີ່ Firestore ໂດຍກົງ — ກ່ອນໜ້ານີ້ດຶງ leaves ທັງໝົດຂອງ user ແລ້ວ filter ທີ່ JS
  // ຕ້ອງການ composite index ໃນ Firestore console: (leaveUserUuid, endDate, status)
  const snapshot = await admin
    .firestore()
    .collection('leaves')
    .where('leaveUserUuid', '==', userUuid)
    .where('endDate', '==', isoDate)
    .where('status', '==', 'approved')
    .get()

  return snapshot.docs.some((doc) => {
    const endPeriod = ((doc.data() as LeaveLike).endPeriod || '').toLowerCase()
    // ຮັກສາ 'monning' ໄວ້ເພື່ອ compatibility ກັບຂໍ້ມູນເກົ່າໃນ database
    return endPeriod === 'morning' || endPeriod === 'monning'
  })
}

// =========================================================================
// 🌐 1. ດຶງເວລາ Server
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
// 🔔 2. ກວດສອບ + ສົ່ງ Push Notification ແຈ້ງເຕືອນ
// =========================================================================
const PUSH_BATCH_SIZE = 20

async function sendAttendanceReminder() {
  const { isoDate } = getVientianeParts()
  console.log(`[Cron Job]: checking not-checked-in for ${isoDate}`)

  const db = admin.firestore()

  // dailyAttendanceInit (admin project) ສ້າງ docs ລ່ວງໜ້າທຸກຄືນ 00:00 ດ້ວຍ:
  //   status: 'not_checked_in'  ແລະ  dateKey: YYYY-MM-DD
  // ເມື່ອ employee check-in, client ອັບເດດ status ເປັນ 'present' ຫຼື 'late'
  // Query ດ້ວຍ dateKey + status ຈຶ່ງຮູ້ວ່າໃຜຍັງບໍ່ທັນ check-in
  const snapshot = await db
    .collection('attendance')
    .where('dateKey', '==', isoDate)
    .where('status', '==', 'not_checked_in')
    .get()

  if (snapshot.empty) {
    console.log('[Cron Job]: all employees checked in today.')
    return
  }

  const payload = JSON.stringify({
    title: '🚨 ເຕືອນ Check-in ເຂົ້າວຽກ!',
    body: 'ຮອດເວລາແລ້ວ! ກະລຸນາກົດບັນທຶກເວລາເຂົ້າວຽກຂອງທ່ານຕອນນີ້.',
    icon: '/apple-icon.png',
    badge: '/SSMI.svg',
    url: '/dashboard/attendance',
  })

  // attendance.uid ເປັນ Firebase Auth UID — employees collection ໃຊ້ UID ນີ້ເປັນ key
  const userUids = [
    ...new Set(
      snapshot.docs
        .map(d => d.data().uid as string)
        .filter(Boolean)
    ),
  ]

  // getAll() ດຶງ employee docs ທັງໝົດໃນ round-trip ດຽວ
  const employeeRefs = userUids.map(uid => db.collection('employees').doc(uid))
  const employeeDocs = await db.getAll(...employeeRefs)

  // ສົ່ງ push notification ເປັນ batch PUSH_BATCH_SIZE ຄັ້ງ — ກັນ rate-limit error
  // Promise.all ທັງໝົດພ້ອມກັນ (100+ requests) ອາດຖືກ push server ຕີກັບ
  const allResults: boolean[] = []
  for (let i = 0; i < employeeDocs.length; i += PUSH_BATCH_SIZE) {
    const batchDocs = employeeDocs.slice(i, i + PUSH_BATCH_SIZE)
    const batchResults = await Promise.all(
      batchDocs.map(async (empDoc) => {
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
    allResults.push(...batchResults)
  }

  const notified = allResults.filter(Boolean).length
  console.log(`[Cron Job]: Notified ${notified} / ${snapshot.size} users`)
}

// =========================================================================
// ⏰ 3. CRON JOB 08:00 (ຈັນ–ສຸກ)
// =========================================================================
export const checkAttendanceAt800 = onSchedule(
  { schedule: '0 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' },
  async () => { await sendAttendanceReminder() }
)

// =========================================================================
// ⏰ 4. CRON JOB 08:14 (ຈັນ–ສຸກ)
// =========================================================================
export const checkAttendanceAt814 = onSchedule(
  { schedule: '14 8 * * 1-5', timeZone: TIMEZONE, region: 'asia-southeast1' },
  async () => { await sendAttendanceReminder() }
)

// =========================================================================
// 📍 5. CHECK-IN ພ້ອມກວດສອບ Geofence ຢູ່ Server
// =========================================================================

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// date, checkInTime, status ບໍ່ຮັບຈາກ client — server ຄຳນວນເອງ ກັນການປອມເວລາ
type CheckInPayload = {
  userUuid: string
  uid?: string
  location?: { lat: number; lng: number }
  isOffsite?: boolean
  checkInImageURL?: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  note?: string | null
  updatedBy?: string
  createdBy?: string
  department?: { name: string; uid: string }
  workLocation?: { code?: string; name: string; uid?: string }
}

type CheckOutPayload = {
  userUuid: string
  uid?: string
  location?: { lat: number; lng: number }
  checkOutImageURL?: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  employeeImage?: string
  department?: { name: string; uid: string }
  workLocation?: { code?: string; name: string; uid?: string }
}

export const recordCheckIn = onCall(
  { region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const data = request.data as CheckInPayload

    if (!data.userUuid) {
      throw new HttpsError('invalid-argument', 'userUuid is required')
    }

    // ກັນ user ໜຶ່ງ check-in ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Cannot check in as another user')
    }

    // ເວລາຈາກ server — client ບໍ່ສາມາດປ່ຽນເວລາ check-in ຫຼື status ໄດ້
    const { date, isoDate, checkTime } = getVientianeParts()
    const [hourStr, minuteStr] = checkTime.split(':')
    const morningLeave = await hasMorningLeaveEndingToday(data.userUuid, isoDate)
    const status = computeCheckInStatus(
      toMinuteOfDay(parseInt(hourStr, 10), parseInt(minuteStr, 10)),
      morningLeave
    )

    // ກວດ Geofence — ດຶງ coordinates ຫ້ອງການຈາກ Firestore (client ປອມບໍ່ໄດ້)
    if (!data.isOffsite && data.location != null) {
      const empSnap = await admin.firestore()
        .collection('employees')
        .where('uuid', '==', data.userUuid)
        .limit(1)
        .get()

      if (!empSnap.empty) {
        const workLocationUid = empSnap.docs[0].data()?.workLocation?.uid as string | undefined
        if (workLocationUid) {
          const locDoc = await admin.firestore().collection('workLocations').doc(workLocationUid).get()
          const locData = locDoc.data()

          if (locData?.lat != null && locData?.lng != null) {
            const dist = Math.round(
              haversineMeters(data.location.lat, data.location.lng, locData.lat as number, locData.lng as number)
            )
            if (dist > 50) {
              throw new HttpsError(
                'failed-precondition',
                `ທ່ານຢູ່ຫ່າງຈາກຫ້ອງການ ${dist} ແມັດ. ຕ້ອງຢູ່ພາຍໃນ 50 ແມັດ.`
              )
            }
          }
        }
      }
    }

    const attendanceId = `${data.userUuid}_${date}`
    await admin.firestore()
      .collection('attendance')
      .doc(attendanceId)
      .set(
        {
          _id: attendanceId,
          uid: data.uid ?? data.userUuid,
          userUuid: data.userUuid,
          date,
          dateKey: isoDate,
          checkInTime: checkTime,
          status,
          ...(data.location ? { location: { lat: data.location.lat, lng: data.location.lng } } : {}),
          ...(data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {}),
          ...(data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {}),
          ...(data.jobTitle != null ? { jobTitle: data.jobTitle } : {}),
          ...(data.employeeImage != null ? { employeeImage: data.employeeImage } : {}),
          ...(data.note != null ? { note: data.note } : {}),
          ...(data.department ? { department: data.department } : {}),
          ...(data.workLocation ? { workLocation: data.workLocation } : {}),
          ...(data.checkInImageURL ? { checkInImageURL: data.checkInImageURL } : {}),
          ...(data.isOffsite ? { isOffsite: true } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: data.updatedBy ?? data.userUuid,
        },
        { merge: true }
      )

    return { attendanceId, date, isoDate, checkTime, status }
  }
)

// =========================================================================
// 🚪 6. CHECK-OUT ດ້ວຍເວລາ Server
// =========================================================================

export const recordCheckOut = onCall(
  { region: 'asia-southeast1', cors: callableCorsOrigins, invoker: 'public' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const data = request.data as CheckOutPayload

    if (!data.userUuid) {
      throw new HttpsError('invalid-argument', 'userUuid is required')
    }

    // ກັນ user ໜຶ່ງ check-out ແທນ user ອື່ນ
    if (data.uid && data.uid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Cannot check out as another user')
    }

    const { date, checkTime } = getVientianeParts()
    const attendanceId = `${data.userUuid}_${date}`

    // ອ່ານ checkInTime ທີ່ມີຢູ່ເພື່ອຄຳນວນ workHours
    const existing = await admin.firestore().collection('attendance').doc(attendanceId).get()
    const checkInTime = existing.data()?.checkInTime as string | undefined
    let workHours = 0
    if (checkInTime) {
      const [inH, inM] = checkInTime.split(':').map(Number)
      const [outH, outM] = checkTime.split(':').map(Number)
      const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM)
      workHours = diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0
    }

    await admin.firestore()
      .collection('attendance')
      .doc(attendanceId)
      .set(
        {
          checkOutTime: checkTime,
          workHours,
          ...(data.fullNameEn != null ? { fullNameEn: data.fullNameEn } : {}),
          ...(data.fullNameLo != null ? { fullNameLo: data.fullNameLo } : {}),
          ...(data.jobTitle != null ? { jobTitle: data.jobTitle } : {}),
          ...(data.employeeImage != null ? { employeeImage: data.employeeImage } : {}),
          ...(data.department ? { department: data.department } : {}),
          ...(data.workLocation ? { workLocation: data.workLocation } : {}),
          ...(data.checkOutImageURL ? { checkOutImageURL: data.checkOutImageURL } : {}),
          ...(data.location ? { location: { lat: data.location.lat, lng: data.location.lng } } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: data.userUuid,
        },
        { merge: true }
      )

    return { attendanceId, checkOutTime: checkTime, workHours }
  }
)
