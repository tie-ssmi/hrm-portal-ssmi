import { addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LeaveRequest } from '@/lib/types'

export async function createLeaveRequest(payload: Omit<LeaveRequest, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'leaves'), payload)
  return docRef.id
}
