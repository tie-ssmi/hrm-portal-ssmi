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
      uid: data.uid || uid,
      uuid: data.uuid || employeeDoc.id,
      employeeId: data.employeeId || employeeDoc.id,
      joinDate: data.joinDate || (data.createdAt ? String(data.createdAt).split('T')[0] : undefined),
    } as Partial<Employee>
  } catch (error) {
    console.error('Error fetching employee data:', error)
    return null
  }
}

export async function fetchEmployeeByEmail(email: string): Promise<Partial<Employee> | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    const employeesRef = collection(db, 'employees')
    const q = query(employeesRef, where('email', '==', normalizedEmail))
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
      email: data.email || normalizedEmail,
      uid: data.uid,
      uuid: data.uuid || employeeDoc.id,
      employeeId: data.employeeId || employeeDoc.id,
      joinDate: data.joinDate || (data.createdAt ? String(data.createdAt).split('T')[0] : undefined),
    } as Partial<Employee>
  } catch (error) {
    console.error('Error fetching employee data by email:', error)
    return null
  }
}

export async function updateEmployeeUidByEmail(email: string, uid: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const employeesRef = collection(db, 'employees')
  const q = query(employeesRef, where('email', '==', normalizedEmail))
  const querySnapshot = await getDocs(q)

  if (querySnapshot.empty) {
    throw new Error('Employee document not found for email')
  }

  const employeeDocRef = querySnapshot.docs[0].ref
  await updateDoc(employeeDocRef, { uid, email: normalizedEmail })
}

export async function updateEmployeeProfileImage(uid: string, profileImageUrl: string): Promise<void> {
  const payload = { profileImage: profileImageUrl }

  try {
    const directDocRef = doc(db, 'employees', uid)
    await updateDoc(directDocRef, payload)
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
  await updateDoc(employeeDocRef, payload)
}
