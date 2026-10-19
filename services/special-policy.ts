import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  pickActivePolicies,
  resolvePolicyTimes,
  type ResolvedPolicy,
  type SpecialPolicyLike,
} from '@/lib/special-policy'

// ນະໂຍບາຍພິເສດ (specialPolicy, ສ້າງຈາກ admin) ທີ່ຄຸ້ມ userUuid ໃນວັນ isoDate, ລວມເປັນອັນດຽວແລ້ວ.
// query ແລະ ກັ່ນແບບດຽວກັບ server (getTodaySpecialPolicy ໃນ functions/src/index.ts).
export async function fetchTodaySpecialPolicy(
  userUuid: string,
  isoDate: string,
): Promise<ResolvedPolicy | null> {
  if (!userUuid) return null
  const snap = await getDocs(
    query(collection(db, 'specialPolicy'), where('staffUuids', 'array-contains', userUuid)),
  )
  const policies = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<SpecialPolicyLike, 'id'>) }),
  )
  return resolvePolicyTimes(pickActivePolicies(policies, userUuid, isoDate))
}
