import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface OfficialHoliday {
  id: string
  date: string   // YYYY-MM-DD
  name: string
  type?: string
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}

export async function fetchOfficialHolidays(): Promise<OfficialHoliday[]> {
  const snap = await getDocs(collection(db, 'officialHoliday'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OfficialHoliday))
}
