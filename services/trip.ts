import { collection, getDocs, query, where, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TripDoc } from '@/types/trip'

// Finds the active group trip (if any) that covers `isoDate` and includes `userUuid` in its staff list.
export async function fetchActiveTripForUser(userUuid: string, isoDate: string): Promise<TripDoc | null> {
  if (!userUuid) return null

  // A trip covering isoDate must not have ended yet — bound on endDate so this
  // doesn't re-scan every active trip the company has ever run.
  let docs: QueryDocumentSnapshot<DocumentData>[]
  try {
    const snap = await getDocs(
      query(
        collection(db, 'trip'),
        where('status', '==', 'active'),
        where('endDate', '>=', isoDate),
      ),
    )
    docs = snap.docs
  } catch {
    // Composite index missing/still building — fall back to the un-scoped scan.
    const snap = await getDocs(
      query(collection(db, 'trip'), where('status', '==', 'active')),
    )
    docs = snap.docs
  }

  for (const d of docs) {
    const trip = { id: d.id, ...(d.data() as Omit<TripDoc, 'id'>) }
    if (
      trip.startDate <= isoDate &&
      trip.endDate >= isoDate &&
      trip.staff?.some((s) => s.userUuid === userUuid)
    ) {
      return trip
    }
  }

  return null
}
