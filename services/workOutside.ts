import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ActivityCode, OffsiteRequestDoc } from '@/types/workOutside'

export async function fetchOffsiteForApproval(params: {
  workLocationUuid: string
  departmentUuid?: string
  excludeUserUid: string
}): Promise<OffsiteRequestDoc[]> {
  const { workLocationUuid, departmentUuid, excludeUserUid } = params

  const constraints = departmentUuid
    ? [
        where('requester.workLocation.uuid', '==', workLocationUuid),
        where('requester.department.uuid', '==', departmentUuid),
      ]
    : [where('requester.workLocation.uuid', '==', workLocationUuid)]

  const snap = await getDocs(query(collection(db, 'workOutside'), ...constraints))

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
    .filter((d) => d.createdByUid !== excludeUserUid)
    .filter((d) => d.status === 'pending' || d.endDate >= monthStart)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// Fetch workOutside records where the user appears in the teammate[] array,
// filtered by month (YYYY-MM) and optional activityType code.
export async function fetchOffsiteByTeammateUid(params: {
  userUid: string
  month: string               // YYYY-MM
  activityType?: ActivityCode | 'all'
}): Promise<OffsiteRequestDoc[]> {
  const { userUid, month, activityType } = params

  const [y, m] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

  // Single-field range on startDate — no composite index required
  const snap = await getDocs(
    query(
      collection(db, 'workOutside'),
      where('startDate', '>=', monthStart),
      where('startDate', '<=', monthEnd),
    )
  )

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
    .filter((d) => d.teammate?.some((t) => t.uid === userUid))
    .filter((d) => !activityType || activityType === 'all' || d.activityType?.code === activityType)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
