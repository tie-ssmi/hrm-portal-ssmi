import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LegalBasisEntry } from '@/lib/types'

// "ອີງຕາມ" = ພື້ນຖານທາງກົດໝາຍ/ລະບຽບ ທີ່ອ້າງອີງຢູ່ຫົວເອກະສານລາຊະການ.
// ຈັດການຢູ່ admin (HRM-System-SSMI/frontend/src/services/legalBasis.ts) —
// portal ອ່ານຢ່າງດຽວ ແລ້ວ copy ລົງ doc ຄຳຮ້ອງຕອນຍື່ນ.
//
// key ຕ້ອງຕົງກັບ LegalBasisCategoryKey ໃນ admin (config/legalBasis.ts) —
// ຄ່ານີ້ຖືກເກັບລົງ Firestore field `category` ຈຶ່ງຫ້າມປ່ຽນ.
export type LegalBasisCategory =
  | 'leave'
  | 'offsite'
  | 'ot'
  | 'provinceIssueFollowUp'
  | 'provinceInspection'
  | 'training'

// ກັ່ນຕອງດ້ວຍ where 2 ຂໍ້ ແລ້ວຮຽງໃນ JS — `where + where + orderBy` ຕ້ອງການ
// composite index, ແລະ collection ນີ້ມີລາຍການຈຳນວນນ້ອຍ.
// ການຮຽງຕົງກັບ getLegalBasisByCategory ຂອງ admin: doc ເກົ່າທີ່ບໍ່ມີ `order`
// ຕົກໄປທ້າຍສຸດ ແລ້ວແກ້ສະເໝີກັນດ້ວຍ createdAt.
export async function fetchActiveLegalBasis(
  category: LegalBasisCategory,
): Promise<LegalBasisEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, 'legalBasis'),
      where('category', '==', category),
      where('status', '==', 'active'),
    ),
  )

  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      return {
        detail: typeof data.detail === 'string' ? data.detail : '',
        order: typeof data.order === 'number' ? data.order : Number.MAX_SAFE_INTEGER,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
      }
    })
    .filter((e) => e.detail !== '')
    .sort((a, b) =>
      a.order !== b.order ? a.order - b.order : a.createdAt.localeCompare(b.createdAt),
    )
    .map(({ detail, order }) => ({ detail, order }))
}
