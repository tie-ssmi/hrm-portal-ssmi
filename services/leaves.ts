import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import type { LeaveApprovalStep, LeaveRequest } from '@/lib/types'
import { resolveLeaveRequestStatus } from '@/services/leave-approval'

export async function uploadLeaveDocument(
  file: File,
  userUuid: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'file'
  const path = `leaves/${userUuid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const fileRef = storageRef(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file)
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
        }
      },
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject),
    )
  })
}

export async function fetchLeaveById(leaveId: string): Promise<LeaveRequest | null> {
  const snapshot = await getDoc(doc(db, 'leaves', leaveId))
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...(snapshot.data() as Omit<LeaveRequest, 'id'>) }
}

export async function updateLeaveApproval(params: {
  leaveId: string
  approvalIndex: number
  decision: 'approved' | 'rejected'
  reviewedBy: string
  reviewedByUid: string
  rejectReason?: string
}): Promise<void> {
  const { leaveId, approvalIndex, decision, reviewedBy, reviewedByUid, rejectReason } = params
  const leaveRef = doc(db, 'leaves', leaveId)
  const snapshot = await getDoc(leaveRef)
  if (!snapshot.exists()) throw new Error('Leave request not found')

  const data = snapshot.data() as Omit<LeaveRequest, 'id'>
  const approvals: LeaveApprovalStep[] = data.approvals ?? []

  const updatedApprovals = approvals.map((a, i) =>
    i === approvalIndex
      ? { ...a, decision, reviewedBy, reviewedAt: new Date().toISOString() }
      : a
  )

  const status = resolveLeaveRequestStatus(updatedApprovals)

  await updateDoc(leaveRef, {
    approvals: updatedApprovals,
    status,
    ...(status !== 'pending' ? { reviewedBy, reviewedByUid, reviewedAt: new Date().toISOString() } : {}),
    ...(decision === 'rejected' && rejectReason ? { rejectReason } : {}),
  })
}

export async function createLeaveRequest(payload: Omit<LeaveRequest, 'id'>): Promise<string> {
  // Remove undefined fields to avoid Firebase errors
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  )
  const docRef = await addDoc(collection(db, 'leaves'), cleanPayload)
  return docRef.id
}

export async function fetchLeavesForApproval(params: {
  departmentUid: string
  workLocationUid: string
  excludeUserUuid: string
}): Promise<LeaveRequest[]> {
  const { departmentUid, workLocationUid, excludeUserUuid } = params
  if (!departmentUid || !workLocationUid) return []

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'
  const leavesQuery = query(
    collection(db, 'leaves'),
    where('departmentUid', '==', departmentUid),
    where('workLocationUid', '==', workLocationUid),
  )

  const snapshot = await getDocs(leavesQuery)
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<LeaveRequest, 'id'>),
  }))

  return rows
    .filter((row) =>
      row.leaveUserUuid !== excludeUserUuid &&
      (row.status === 'pending' || (typeof row.endDate === 'string' && row.endDate >= monthStart))
    )
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function fetchAllLeavesByUserUuid(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) return []

  const snapshot = await getDocs(
    query(collection(db, 'leaves'), where('leaveUserUuid', '==', userUuid))
  )

  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function fetchLeavesByUserThisYear(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) return []

  const yearStart = `${new Date().getFullYear()}-01-01`

  const snapshot = await getDocs(
    query(collection(db, 'leaves'), where('leaveUserUuid', '==', userUuid))
  )

  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
    .filter((row) =>
      row.status === 'pending' ||
      (typeof row.startDate === 'string' && row.startDate >= yearStart)
    )
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function attachLeaveDocument(params: {
  leaveId: string
  docLink: string
}): Promise<void> {
  const { leaveId, docLink } = params
  await updateDoc(doc(db, 'leaves', leaveId), {
    docLink,
    docStatus: 'now',
  })
}

export async function fetchPendingDocLeavesByUserUuid(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) return []

  const snapshot = await getDocs(
    query(collection(db, 'leaves'), where('leaveUserUuid', '==', userUuid))
  )

  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
    .filter((row) => row.status !== 'rejected' && row.docStatus === 'later')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function fetchTodayLeavesByWorkLocation(workLocationUid: string): Promise<LeaveRequest[]> {
  if (!workLocationUid) return []

  const today = new Date().toISOString().split('T')[0]

  const snapshot = await getDocs(
    query(
      collection(db, 'leaves'),
      where('workLocationUid', '==', workLocationUid),
      where('status', '==', 'approved'),
    )
  )

  return snapshot.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
    .filter(r => r.startDate <= today && r.endDate >= today)
}

export async function fetchAllTodayLeaves(): Promise<LeaveRequest[]> {
  const today = new Date().toISOString().split('T')[0]

  const snapshot = await getDocs(
    query(collection(db, 'leaves'), where('status', '==', 'approved'))
  )

  return snapshot.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
    .filter(r => r.startDate <= today && r.endDate >= today)
}

export async function fetchLeavesByUserUuidFromToday(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) {
    return []
  }

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`

  const leavesQuery = query(collection(db, 'leaves'), where('leaveUserUuid', '==', userUuid))

  const snapshot = await getDocs(leavesQuery)
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<LeaveRequest, 'id'>),
  }))

  return rows
    .filter((row) =>
      // 1. any date — status pending
      row.status === 'pending' ||
      // 2. this month — any status
      (typeof row.startDate === 'string' && row.startDate.startsWith(monthPrefix)) ||
      (typeof row.endDate === 'string' && row.endDate.startsWith(monthPrefix))
    )
    .sort((a, b) => {
      // pending always on top
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      // then newest first within each group
      const aTime = a.createdAt ?? ''
      const bTime = b.createdAt ?? ''
      return bTime.localeCompare(aTime)
    })
}

// =====================================================================
// Leave status for a specific date — ໃຊ້ໃນໜ້າ attendance ເພື່ອ block/adjust check-in
// =====================================================================

export type DayLeaveStatus = 'blocked' | 'morning_leave' | 'none'

function computeDayLeaveStatus(isoDate: string, leave: LeaveRequest): DayLeaveStatus {
  const startDate = leave.startDate ?? ''
  const endDate = leave.endDate ?? ''
  const startPeriod = leave.startPeriod ?? 'morning'
  const endPeriod = leave.endPeriod ?? 'afternoon'

  if (!startDate || !endDate || isoDate < startDate || isoDate > endDate) return 'none'

  // ວັນກາງ (ລະຫວ່າງ startDate ແລະ endDate) — ຢຸດວຽກທັງໝົດ
  if (isoDate > startDate && isoDate < endDate) return 'blocked'

  if (isoDate === startDate && isoDate === endDate) {
    // ລາພັກເຕັມວັນ: ເຊົ້າ–ບ່າຍ
    if (startPeriod === 'morning' && endPeriod === 'afternoon') return 'blocked'
    // ລາພັກເຄິ່ງເຊົ້າເທົ່ານັ້ນ: Check-In ໄດ້ຮອດ 14:00
    if (endPeriod === 'morning') return 'morning_leave'
    // ລາພັກບ່າຍເທົ່ານັ້ນ: Check-In ປົກກະຕິ
    return 'none'
  }

  // ວັນທຳອິດ (startDate < endDate)
  if (isoDate === startDate) {
    // ເລີ່ມເຊົ້າ = ຢຸດວຽກ; ເລີ່ມບ່າຍ = Check-In ໄດ້ປົກກະຕິ
    return startPeriod === 'morning' ? 'blocked' : 'none'
  }

  // ວັນສຸດທ້າຍ (isoDate === endDate, isoDate > startDate)
  return endPeriod === 'afternoon' ? 'blocked' : 'morning_leave'
}

export async function fetchTodayLeaveStatus(
  userUuid: string,
  isoDate: string,
): Promise<DayLeaveStatus> {
  if (!userUuid) return 'none'

  const snap = await getDocs(
    query(
      collection(db, 'leaves'),
      where('leaveUserUuid', '==', userUuid),
      where('status', '==', 'approved'),
    ),
  )

  for (const d of snap.docs) {
    const leave = { id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }
    const status = computeDayLeaveStatus(isoDate, leave)
    if (status !== 'none') return status
  }

  return 'none'
}
