import type { LeaveApprovalStep, LeaveApproverRole, LeaveRequest } from '@/lib/types'

export function getRequiredLeaveApprovers(duration?: number): LeaveApproverRole[] {
  if (duration !== undefined && duration >= 3) {
    return ['departmentHead', 'hr', 'manager']
  }
  return ['departmentHead', 'hr']
}

export function buildInitialLeaveApprovals(
  duration?: number,
  options?: { autoApproveDeptHead?: boolean; autoApproveManager?: boolean; reviewedBy?: string },
): LeaveApprovalStep[] {
  const today = new Date().toISOString().split('T')[0]
  return getRequiredLeaveApprovers(duration).map((role) => {
    const autoApprove =
      (role === 'departmentHead' && options?.autoApproveDeptHead) ||
      (role === 'manager' && options?.autoApproveManager)
    if (autoApprove) {
      return { role, decision: 'approved' as const, reviewedAt: today, reviewedBy: options?.reviewedBy || 'System' }
    }
    return { role, decision: 'pending' as const }
  })
}

export function resolveLeaveRequestStatus(approvals?: LeaveApprovalStep[]): LeaveRequest['status'] {
  if (!approvals || approvals.length === 0) {
    return 'pending'
  }

  if (approvals.some((a) => a.decision === 'rejected')) {
    return 'rejected'
  }

  if (approvals.every((a) => a.decision === 'approved')) {
    return 'approved'
  }

  return 'pending'
}

export function getLeaveApproverRuleText(duration?: number | null): string {
  if (duration !== null && duration !== undefined && duration >= 3) {
    return 'ຜູ້ອານຸມັດ: ຫົວໜ້າພາແນກ, ບໍລິຫານ ບຸກຄະລາກອນ, ແລະ ຜູ້ຈັດການ'
  }
  return 'ຜູ້ອານຸມັດ: ຫົວໜ້າພາແນກ ແລະ ບໍລິຫານ ບຸກຄະລາກອນ'
}

// Lao text has several encodings that render identically: ຳ (U+0EB3) vs
// ໍ + າ, and tone mark before/after ໍ. NFKC splits ຳ (and ຫຼ/ໜ ligatures);
// the replace puts ໍ before the tone mark so both orders compare equal.
function normalizeLaoKey(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/([່-໋])ໍ/g, 'ໍ$1')
}

// Smaller provincial offices are "service units" (ໜ່ວຍບໍລິການ), not branches.
// Source of truth is workLocation.type === 'serviceUnit'; this list is only
// the fallback when the type couldn't be fetched.
const SERVICE_UNIT_LOCATIONS = new Set(
  ['ໄຊຍະບູລີ', 'ບໍ່ແກ້ວ', 'ຫຼວງນ້ຳທາ', 'ຜົ້ງສາລີ'].map(normalizeLaoKey),
)

function getWorkLocationUnitLabel(workLocationNameLo?: string, workLocationType?: string): string {
  const name = normalizeLaoKey(workLocationNameLo ?? '')
  const isServiceUnit = workLocationType
    ? workLocationType === 'serviceUnit'
    : SERVICE_UNIT_LOCATIONS.has(name)
  if (isServiceUnit) return 'ໜ່ວຍບໍລິການ ແຂວງ'
  if (name === normalizeLaoKey('ນະຄອນຫຼວງວຽງຈັນ')) return 'ສາຂາ'
  return 'ສາຂາ ແຂວງ'
}

// Formal salutation line for the printed/PDF leave doc — who the request
// letter is addressed to.
export function getLeaveRecipientText(
  duration: number | null | undefined,
  isLPB: boolean,
  workLocationNameLo?: string,
  workLocationType?: string,
): string {
  if (duration !== null && duration !== undefined && duration >= 3) {
    return 'ທ່ານ ຮອງຜູ້ອຳນວຍການຝ່າຍການປະຕິບັດການ ທີ່ນັບຖື'
  }
  if (isLPB) {
    return 'ທ່ານ ຫົວໜ້າພະແນກ ບໍລິຫານ ແລະ ບຸກຄະລາກອນ ທີ່ນັບຖື'
  }
  return `ທ່ານ ຫົວໜ້າ ສກຈຮ ສິນຊັບເມືອງເໜືອ ຈຳກັດ ${getWorkLocationUnitLabel(workLocationNameLo, workLocationType)} ${workLocationNameLo ?? ''} ທີ່ນັບຖື`.replace(/\s+/g, ' ').trim()
}
