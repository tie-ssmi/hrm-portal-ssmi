// OT (ເຮັດວຽກວັນພັກ) attendance — the attendanceOT collection. Reads go to
// Firestore directly; every write goes through recordOTCheckIn /
// recordOTCheckOut (functions/src/index.ts), since the rules deny client writes.

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app, { db, storage } from '@/lib/firebase'
import { pickTodayOTRequest } from '@/lib/attendance-ot'
import type { OffsiteRequestDoc } from '@/types/workOutside'

let _fns: ReturnType<typeof getFunctions> | null = null
function fns() {
  if (!_fns) _fns = getFunctions(app, 'asia-southeast1')
  return _fns
}

export type OTAttendanceDoc = {
  _id: string
  uid: string
  userUuid: string
  date: string // dd-MM-yyyy
  dateKey: string // yyyy-MM-dd
  checkInTime?: string
  checkOutTime?: string
  status?: 'present' | 'late'
  workHours?: number
  checkInImageURL?: string
  checkOutImageURL?: string
  checkInLocation?: { lat: number; lng: number }
  checkOutLocation?: { lat: number; lng: number }
  otRequestId?: string
  otRequestNo?: string
  otStartTime?: string
  otEndTime?: string
}

export type OTPunchParams = {
  userUuid: string
  location: { lat: number; lng: number }
  accuracy?: number
  imageURL: string
  fullNameEn?: string
  fullNameLo?: string
  jobTitle?: string
  jobTitleLo?: string
  employeeImage?: string
  deviceLocalId?: string
  deviceFingerprint?: string
  deviceModel?: string
  department?: { name: string; uid: string }
  workLocation?: { code?: string; name: string; uid?: string }
}

// The approved OT request covering today that lists this user as a teammate,
// or null. Same query and rules the server uses before accepting a punch.
export async function fetchTodayOTRequest(
  userUuid: string,
  isoDate: string,
): Promise<OffsiteRequestDoc | null> {
  if (!userUuid) return null
  const snap = await getDocs(
    query(collection(db, 'workOutside'), where('participantIds', 'array-contains', userUuid)),
  )
  const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OffsiteRequestDoc)
  return pickTodayOTRequest(requests, userUuid, isoDate)
}

// isoDate yyyy-MM-dd → doc id `${uid}_dd-MM-yyyy`, matching attendance
export async function fetchTodayOTAttendance(
  userUuid: string,
  isoDate: string,
): Promise<OTAttendanceDoc | null> {
  if (!userUuid) return null
  const [y, m, d] = isoDate.split('-')
  const snap = await getDoc(doc(db, 'attendanceOT', `${userUuid}_${d}-${m}-${y}`))
  return snap.exists() ? (snap.data() as OTAttendanceDoc) : null
}

// Stored under attendance/ so the existing Storage rule covers it.
export async function uploadOTImage(
  file: File,
  userUuid: string,
  type: 'checkIn' | 'checkOut',
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const ref = storageRef(storage, `attendance/${userUuid}/ot_${type}_${Date.now()}.${ext}`)
  await uploadBytes(ref, file)
  return getDownloadURL(ref)
}

export async function recordOTCheckIn(params: OTPunchParams) {
  const fn = httpsCallable<OTPunchParams, { checkTime: string; status: 'present' | 'late' }>(
    fns(),
    'recordOTCheckIn',
  )
  return (await fn(params)).data
}

export async function recordOTCheckOut(params: OTPunchParams) {
  const fn = httpsCallable<OTPunchParams, { checkOutTime: string; workHours: number }>(
    fns(),
    'recordOTCheckOut',
  )
  return (await fn(params)).data
}
