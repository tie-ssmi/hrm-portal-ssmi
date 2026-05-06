import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GeoFence } from '@/lib/types'

export type WorkLocationFenceResult =
  | { status: 'found'; fence: GeoFence }
  | { status: 'no_coordinates'; name: string }  // document found but lat/lng not set
  | { status: 'not_found' }

function toGeoFence(d: Record<string, any>): GeoFence | null {
  if (d.lat == null || d.lng == null) return null
  return { lat: d.lat, lng: d.lng, radius: d.radius ?? 200, name: d.nameLo || d.nameEn || d.nameEN || '' }
}

function toName(d: Record<string, any>): string {
  return d.nameLo || d.nameEn || d.nameEN || ''
}

export async function fetchWorkLocationGeoFence(value: string): Promise<WorkLocationFenceResult> {
  if (!value) return { status: 'not_found' }

  // 1. Try direct document ID lookup
  const directSnap = await getDoc(doc(db, 'workLocation', value))
if (directSnap.exists()) {
    const d = directSnap.data()
    const fence = toGeoFence(d)
    if (fence) return { status: 'found', fence }
    return { status: 'no_coordinates', name: toName(d) }
  }

  // 2. Try matching by code (e.g. "SSMILPB")
  const codeSnap = await getDocs(query(collection(db, 'workLocation'), where('code', '==', value)))
  if (!codeSnap.empty) {
    const d = codeSnap.docs[0].data()
    const fence = toGeoFence(d)
    if (fence) return { status: 'found', fence }
    return { status: 'no_coordinates', name: toName(d) }
  }

  return { status: 'not_found' }
}
