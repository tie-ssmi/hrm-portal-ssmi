import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeaveBalanceV2 } from '@/lib/types'
import { getVientianeIsoDate } from '@/lib/server-time'

// leaveBalance mixes older LeaveBalanceRecord docs (month-keyed) with the
// admin repo's v2 docs (period-keyed) in the same collection — filter to
// schemaVersion 2, same check the admin Cloud Function itself uses when
// reading back existing adjustments (functions/src/index.ts:1488).
export async function fetchCurrentLeaveBalancesV2(userUuid: string): Promise<LeaveBalanceV2[]> {
  if (!userUuid) return []

  const snap = await getDocs(query(collection(db, 'leaveBalance'), where('uid', '==', userUuid)))
  const today = getVientianeIsoDate()

  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveBalanceV2, 'id'>) }))
    .filter(
      (b) => b.schemaVersion === 2 && b.periodStart <= today && today <= b.periodEnd,
    )
}
