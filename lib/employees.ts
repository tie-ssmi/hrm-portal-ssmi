import { collection, doc, getDoc, getDocs, query, updateDoc, where, type DocumentReference, type DocumentData } from 'firebase/firestore'
import { db } from './firebase'
import type { Employee, RolePermissions } from './types'
import { logAudit } from '@/services/audit-log'

type ProfileEditActor = { name?: string; roleUuid?: string; roleName?: string }

// Some employee docs use uid as the doc ID directly; older ones store uid as a
// field on a doc keyed by something else. Resolves both, returning the doc's
// current data too so callers can build a "before" snapshot for the audit log.
async function resolveEmployeeDocRef(
  uid: string,
): Promise<{ ref: DocumentReference<DocumentData>; data: Record<string, unknown> } | null> {
  const directRef = doc(db, 'employees', uid)
  const directSnap = await getDoc(directRef)
  if (directSnap.exists()) {
    return { ref: directRef, data: directSnap.data() }
  }

  const employeesRef = collection(db, 'employees')
  const q = query(employeesRef, where('uid', '==', uid))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.empty) return null

  return { ref: querySnapshot.docs[0].ref, data: querySnapshot.docs[0].data() }
}

export async function fetchEmployeeByUid(uid: string): Promise<Partial<Employee> | null> {
  try {
    // direct doc read ໄວກວ່າ where query (O(1) vs collection scan)
    const directSnap = await getDoc(doc(db, 'employees', uid))
    if (directSnap.exists()) {
      const data = directSnap.data()
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString()
      }
      return {
        ...data,
        uid: data.uid || uid,
        uuid: data.uuid || directSnap.id,
        employeeId: data.employeeId || directSnap.id,
        joinDate: data.joinDate || (data.createdAt ? String(data.createdAt).split('T')[0] : undefined),
      } as Partial<Employee>
    }

    // fallback: doc ID ບໍ່ແມ່ນ uid — query by field
    const q = query(collection(db, 'employees'), where('uid', '==', uid))
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

export async function fetchRoleByUid(rolesUid: string): Promise<RolePermissions | null> {
  try {
    const roleSnap = await getDoc(doc(db, 'roles', rolesUid))
    if (!roleSnap.exists()) return null
    const data = roleSnap.data()
    return (data.role ?? null) as RolePermissions | null
  } catch (error) {
    console.error('Error fetching role permissions:', error)
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

export async function updateEmployeeProfileImage(
  uid: string,
  profileImageUrl: string,
  actor?: ProfileEditActor,
): Promise<void> {
  const payload = { profileImage: profileImageUrl }

  const logResult = (status: 'SUCCESS' | 'FAILED', before?: Record<string, unknown>, errorMessage?: string) =>
    logAudit({
      action: 'hr.employee.updatePhoto',
      actorUid: uid,
      actorName: actor?.name ?? '',
      actorRoleUuid: actor?.roleUuid ?? '',
      actorRoleName: actor?.roleName,
      targetType: 'employees',
      targetId: uid,
      before: status === 'SUCCESS' ? before : undefined,
      after: status === 'SUCCESS' ? payload : undefined,
      status,
      errorMessage,
    })

  const resolved = await resolveEmployeeDocRef(uid)
  if (!resolved) {
    await logResult('FAILED', undefined, 'Employee document not found for uid')
    throw new Error('Employee document not found for uid')
  }

  try {
    await updateDoc(resolved.ref, payload)
    await logResult('SUCCESS', { profileImage: resolved.data.profileImage })
  } catch (error) {
    await logResult('FAILED', undefined, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export async function updateEmployeeProfile(
  uid: string,
  updates: Partial<Employee>,
  actor?: ProfileEditActor,
): Promise<void> {
  const changedFields = Object.keys(updates)

  const logResult = (status: 'SUCCESS' | 'FAILED', before?: Record<string, unknown>, errorMessage?: string) =>
    logAudit({
      action: 'hr.employee.update',
      actorUid: uid,
      actorName: actor?.name ?? '',
      actorRoleUuid: actor?.roleUuid ?? '',
      actorRoleName: actor?.roleName,
      targetType: 'employees',
      targetId: uid,
      before: status === 'SUCCESS' ? before : undefined,
      after: status === 'SUCCESS' ? (updates as Record<string, unknown>) : undefined,
      changedFields: status === 'SUCCESS' ? changedFields : undefined,
      status,
      errorMessage,
    })

  const resolved = await resolveEmployeeDocRef(uid)
  if (!resolved) {
    await logResult('FAILED', undefined, 'Employee document not found for uid')
    throw new Error('Employee document not found for uid')
  }

  try {
    const before = Object.fromEntries(changedFields.map((key) => [key, resolved.data[key]]))
    await updateDoc(resolved.ref, updates)
    await logResult('SUCCESS', before)
  } catch (error) {
    await logResult('FAILED', undefined, error instanceof Error ? error.message : String(error))
    throw error
  }
}
