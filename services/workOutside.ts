import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { OffsiteRequestDoc } from '@/types/workOutside'

export async function fetchAllTodayOffsite(): Promise<OffsiteRequestDoc[]> {
  const today = new Date().toISOString().split('T')[0]

  // A request active today must not have ended yet — bound on endDate so this
  // doesn't download every approved offsite request the company has ever had.
  try {
    const snap = await getDocs(
      query(
        collection(db, 'workOutside'),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      )
    )
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter(r => r.startDate <= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  } catch {
    // Composite index missing/still building — fall back to the un-scoped scan.
    const snap = await getDocs(
      query(collection(db, 'workOutside'), where('status', '==', 'approved'))
    )
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter(r => r.startDate <= today && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }
}

export async function fetchTodayOffsiteByWorkLocation(workLocationUid: string): Promise<OffsiteRequestDoc[]> {
  if (!workLocationUid) return []

  const today = new Date().toISOString().split('T')[0]
  const col = collection(db, 'workOutside')

  try {
    const snap = await getDocs(
      query(
        col,
        where('requester.workLocation.uuid', '==', workLocationUid),
        where('status', '==', 'approved'),
        where('endDate', '>=', today),
      ),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter((r) => r.startDate <= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  } catch {
    const snap = await getDocs(
      query(col, where('requester.workLocation.uuid', '==', workLocationUid), where('status', '==', 'approved')),
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as OffsiteRequestDoc))
      .filter((r) => r.startDate <= today && r.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }
}
