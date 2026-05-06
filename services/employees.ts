// api.ts
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore"
import { db } from "../lib/firebase"
import type{ Employee } from "../types/employee"

type GetEmployeesFilters = {
  departmentUuid?: string
  workLocationUuid?: string
  excludeUid?: string
}

export const getEmployees = async (filters?: GetEmployeesFilters): Promise<Employee[]> => {
  const snapshot = await getDocs(collection(db, "employees"))
  const employees = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as Employee
  }))

  return employees.filter((employee) => {
    if (employee.status === "delete") {
      return false
    }

    if (filters?.excludeUid && employee.uid === filters.excludeUid) {
      return false
    }

    if (filters?.departmentUuid && employee.department?.uuid !== filters.departmentUuid) {
      return false
    }

    if (filters?.workLocationUuid && employee.workLocation?.uuid !== filters.workLocationUuid) {
      return false
    }

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