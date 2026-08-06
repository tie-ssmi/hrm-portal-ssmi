import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where, type QuerySnapshot, type DocumentData } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import type { LeaveApprovalStep, LeaveRequest } from '@/lib/types'
import { resolveLeaveRequestStatus } from '@/services/leave-approval'
import { logAudit } from '@/services/audit-log'

function toLeaveRows(snapshot: QuerySnapshot<DocumentData>): LeaveRequest[] {
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, 'id'>) }))
}

// Merge results of a "pending" query + a "date-bounded" query, deduping by id
// (a request can legitimately match both). Lets each query stay scoped instead
// of downloading the whole collection to filter status/date in JS afterward.
function mergeLeaveRows(...groups: LeaveRequest[][]): LeaveRequest[] {
  const seen = new Set<string>()
  const merged: LeaveRequest[] = []
  for (const rows of groups) {
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      merged.push(row)
    }
  }
  return merged
}

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
  actorRoleUuid?: string
  actorRoleName?: string
  workLocation?: { code?: string; nameLo?: string; uuid?: string }
}): Promise<void> {
  const {
    leaveId, approvalIndex, decision, reviewedBy, reviewedByUid, rejectReason,
    actorRoleUuid, actorRoleName, workLocation,
  } = params
  const action = decision === 'approved' ? 'leave.request.approve' : 'leave.request.reject'
  const leaveRef = doc(db, 'leaves', leaveId)

  try {
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

    await logAudit({
      action,
      actorUid: reviewedByUid,
      actorName: reviewedBy,
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'leaves',
      targetId: leaveId,
      targetName: data.leaveUserName,
      before: { status: data.status, approvals },
      after: { status, approvals: updatedApprovals },
      reason: rejectReason,
      status: 'SUCCESS',
    })
  } catch (error) {
    await logAudit({
      action,
      actorUid: reviewedByUid,
      actorName: reviewedBy,
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'leaves',
      targetId: leaveId,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function createLeaveRequest(payload: Omit<LeaveRequest, 'id'>): Promise<string> {
  // Remove undefined fields to avoid Firebase errors
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  )

  try {
    const docRef = await addDoc(collection(db, 'leaves'), cleanPayload)

    await logAudit({
      action: 'leave.request.create',
      actorUid: payload.createdByUid || payload.leaveUserUuid || '',
      actorName: payload.createdBy || payload.leaveUserName || '',
      actorRoleUuid: '',
      workLocation: payload.workLocationUid ? { uuid: payload.workLocationUid } : undefined,
      targetType: 'leaves',
      targetId: docRef.id,
      targetName: payload.leaveUserName,
      after: cleanPayload,
      status: 'SUCCESS',
    })

    return docRef.id
  } catch (error) {
    await logAudit({
      action: 'leave.request.create',
      actorUid: payload.createdByUid || payload.leaveUserUuid || '',
      actorName: payload.createdBy || payload.leaveUserName || '',
      actorRoleUuid: '',
      workLocation: payload.workLocationUid ? { uuid: payload.workLocationUid } : undefined,
      targetType: 'leaves',
      targetId: '',
      targetName: payload.leaveUserName,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function fetchLeavesForApproval(params: {
  departmentUid: string
  workLocationUid: string
  excludeUserUuid: string
  canApproveBranch?: boolean
}): Promise<LeaveRequest[]> {
  const { departmentUid, workLocationUid, excludeUserUuid, canApproveBranch } = params
  if (!workLocationUid || (!canApproveBranch && !departmentUid)) return []

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'
  const scopeFilters = canApproveBranch
    ? [where('workLocationUid', '==', workLocationUid)]
    : [where('departmentUid', '==', departmentUid), where('workLocationUid', '==', workLocationUid)]

  let rows: LeaveRequest[]
  try {
    const [pendingSnap, thisMonthSnap] = await Promise.all([
      getDocs(query(collection(db, 'leaves'), ...scopeFilters, where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'leaves'), ...scopeFilters, where('endDate', '>=', monthStart))),
    ])
    rows = mergeLeaveRows(toLeaveRows(pendingSnap), toLeaveRows(thisMonthSnap))
  } catch {
    // Composite index missing/still building — fall back to the un-scoped scan.
    const snapshot = await getDocs(query(collection(db, 'leaves'), ...scopeFilters))
    rows = toLeaveRows(snapshot).filter((row) =>
      row.status === 'pending' || (typeof row.endDate === 'string' && row.endDate >= monthStart)
    )
  }

  return rows
    .filter((row) => row.leaveUserUuid !== excludeUserUuid)
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
  const scopeFilter = where('leaveUserUuid', '==', userUuid)

  let rows: LeaveRequest[]
  try {
    const [pendingSnap, thisYearSnap] = await Promise.all([
      getDocs(query(collection(db, 'leaves'), scopeFilter, where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'leaves'), scopeFilter, where('startDate', '>=', yearStart))),
    ])
    rows = mergeLeaveRows(toLeaveRows(pendingSnap), toLeaveRows(thisYearSnap))
  } catch {
    const snapshot = await getDocs(query(collection(db, 'leaves'), scopeFilter))
    rows = toLeaveRows(snapshot).filter((row) =>
      row.status === 'pending' || (typeof row.startDate === 'string' && row.startDate >= yearStart)
    )
  }

  return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function attachLeaveDocument(params: {
  leaveId: string
  docLink: string
  actorUid: string
  actorName?: string
  actorRoleUuid?: string
  actorRoleName?: string
  workLocation?: { code?: string; nameLo?: string; uuid?: string }
}): Promise<void> {
  const { leaveId, docLink, actorUid, actorName, actorRoleUuid, actorRoleName, workLocation } = params

  try {
    await updateDoc(doc(db, 'leaves', leaveId), {
      docLink,
      docStatus: 'now',
    })

    await logAudit({
      action: 'leave.request.attachDoc',
      actorUid,
      actorName: actorName ?? '',
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'leaves',
      targetId: leaveId,
      after: { docLink, docStatus: 'now' },
      status: 'SUCCESS',
    })
  } catch (error) {
    await logAudit({
      action: 'leave.request.attachDoc',
      actorUid,
      actorName: actorName ?? '',
      actorRoleUuid: actorRoleUuid ?? '',
      actorRoleName,
      workLocation,
      targetType: 'leaves',
      targetId: leaveId,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
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

  // A leave active today must not have ended yet — bounding on endDate excludes
  // every already-finished leave at the query level instead of downloading the
  // whole branch's history to filter in JS.
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'leaves'),
        where('workLocationUid', '==', workLocationUid),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      )
    )
    return toLeaveRows(snapshot).filter(r => r.startDate <= today)
  } catch {
    const snapshot = await getDocs(
      query(
        collection(db, 'leaves'),
        where('workLocationUid', '==', workLocationUid),
        where('status', '==', 'approved'),
      )
    )
    return toLeaveRows(snapshot).filter(r => r.startDate <= today && r.endDate >= today)
  }
}

export async function fetchAllTodayLeaves(): Promise<LeaveRequest[]> {
  const today = new Date().toISOString().split('T')[0]

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'leaves'),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      )
    )
    return toLeaveRows(snapshot).filter(r => r.startDate <= today)
  } catch {
    const snapshot = await getDocs(
      query(collection(db, 'leaves'), where('status', '==', 'approved'))
    )
    return toLeaveRows(snapshot).filter(r => r.startDate <= today && r.endDate >= today)
  }
}

export async function fetchLeavesByUserUuidFromToday(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) {
    return []
  }

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  const monthStart = `${monthPrefix}-01`
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]
  const scopeFilter = where('leaveUserUuid', '==', userUuid)

  let rows: LeaveRequest[]
  try {
    const [pendingSnap, startsThisMonthSnap, endsThisMonthSnap] = await Promise.all([
      getDocs(query(collection(db, 'leaves'), scopeFilter, where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'leaves'), scopeFilter, where('startDate', '>=', monthStart), where('startDate', '<', nextMonthStart))),
      getDocs(query(collection(db, 'leaves'), scopeFilter, where('endDate', '>=', monthStart), where('endDate', '<', nextMonthStart))),
    ])
    rows = mergeLeaveRows(toLeaveRows(pendingSnap), toLeaveRows(startsThisMonthSnap), toLeaveRows(endsThisMonthSnap))
  } catch {
    const snapshot = await getDocs(query(collection(db, 'leaves'), scopeFilter))
    rows = toLeaveRows(snapshot).filter((row) =>
      row.status === 'pending' ||
      (typeof row.startDate === 'string' && row.startDate.startsWith(monthPrefix)) ||
      (typeof row.endDate === 'string' && row.endDate.startsWith(monthPrefix))
    )
  }

  return rows
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

// Which half(s) of isoDate this single leave doc covers. A day is only fully
// blocked once morning AND afternoon are covered — possibly by two separate
// half-day requests, not necessarily the same doc.
function computeDayCoverage(isoDate: string, leave: LeaveRequest): { morning: boolean; afternoon: boolean } {
  const startDate = leave.startDate ?? ''
  const endDate = leave.endDate ?? ''
  const startPeriod = leave.startPeriod ?? 'morning'
  const endPeriod = leave.endPeriod ?? 'afternoon'

  if (!startDate || !endDate || isoDate < startDate || isoDate > endDate) {
    return { morning: false, afternoon: false }
  }

  // ວັນກາງ (ລະຫວ່າງ startDate ແລະ endDate) — ຢຸດວຽກທັງໝົດ
  if (isoDate > startDate && isoDate < endDate) return { morning: true, afternoon: true }

  if (isoDate === startDate && isoDate === endDate) {
    return { morning: startPeriod === 'morning', afternoon: endPeriod === 'afternoon' }
  }

  // ວັນທຳອິດ (startDate < endDate) — ເລີ່ມເຊົ້າ = ຄຸ້ມທັງມື້; ເລີ່ມບ່າຍ = ຄຸ້ມສະເພາະບ່າຍ
  if (isoDate === startDate) {
    return { morning: startPeriod === 'morning', afternoon: true }
  }

  // ວັນສຸດທ້າຍ (isoDate === endDate, isoDate > startDate) — ເຊົ້າຄຸ້ມສະເໝີ; ບ່າຍຂຶ້ນກັບ endPeriod
  return { morning: true, afternoon: endPeriod === 'afternoon' }
}

export async function fetchTodayLeaveStatus(
  userUuid: string,
  isoDate: string,
): Promise<DayLeaveStatus> {
  if (!userUuid) return 'none'

  // A leave covering isoDate must not have ended before it — bound on endDate
  // so this doesn't re-download the user's entire approved-leave history on
  // every check-in attempt.
  let leaveRows: LeaveRequest[]
  try {
    const snap = await getDocs(
      query(
        collection(db, 'leaves'),
        where('leaveUserUuid', '==', userUuid),
        where('status', '==', 'approved'),
        where('endDate', '>=', isoDate),
      ),
    )
    leaveRows = toLeaveRows(snap)
  } catch {
    const snap = await getDocs(
      query(
        collection(db, 'leaves'),
        where('leaveUserUuid', '==', userUuid),
        where('status', '==', 'approved'),
      ),
    )
    leaveRows = toLeaveRows(snap)
  }

  let morningCovered = false
  let afternoonCovered = false

  for (const leave of leaveRows) {
    const coverage = computeDayCoverage(isoDate, leave)
    if (coverage.morning) morningCovered = true
    if (coverage.afternoon) afternoonCovered = true
    if (morningCovered && afternoonCovered) return 'blocked'
  }

  return morningCovered ? 'morning_leave' : 'none'
}
