'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLeaveRequest,
  fetchAllLeavesByUserUuid,
  fetchLeavesForApproval,
  fetchLeavesByUserUuidFromToday,
  fetchTodayLeavesByWorkLocation,
} from '@/services/leaves'
import {
  buildInitialLeaveApprovals,
  getRequiredLeaveApprovers,
  resolveLeaveRequestStatus,
} from '@/services/leave-approval'
import type { LeaveRequest } from '@/lib/types'

// ── Key factory ────────────────────────────────────────────────────────────────
export const leaveKeys = {
  all: ['leaves'] as const,
  byUser: (userUuid: string) =>
    [...leaveKeys.all, 'user', userUuid] as const,
  upcoming: (userUuid: string) =>
    [...leaveKeys.all, 'upcoming', userUuid] as const,
  approval: (deptUid: string, workLocUid: string) =>
    [...leaveKeys.all, 'approval', deptUid, workLocUid] as const,
  today: (workLocationUuid: string) =>
    [...leaveKeys.all, 'today', workLocationUuid] as const,
}

// ── Read hooks ─────────────────────────────────────────────────────────────────

export function useUserLeaves(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: leaveKeys.byUser(userUuid ?? ''),
    queryFn: () => fetchAllLeavesByUserUuid(userUuid!),
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpcomingLeaves(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: leaveKeys.upcoming(userUuid ?? ''),
    queryFn: () => fetchLeavesByUserUuidFromToday(userUuid!),
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLeavesForApproval(params: {
  departmentUid: string | undefined
  workLocationUid: string | undefined
  excludeUserUuid: string
}) {
  const { departmentUid, workLocationUid, excludeUserUuid } = params
  return useQuery({
    queryKey: leaveKeys.approval(departmentUid ?? '', workLocationUid ?? ''),
    queryFn: () =>
      fetchLeavesForApproval({
        departmentUid: departmentUid!,
        workLocationUid: workLocationUid!,
        excludeUserUuid,
      }),
    enabled: !!departmentUid && !!workLocationUid && !!excludeUserUuid,
    staleTime: 1000 * 30,
  })
}

export function useTodayLeavesByWorkLocation(
  workLocationUuid: string | null | undefined,
) {
  return useQuery({
    queryKey: leaveKeys.today(workLocationUuid ?? ''),
    queryFn: () => fetchTodayLeavesByWorkLocation(workLocationUuid!),
    enabled: !!workLocationUuid,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

type SubmitLeavePayload = {
  request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'requiredApprovers' | 'approvals' | 'createdBy'>
  createdBy?: string
  approvalsOverride?: LeaveRequest['approvals']
}

export function useSubmitLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ request, createdBy, approvalsOverride }: SubmitLeavePayload) => {
      const requiredApprovers = getRequiredLeaveApprovers(request.duration)
      const approvals = approvalsOverride ?? buildInitialLeaveApprovals(request.duration)
      const status = resolveLeaveRequestStatus(approvals)

      const payload: Omit<LeaveRequest, 'id'> = {
        ...request,
        status,
        requiredApprovers,
        approvals,
        createdAt: new Date().toISOString().split('T')[0],
        ...(createdBy ? { createdBy } : {}),
      }

      const id = await createLeaveRequest(payload)
      return { id, ...payload }
    },
    onSuccess: (data) => {
      if (data.leaveUserUuid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.byUser(data.leaveUserUuid) })
        queryClient.invalidateQueries({ queryKey: leaveKeys.upcoming(data.leaveUserUuid) })
      }
      if (data.workLocationUid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.today(data.workLocationUid) })
      }
      if (data.departmentUid && data.workLocationUid) {
        queryClient.invalidateQueries({
          queryKey: leaveKeys.approval(data.departmentUid, data.workLocationUid),
        })
      }
    },
  })
}
