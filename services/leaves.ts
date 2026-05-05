import { addDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeaveRequest } from '@/lib/types'

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

  const today = new Date().toISOString().split('T')[0]
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
      (row.status === 'pending' || (typeof row.endDate === 'string' && row.endDate >= today))
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
