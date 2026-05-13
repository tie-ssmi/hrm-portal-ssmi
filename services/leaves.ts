import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeaveApprovalStep, LeaveRequest } from '@/lib/types'
import { resolveLeaveRequestStatus } from '@/services/leave-approval'

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
}): Promise<void> {
  const { leaveId, approvalIndex, decision, reviewedBy, reviewedByUid } = params
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

export async function fetchLeavesByUserUuidFromToday(userUuid: string): Promise<LeaveRequest[]> {
  if (!userUuid) {
    return []
  }

  const today = new Date().toISOString().split('T')[0]
  const leavesQuery = query(collection(db, 'leaves'), where('leaveUserUuid', '==', userUuid))

  const snapshot = await getDocs(leavesQuery)
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<LeaveRequest, 'id'>),
  }))

  return rows
    .filter((row) =>
      (typeof row.endDate === 'string' && row.endDate >= today) ||
      row.status === 'pending'
    )
    .sort((a, b) => {
      const aTime = a.createdAt ?? ''
      const bTime = b.createdAt ?? ''
      return bTime.localeCompare(aTime) // newest first
    })
}
