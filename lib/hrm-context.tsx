'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  AttendanceRecord,
  HRMContextType,
  LeaveRequest,
  OffsiteRequest,
  ProfileUpdateRequest,
  LeaveApproverRole,
  GeoFence,
  LeaveApprovalStep,
} from './types'
import {
  buildInitialLeaveApprovals,
  getRequiredLeaveApprovers,
  resolveLeaveRequestStatus,
} from '@/services/leave-approval'
import { createLeaveRequest } from '@/services/leaves'
import { getVientianeIsoDate } from '@/lib/server-time'
import { fetchWorkLocationGeoFence, type WorkLocationFenceResult } from '@/services/workLocations'
import { useAuth } from './auth-context'
import { useAttendanceHistory } from './use-attendance-queries'
import { attendanceKeys } from './use-attendance-queries'
import { leaveKeys, useLeaveBalance } from './use-leave-queries'

const HRMContext = createContext<HRMContextType | undefined>(undefined)

function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function HRMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ── Attendance via TanStack Query (single source of truth) ────────────────
  const { data: attendanceHistory = [] } = useAttendanceHistory(user?.uuid)

  const todayAttendance = useMemo<AttendanceRecord | null>(() => {
    // Vientiane, matching the dateKey the server stamps on the record and the
    // lookup in useTodayAttendance — the device's own date silently missed
    // today's row whenever the viewer's timezone/clock differed.
    const today = getVientianeIsoDate()
    return attendanceHistory.find((r) => r.date === today) ?? null
  }, [attendanceHistory])

  // ── Leave balance from Firestore (policies × approved leaves this year) ──────
  const { data: leaveBalance = { annual: 0, annualUsed: 0, sick: 0, sickUsed: 0, personal: 0, personalUsed: 0 } } = useLeaveBalance({
    userUuid: user?.uuid,
    gender: user?.gender,
  })

  // ── Geo-fence ─────────────────────────────────────────────────────────────
  const [geoFence, setGeoFence] = useState<GeoFence | null>(null)
  const [geoFenceStatus, setGeoFenceStatus] = useState<
    WorkLocationFenceResult['status'] | 'loading'
  >('loading')

  const workLocationUuid =
    typeof user?.workLocation === 'object'
      ? ((user.workLocation as { uuid?: string; uid?: string; code?: string })?.uuid
          || (user.workLocation as { uid?: string })?.uid
          || (user.workLocation as { code?: string })?.code)
      : typeof user?.workLocation === 'string'
      ? user.workLocation
      : undefined

  useEffect(() => {
    if (!workLocationUuid) {
      setGeoFenceStatus('not_found')
      return
    }
    let mounted = true
    setGeoFenceStatus('loading')
    fetchWorkLocationGeoFence(workLocationUuid)
      .then((result) => {
        if (!mounted) return
        setGeoFenceStatus(result.status)
        if (result.status === 'found') setGeoFence(result.fence)
      })
      .catch(() => { if (mounted) setGeoFenceStatus('not_found') })
    return () => { mounted = false }
  }, [workLocationUuid])

  const distanceToOffice = useCallback(
    (lat: number, lng: number): number | null =>
      geoFence ? Math.round(calculateDistance(lat, lng, geoFence.lat, geoFence.lng)) : null,
    [geoFence],
  )

  const isWithinGeofence = useCallback(
    (lat: number, lng: number) => {
      // Fail-closed while geofence is loading — deny until we know the boundary
      if (geoFenceStatus === 'loading') return false
      // Work location has no geofence configured — no restriction applies
      if (geoFenceStatus === 'not_found' || !geoFence) return true
      return calculateDistance(lat, lng, geoFence.lat, geoFence.lng) <= geoFence.radius
    },
    [geoFence, geoFenceStatus],
  )

  // ── Submit leave (invalidates query cache) ────────────────────────────────
  const submitLeaveRequest = useCallback(
    async (
      request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>,
      options?: { autoApproveDeptHead?: boolean; autoApproveManager?: boolean; reviewedBy?: string },
    ) => {
      const requiredApprovers = getRequiredLeaveApprovers(request.duration)
      const approvals = buildInitialLeaveApprovals(request.duration, options)
      const status = resolveLeaveRequestStatus(approvals)
      const createdBy = [user?.firstNameLo || user?.firstName, user?.lastNameLo || user?.lastName]
        .filter(Boolean).join(' ') || undefined

      const payload: Omit<LeaveRequest, 'id'> = {
        ...request,
        status,
        requiredApprovers,
        approvals,
        createdAt: new Date().toISOString(),
        createdBy,
      }

      await createLeaveRequest(payload)

      // Invalidate all leave caches so pages re-fetch fresh data
      if (payload.leaveUserUuid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.byUser(payload.leaveUserUuid) })
        queryClient.invalidateQueries({ queryKey: leaveKeys.upcoming(payload.leaveUserUuid) })
      }
      if (payload.workLocationUid) {
        queryClient.invalidateQueries({ queryKey: leaveKeys.today(payload.workLocationUid) })
      }
      if (payload.departmentUid && payload.workLocationUid) {
        queryClient.invalidateQueries({
          queryKey: leaveKeys.approval(payload.departmentUid, payload.workLocationUid),
        })
      }
    },
    [user, queryClient],
  )

  const reviewLeaveRequest = useCallback(
    async (
      requestId: string,
      role: LeaveApproverRole,
      decision: 'approved' | 'rejected',
      reviewedBy?: string,
    ) => {
      // Optimistic local update handled by approv page's own queryClient
      // invalidate approval lists so approv page re-fetches
      queryClient.invalidateQueries({ queryKey: leaveKeys.all })
    },
    [queryClient],
  )

  const submitOffsiteRequest = useCallback(
    async (request: Omit<OffsiteRequest, 'id' | 'status' | 'createdAt'>) => {
      // placeholder — replace with real Firestore write when service is ready
      await new Promise((r) => setTimeout(r, 500))
    },
    [],
  )

  const submitProfileUpdate = useCallback(
    async (request: Omit<ProfileUpdateRequest, 'id' | 'status' | 'createdAt'>) => {
      await new Promise((r) => setTimeout(r, 500))
    },
    [],
  )

  const contextValue = useMemo(() => ({
    todayAttendance,
    attendanceHistory,
    leaveBalance,
    leaveRequests: [] as never[],
    submitLeaveRequest,
    reviewLeaveRequest,
    offsiteRequests: [] as never[],
    submitOffsiteRequest,
    profileUpdateRequests: [] as never[],
    submitProfileUpdate,
    lateRecords: [] as never[],
    totalFines: 0,
    isWithinGeofence,
    distanceToOffice,
    geoFenceStatus,
    geoFence,
  }), [
    todayAttendance,
    attendanceHistory,
    leaveBalance,
    submitLeaveRequest,
    reviewLeaveRequest,
    submitOffsiteRequest,
    submitProfileUpdate,
    isWithinGeofence,
    distanceToOffice,
    geoFenceStatus,
    geoFence,
  ])

  return (
    <HRMContext.Provider value={contextValue}>
      {children}
    </HRMContext.Provider>
  )
}

export function useHRM() {
  const context = useContext(HRMContext)
  if (!context) throw new Error('useHRM must be used within an HRMProvider')
  return context
}
