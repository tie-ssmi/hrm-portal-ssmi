import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeaveBalanceRecord } from '@/lib/types'

export async function fetchLeaveBalancesForUserMonth(
  userUuid: string,
  month: string, // "MM-YYYY"
): Promise<LeaveBalanceRecord[]> {
  if (!userUuid) return []

  const snap = await getDocs(
    query(
      collection(db, 'leaveBalance'),
      where('uid', '==', userUuid),
      where('month', '==', month),
    ),
  )

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveBalanceRecord, 'id'>) }))
}
