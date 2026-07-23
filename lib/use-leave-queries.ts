'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  attachLeaveDocument,
  createLeaveRequest,
  fetchAllLeavesByUserUuid,
  fetchLeavesByUserThisYear,
  fetchAllTodayLeaves,
  fetchLeavesForApproval,
  fetchLeavesByUserUuidFromToday,
  fetchPendingDocLeavesByUserUuid,
  fetchTodayLeavesByWorkLocation,
} from '@/services/leaves'
import { fetchPoliciesForGender } from '@/services/policies'
import {
  buildInitialLeaveApprovals,
  getRequiredLeaveApprovers,
  resolveLeaveRequestStatus,
} from '@/services/leave-approval'
import type { LeaveBalance, LeaveRequest } from '@/lib/types'

// ── Key factory ────────────────────────────────────────────────────────────────
export const leaveKeys = {
  all: ['leaves'] as const,
  byUser: (userUuid: string) =>
    [...leaveKeys.all, 'user', userUuid] as const,
  upcoming: (userUuid: string) =>
    [...leaveKeys.all, 'upcoming', userUuid] as const,
  pendingDoc: (userUuid: string) =>
    [...leaveKeys.all, 'pendingDoc', userUuid] as const,
  approval: (deptUid: string, workLocUid: string) =>
    [...leaveKeys.all, 'approval', deptUid, workLocUid] as const,
  today: (workLocationUuid: string) =>
    [...leaveKeys.all, 'today', workLocationUuid] as const,
  todayAll: () => [...leaveKeys.all, 'today', '__all__'] as const,
  balance: (userUuid: string, gender: string) =>
    [...leaveKeys.all, 'balance', userUuid, gender] as const,
}

function countLeaveDays(leave: LeaveRequest): number {
  if (typeof leave.duration === 'number' && leave.duration > 0) return leave.duration
  const start = new Date(leave.startDate)
  const end = new Date(leave.endDate)
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const startDeduct = leave.startPeriod === 'afternoon' ? 0.5 : 0
  const endDeduct = leave.endPeriod === 'morning' ? 0.5 : 0
  return Math.max(0, totalDays - startDeduct - endDeduct)
}

const EMPTY_BALANCE: LeaveBalance = {
  annual: 0, annualUsed: 0,
  sick: 0, sickUsed: 0,
  personal: 0, personalUsed: 0,
}

export function useLeaveBalance(params: {
  userUuid: string | null | undefined
  gender?: string | null
}) {
  const { userUuid, gender } = params
  return useQuery({
    queryKey: leaveKeys.balance(userUuid ?? '', gender ?? ''),
    queryFn: async (): Promise<LeaveBalance> => {
      const [allLeaves, policies] = await Promise.all([
        fetchLeavesByUserThisYear(userUuid!),
        fetchPoliciesForGender(gender),
      ])

      const approvedThisYear = allLeaves.filter(
        (l) => l.status === 'approved',
      )

      const annualUsed = approvedThisYear
        .filter((l) => l.type === 'annual')
        .reduce((sum, l) => sum + countLeaveDays(l), 0)
      const sickUsed = approvedThisYear
        .filter((l) => l.type === 'sick')
        .reduce((sum, l) => sum + countLeaveDays(l), 0)
      const personalUsed = approvedThisYear
        .filter((l) => l.type === 'personal')
        .reduce((sum, l) => sum + countLeaveDays(l), 0)

      const annual = policies.find((p) => p.requestType === 'annual')?.leavePolicy.annual ?? 0
      const sick = policies.find((p) => p.requestType === 'sick')?.leavePolicy.sick ?? 0
      const personal = policies.find((p) => p.requestType === 'personal')?.leavePolicy.personal ?? 0

      return { annual, annualUsed, sick, sickUsed, personal, personalUsed }
    },
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 10,
    placeholderData: EMPTY_BALANCE,
  })
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

export function useMyMaternityThisYear(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: [...leaveKeys.byUser(userUuid ?? ''), 'maternity-year'] as const,
    queryFn: async () => {
      const all = await fetchAllLeavesByUserUuid(userUuid!)
      const year = new Date().getFullYear().toString()
      return all.filter(
        (l) =>
          l.status === 'approved' &&
          (l.startDate ?? '').startsWith(year) &&
          (
            (l.type ?? '').toLowerCase().includes('maternity') ||
            (l.type ?? '').includes('ລາພັນ') ||
            (l.policyName ?? '').includes('ລາພັນ') ||
            (l.policyName ?? '').toLowerCase().includes('maternity')
          )
      )
    },
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}

function useLeavesByThisYear(userUuid: string | null | undefined) {
  return useQuery({
    queryKey: leaveKeys.upcoming(userUuid ?? ''),
    queryFn: () => fetchLeavesByUserThisYear(userUuid!),
    enabled: !!userUuid,
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpcomingLeaves(userUuid: string | null | undefined) {
  const { data: allLeaves = [], ...rest } = useLeavesByThisYear(userUuid)

  const filtered = useMemo(() => {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
    return allLeaves
      .filter((row) =>
        row.status === 'pending' ||
        (typeof row.startDate === 'string' && row.startDate.startsWith(monthPrefix)) ||
        (typeof row.endDate === 'string' && row.endDate.startsWith(monthPrefix))
      )
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return (b.startDate ?? '').localeCompare(a.startDate ?? '')
      })
  }, [allLeaves])

  return { data: filtered, ...rest }
}

export function usePendingDocLeaves(userUuid: string | null | undefined) {
  const { data: allLeaves = [], ...rest } = useLeavesByThisYear(userUuid)

  const filtered = useMemo(() =>
    allLeaves
      .filter((row) => row.status !== 'rejected' && row.docStatus === 'later')
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  [allLeaves])

  return { data: filtered, ...rest }
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

export function useAllTodayLeaves() {
  return useQuery({
    queryKey: leaveKeys.todayAll(),
    queryFn: fetchAllTodayLeaves,
    staleTime: 1000 * 60 * 5,
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

export function useAttachLeaveDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leaveId, docLink, userUuid }: { leaveId: string; docLink: string; userUuid: string }) =>
      attachLeaveDocument({ leaveId, docLink, actorUid: userUuid }),
    onSuccess: (_data, { leaveId, userUuid }) => {
      if (userUuid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.pendingDoc(userUuid) })
        queryClient.invalidateQueries({ queryKey: leaveKeys.byUser(userUuid) })
      }
      queryClient.invalidateQueries({ queryKey: ['leave', leaveId] })
    },
  })
}

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
        createdAt: new Date().toISOString(),
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
