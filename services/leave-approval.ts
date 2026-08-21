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

// Formal salutation line for the printed/PDF leave doc — who the request
// letter is addressed to.
export function getLeaveRecipientText(
  duration: number | null | undefined,
  isLPB: boolean,
  workLocationNameLo?: string,
): string {
  if (duration !== null && duration !== undefined && duration >= 3) {
    return 'ທ່ານ ຮອງຜູ້ອຳນວຍການຝ່າຍປະຕິບັດການ ທີ່ນັບຖື'
  }
  if (isLPB) {
    return 'ທ່ານ ຫົວໜ້າພະແນກ ບໍລິຫານ ແລະ ບຸກຄະລາກອນ ທີ່ນັບຖື'
  }
  return `ທ່ານ ຫົວໜ້າ ສກຈຮ ສິນຊັບເມືອງເໜືອ ຈຳກັດ ສາຂາ ແຂວງ ${workLocationNameLo ?? ''} ທີ່ນັບຖື`.replace(/\s+/g, ' ').trim()
}
