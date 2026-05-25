import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { OffsiteRequestDoc } from '@/types/workOutside'

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
