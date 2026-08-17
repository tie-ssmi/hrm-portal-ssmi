import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

// employees/{uid}/documents/{docId} — replaces the legacy docs[] array field
// on the employees doc (unbounded growth, no per-file access control).

export type EmployeeDocumentRecord = {
  id: string
  name: string
  url: string
  addAt: string
}

export async function fetchEmployeeDocuments(
  uid: string,
): Promise<EmployeeDocumentRecord[]> {
  const q = query(
    collection(db, "employees", uid, "documents"),
    orderBy("addAt", "desc"),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      name: data.name || "",
      url: data.url || "",
      addAt: data.addAt || "",
    }
  })
}

export async function upsertEmployeeDocument(
  uid: string,
  docId: string,
  entry: { name: string; url: string; addAt: string },
): Promise<void> {
  await setDoc(doc(db, "employees", uid, "documents", docId), entry)
}

export async function deleteEmployeeDocument(
  uid: string,
  docId: string,
): Promise<void> {
  await deleteDoc(doc(db, "employees", uid, "documents", docId))
}
