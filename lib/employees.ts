import { collection, getDocs, query, where } from 'firebase/firestore'
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

    return data as Partial<Employee>
  } catch (error) {
    console.error('Error fetching employee data:', error)
    return null
  }
}
