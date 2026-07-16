import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TripDoc } from '@/types/trip'

// Finds the active group trip (if any) that covers `isoDate` and includes `userUuid` in its staff list.
export async function fetchActiveTripForUser(userUuid: string, isoDate: string): Promise<TripDoc | null> {
  if (!userUuid) return null

  const snap = await getDocs(
    query(collection(db, 'trip'), where('status', '==', 'active')),
  )

  for (const d of snap.docs) {
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
