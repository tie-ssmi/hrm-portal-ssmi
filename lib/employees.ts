import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Employee } from './types'

export async function fetchEmployeeByUid(uid: string): Promise<Partial<Employee> | null> {
  try {
    const employeesRef = collection(db, 'employees')
    const q = query(employeesRef, where('uid', '==', uid))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    const employeeDoc = querySnapshot.docs[0]
    const data = employeeDoc.data()

    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
      data.createdAt = data.createdAt.toDate().toISOString()
    }

    return {
      ...data,
      employeeId: data.employeeId || employeeDoc.id,
      joinDate: data.joinDate || (data.createdAt ? String(data.createdAt).split('T')[0] : undefined),
    } as Partial<Employee>
  } catch (error) {
    console.error('Error fetching employee data:', error)
    return null
  }
}

export async function updateEmployeeProfileImage(uid: string, profileImageUrl: string): Promise<void> {
  const nestedPayload = {
    [`profileImage.${uid}.profileImage`]: profileImageUrl,
  }

  const flatPayload = {
    profileImage: profileImageUrl,
  }

  try {
    // Primary path requested: employees/{uid}
    const directDocRef = doc(db, 'employees', uid)
    try {
      await updateDoc(directDocRef, nestedPayload)
    } catch {
      await updateDoc(directDocRef, flatPayload)
    }
    return
  } catch {
    // Fallback for schemas where doc ID is not uid but `uid` is stored as a field.
  }

  const employeesRef = collection(db, 'employees')
  const q = query(employeesRef, where('uid', '==', uid))
  const querySnapshot = await getDocs(q)

  if (querySnapshot.empty) {
    throw new Error('Employee document not found for uid')
  }

  const employeeDocRef = querySnapshot.docs[0].ref
  try {
    await updateDoc(employeeDocRef, nestedPayload)
  } catch {
    await updateDoc(employeeDocRef, flatPayload)
  }
}
