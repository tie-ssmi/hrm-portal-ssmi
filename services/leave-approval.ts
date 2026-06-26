import type { LeaveApprovalStep, LeaveApproverRole, LeaveRequest } from '@/lib/types'

export function getRequiredLeaveApprovers(duration?: number): LeaveApproverRole[] {
  if (duration !== undefined && duration >= 3) {
    return ['departmentHead', 'hr', 'manager']
  }
  return ['departmentHead', 'hr']
}

export function buildInitialLeaveApprovals(
  duration?: number,
  options?: { autoApproveDeptHead?: boolean },
): LeaveApprovalStep[] {
  const today = new Date().toISOString().split('T')[0]
  return getRequiredLeaveApprovers(duration).map((role) => {
    if (role === 'departmentHead' && options?.autoApproveDeptHead) {
      return { role, decision: 'approved' as const, reviewedAt: today, reviewedBy: 'System' }
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
