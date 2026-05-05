import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GeoFence } from '@/lib/types'

function toGeoFence(d: Record<string, any>): GeoFence | null {
  if (d.lat == null || d.lng == null) return null
  return { lat: d.lat, lng: d.lng, radius: d.radius ?? 200, name: d.nameLo || d.nameEn || d.nameEN || '' }
}

export async function fetchWorkLocationGeoFence(value: string): Promise<GeoFence | null> {
  if (!value) return null

  // 1. Try direct document ID lookup
  const directSnap = await getDoc(doc(db, 'workLocations', value))
  if (directSnap.exists()) {
    const fence = toGeoFence(directSnap.data())
    if (fence) return fence
  }

  // 2. Try matching by code (e.g. "SSMILPB")
  const codeSnap = await getDocs(query(collection(db, 'workLocations'), where('code', '==', value)))
  if (!codeSnap.empty) {
    const fence = toGeoFence(codeSnap.docs[0].data())
    if (fence) return fence
  }

  return null
}
