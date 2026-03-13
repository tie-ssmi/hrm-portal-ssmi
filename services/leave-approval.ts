import type { LeaveApprovalStep, LeaveApproverRole, LeaveRequest } from '@/lib/types'

export function getRequiredLeaveApprovers(duration?: number): LeaveApproverRole[] {
  if (duration !== undefined && duration >= 3) {
    return ['departmentHead', 'hr', 'manager']
  }
  return ['departmentHead', 'hr']
}

export function buildInitialLeaveApprovals(duration?: number): LeaveApprovalStep[] {
  return getRequiredLeaveApprovers(duration).map((role) => ({
    role,
    decision: 'pending',
  }))
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
    return 'Approvers: Head of Department, HR, and Manager'
  }
  return 'Approvers: Head of Department and HR'
}
