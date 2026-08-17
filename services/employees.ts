// api.ts
import { collection, getDocs, query, where, type Query, type DocumentData } from "firebase/firestore"
import { db } from "../lib/firebase"
import type{ Employee } from "../types/employee"

type GetEmployeesFilters = {
  departmentUuid?: string
  departmentUuids?: string[]
  workLocationUuid?: string
  excludeUid?: string
}

export const getEmployees = async (filters?: GetEmployeesFilters): Promise<Employee[]> => {
  // Build server-side constraints to avoid fetching the entire collection
  let q: Query<DocumentData> = collection(db, "employees")

  if (filters?.departmentUuids && filters.departmentUuids.length > 0) {
    // Works when department is stored as object with uuid field
    q = query(q, where("department.uuid", "in", filters.departmentUuids))
  } else if (filters?.departmentUuid) {
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