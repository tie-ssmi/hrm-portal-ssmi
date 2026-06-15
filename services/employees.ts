// api.ts
import { collection, doc, getDoc, getDocs, query, where, updateDoc, type Query, type DocumentData } from "firebase/firestore"
import { db } from "../lib/firebase"
import type{ Employee } from "../types/employee"

type GetEmployeesFilters = {
  departmentUuid?: string
  workLocationUuid?: string
  excludeUid?: string
}

export const getEmployees = async (filters?: GetEmployeesFilters): Promise<Employee[]> => {
  // Build server-side constraints to avoid fetching the entire collection
  let q: Query<DocumentData> = collection(db, "employees")

  if (filters?.departmentUuid) {
    // Works when department is stored as object with uuid field
    q = query(q, where("department.uuid", "==", filters.departmentUuid))
  }

  if (filters?.workLocationUuid) {
    q = query(q, where("workLocation.uuid", "==", filters.workLocationUuid))
  }

  const snapshot = await getDocs(q)
  const employees = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data() as Employee
  }))

  // status and excludeUid are kept client-side:
  // - "delete" filter: active employees often have no status field, so Firestore != won't catch them
  // - excludeUid: Firestore doesn't support != on the same field efficiently
  return employees.filter((employee) => {
    if (employee.status === "delete") return false
    if (filters?.excludeUid && employee.uid === filters.excludeUid) return false
    return true
  })
}

export const getEmployeeByUid = async (uid: string): Promise<Employee | null> => {
  const snapshot = await getDoc(doc(db, "employees", uid))

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as Employee
}

export const disableEmployee = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, "employees", uid), {
    status: "delete",
    updatedAt: new Date().toISOString(),
  })
}